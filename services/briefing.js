import db from '../db/index';
import { getSetting } from '../db/helpers';
import { fmtMoney } from '../utils/currency';

// ═══ Сбор данных для брифинга (всё локально, $0) ═══
export async function collectBriefingData() {
  const today = new Date().toISOString().split('T')[0];
  const data = {};

  // Задачи
  try {
    const tasks = await db.tasks.toArray();
    const active = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
    data.overdueTasks = active.filter(t => t.deadline && t.deadline < today).length;
    data.todayTasks = active.filter(t => t.deadline === today).length;
    data.overdueNames = active
      .filter(t => t.deadline && t.deadline < today)
      .slice(0, 3)
      .map(t => t.title);
  } catch {
    data.overdueTasks = 0;
    data.todayTasks = 0;
    data.overdueNames = [];
  }

  // Платежи (ближайшие 5 дней)
  try {
    const fiveDays = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
    data.upcomingPayments = await db.credits
      .where('next_payment_date')
      .between(today, fiveDays, true, true)
      .toArray();
  } catch {
    data.upcomingPayments = [];
  }

  // Бюджет
  try {
    const budget = await getSetting('monthly_budget');
    const monthStart = today.slice(0, 8) + '01';
    const expenses = await db.expenses
      .where('date')
      .between(monthStart, today + '\uffff', true, true)
      .toArray();
    const spent = expenses.reduce((s, e) => s + (e.amount_base || e.amount || 0), 0);
    data.budgetUsedPercent = budget ? Math.round((spent / budget) * 100) : 0;
    data.budgetRemaining = budget ? budget - spent : 0;
    data.monthlySpent = spent;
  } catch {
    data.budgetUsedPercent = 0;
    data.budgetRemaining = 0;
  }

  // Последняя тренировка
  try {
    const lastWorkout = await db.workouts.orderBy('date').reverse().first();
    if (lastWorkout) {
      data.daysSinceWorkout = Math.floor(
        (Date.now() - new Date(lastWorkout.date + 'T00:00:00').getTime()) / 86400000
      );
      data.lastWorkoutType = lastWorkout.type;
    } else {
      data.daysSinceWorkout = 999;
    }
  } catch {
    data.daysSinceWorkout = 999;
  }

  // Сон (вчера)
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const sleep = await db.sleep_log.where('date').equals(yesterday).first();
    data.lastSleep = sleep
      ? { duration: sleep.duration_hours, bedTime: sleep.bed_time }
      : null;
  } catch {
    data.lastSleep = null;
  }

  // Документы, истекающие в ближайшие 30 дней
  try {
    const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    data.expiringDocs = await db.documents
      .where('expires_at')
      .between(today, thirtyDays, true, true)
      .count();
  } catch {
    data.expiringDocs = 0;
  }

  // Еда сегодня
  try {
    const meals = await db.food_log.where('date').equals(today).toArray();
    data.todayCalories = meals.reduce((s, m) => s + (m.calories || m.total_calories || 0), 0);
    data.calorieGoal = (await getSetting('daily_calorie_goal')) || 2200;
  } catch {
    data.todayCalories = 0;
    data.calorieGoal = 2200;
  }

  // Вода сегодня
  try {
    const water = await db.water_log.where('date').equals(today).toArray();
    data.todayWater = water.reduce((s, w) => s + (w.amount_ml || 0), 0);
    data.waterGoal = (await getSetting('daily_water_goal')) || 2000;
  } catch {
    data.todayWater = 0;
    data.waterGoal = 2000;
  }

  return data;
}

// ═══ Нужно ли показывать брифинг ═══
export function shouldShowBriefing(data) {
  return (
    data.overdueTasks > 0 ||
    data.todayTasks > 2 ||
    (data.upcomingPayments?.length || 0) > 0 ||
    data.budgetUsedPercent > 75 ||
    (data.daysSinceWorkout >= 3 && data.daysSinceWorkout < 999) ||
    data.expiringDocs > 0
  );
}

// ═══ Шаблонный брифинг ($0) ═══
export function generateTemplateBriefing(data) {
  const lines = [];

  if (data.todayTasks > 0) {
    let line = `📋 ${data.todayTasks} задач на сегодня`;
    if (data.overdueTasks > 0) {
      line += ` · ⚠️ ${data.overdueTasks} просроч.`;
      if (data.overdueNames?.[0]) line += `: «${data.overdueNames[0]}»`;
    }
    lines.push(line);
  } else if (data.overdueTasks > 0) {
    lines.push(`⚠️ ${data.overdueTasks} просроченных задач${data.overdueNames?.[0] ? ': «' + data.overdueNames[0] + '»' : ''}`);
  }

  for (const p of (data.upcomingPayments || [])) {
    const daysLeft = Math.max(0, Math.ceil(
      (new Date(p.next_payment_date) - Date.now()) / 86400000
    ));
    const amount = p.monthly_payment || p.min_payment || 0;
    lines.push(`💳 ${p.name}: ${fmtMoney(amount)} через ${daysLeft} дн`);
  }

  if (data.budgetUsedPercent > 75) {
    lines.push(`💰 Бюджет: ${data.budgetUsedPercent}% использовано`);
  }

  if (data.daysSinceWorkout >= 3 && data.daysSinceWorkout < 999) {
    lines.push(`🏋️ Тренировка ${data.daysSinceWorkout} дн назад`);
  }

  if (data.lastSleep && data.lastSleep.duration && data.lastSleep.duration < 6.5) {
    lines.push(`💤 Вчера: ${data.lastSleep.duration}ч сна (мало)`);
  }

  if (data.expiringDocs > 0) {
    lines.push(`📄 ${data.expiringDocs} документов скоро истекает`);
  }

  return lines;
}

// ═══ AI-обогащённый брифинг (~$0.003) ═══
export async function generateAIBriefing(data) {
  try {
    const { processInput } = await import('../ai/index');
    const context = JSON.stringify(data);
    const result = await processInput(
      `Сгенерируй утренний брифинг. Данные: ${context}. Кратко, 3-5 строк, с эмодзи, конкретные советы. Не выдумывай — только факты из данных.`
    );
    return result.message || null;
  } catch {
    return null;
  }
}

// ═══ Приветствие по времени дня ═══
export function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '🌙 Доброй ночи';
  if (h < 12) return '🌅 Доброе утро';
  if (h < 17) return '☀️ Добрый день';
  return '🌇 Добрый вечер';
}
