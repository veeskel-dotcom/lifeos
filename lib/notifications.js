/**
 * notifications.js — In-App триггеры для toast-уведомлений.
 * Вызывается при открытии приложения.
 *
 * 7 триггеров:
 * 1. Просроченные задачи
 * 2. Платежи по кредитам (3 дня)
 * 3. Бюджет >80%
 * 4. Мало воды (после 18:00)
 * 5. Давно не тренировался (3+ дней)
 * 6. Документы истекают (<30 дней)
 * 7. Подписки: списание (3 дня)
 */
import db from '../db/index';
import { getSetting } from '../db/helpers';

export async function checkNotificationTriggers() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const hour = now.getHours();
  const notifications = [];

  // 1. Просроченные задачи
  try {
    const overdue = await db.tasks
      .where('deadline')
      .below(today)
      .filter((t) => t.status !== 'done' && t.status !== 'cancelled')
      .count();
    if (overdue > 0) {
      notifications.push({
        type: 'warning',
        icon: '⚠️',
        text: `${overdue} просроченных задач`,
        route: 'tasks',
      });
    }
  } catch {}

  // 2. Платежи по кредитам в ближайшие 3 дня
  try {
    const threeDays = new Date(now.getTime() + 3 * 86400000)
      .toISOString()
      .split('T')[0];
    const payments = await db.credits
      .where('next_payment_date')
      .between(today, threeDays, true, true)
      .toArray();
    for (const p of payments) {
      const daysLeft = Math.ceil(
        (new Date(p.next_payment_date) - now) / 86400000
      );
      notifications.push({
        type: 'info',
        icon: '💳',
        text: `${p.name}: платёж через ${daysLeft} дн`,
        route: 'finance',
      });
    }
  } catch {}

  // 3. Бюджет >80%
  try {
    const budgetSetting = await getSetting('monthly_budget');
    if (budgetSetting) {
      const monthStart = today.slice(0, 8) + '01';
      const expenses = await db.expenses
        .where('date')
        .between(monthStart, today, true, true)
        .toArray();
      const spent = expenses.reduce(
        (s, e) => s + (e.amount_base || e.amount || 0),
        0
      );
      const percent = Math.round((spent / budgetSetting) * 100);
      if (percent > 80) {
        const remaining = budgetSetting - spent;
        notifications.push({
          type: percent > 95 ? 'danger' : 'warning',
          icon: '💰',
          text: `Бюджет ${percent}% — осталось ${Math.round(remaining).toLocaleString()}₸`,
          route: 'finance',
        });
      }
    }
  } catch {}

  // 4. Мало воды (после 18:00)
  if (hour >= 18) {
    try {
      const waterLogs = await db.water_log
        .where('date')
        .equals(today)
        .toArray();
      const waterTotal = waterLogs.reduce(
        (s, w) => s + (w.amount_ml || 0),
        0
      );
      const waterGoal = (await getSetting('daily_water_goal')) || 2000;
      if (waterTotal < waterGoal * 0.5) {
        notifications.push({
          type: 'info',
          icon: '💧',
          text: `Вода: ${waterTotal}/${waterGoal} мл`,
          action: 'log_water',
        });
      }
    } catch {}
  }

  // 5. Давно не тренировался (3+ дней)
  try {
    const lastWorkout = await db.workouts.orderBy('date').reverse().first();
    if (lastWorkout) {
      const daysSince = Math.floor(
        (now - new Date(lastWorkout.date)) / 86400000
      );
      if (daysSince >= 3) {
        notifications.push({
          type: 'info',
          icon: '🏋️',
          text: `Тренировка ${daysSince} дн назад`,
          route: 'sport',
        });
      }
    }
  } catch {}

  // 6. Документы истекают (<30 дней)
  try {
    const thirtyDays = new Date(now.getTime() + 30 * 86400000)
      .toISOString()
      .split('T')[0];
    const expiring = await db.documents
      .where('expires_at')
      .between(today, thirtyDays, true, true)
      .toArray();
    for (const doc of expiring) {
      const daysLeft = Math.ceil(
        (new Date(doc.expires_at) - now) / 86400000
      );
      notifications.push({
        type: daysLeft <= 7 ? 'danger' : 'warning',
        icon: '📄',
        text: `${doc.name || 'Документ'} истекает через ${daysLeft} дн`,
        route: 'documents',
      });
    }
  } catch {}

  // 7. Подписки: списание в ближайшие 3 дня
  try {
    const threeDays = new Date(now.getTime() + 3 * 86400000)
      .toISOString()
      .split('T')[0];
    const subs = await db.subscriptions
      .where('next_payment')
      .between(today, threeDays, true, true)
      .toArray();
    for (const s of subs) {
      notifications.push({
        type: 'info',
        icon: '🔄',
        text: `${s.name}: ${s.amount}₸ скоро`,
        route: 'subscriptions',
      });
    }
  } catch {}

  return notifications;
}
