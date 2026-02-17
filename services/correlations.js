/**
 * Q2.2: Корреляции — поиск паттернов между модулями.
 * Анализирует связи: сон↔продуктивность, траты↔настроение, тренировки↔сон и т.д.
 */
import db from '../db/index';

/**
 * Основная функция: собрать данные за N дней и найти корреляции.
 */
export async function findCorrelations(days = 30) {
  const results = [];
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const start = startDate.toISOString().slice(0, 10);
  const end = endDate.toISOString().slice(0, 10);

  try {
    // Собираем дневные данные
    const dailyData = {};
    const dates = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      dates.push(ds);
      dailyData[ds] = {};
    }

    // Сон
    const sleepLogs = await db.sleep_log.where('date').between(start, end, true, true).toArray();
    for (const s of sleepLogs) {
      if (dailyData[s.date]) dailyData[s.date].sleep_hours = s.duration_hours || 0;
      if (dailyData[s.date]) dailyData[s.date].sleep_quality = s.quality || 0;
    }

    // Настроение
    const moods = await db.mood_log.where('date').between(start, end, true, true).toArray();
    for (const m of moods) {
      if (dailyData[m.date]) dailyData[m.date].mood = m.value || 0;
    }

    // Расходы
    const expenses = await db.expenses.where('date').between(start, end, true, true).toArray();
    const expByDate = {};
    for (const e of expenses) {
      expByDate[e.date] = (expByDate[e.date] || 0) + (e.amount || 0);
    }
    for (const [d, total] of Object.entries(expByDate)) {
      if (dailyData[d]) dailyData[d].spending = total;
    }

    // Тренировки
    const workouts = await db.workouts.where('date').between(start, end, true, true).toArray();
    for (const w of workouts) {
      if (dailyData[w.date]) dailyData[w.date].trained = 1;
    }

    // Задачи выполненные
    const tasks = await db.tasks.where('status').equals('done').toArray();
    for (const t of tasks) {
      const d = t.completed_at?.slice(0, 10) || t.deadline;
      if (d && dailyData[d]) dailyData[d].tasks_done = (dailyData[d].tasks_done || 0) + 1;
    }

    // Рутины
    const routineLogs = await db.routine_log.toArray();
    for (const r of routineLogs) {
      if (dailyData[r.date]) dailyData[r.date].routines_done = (dailyData[r.date].routines_done || 0) + 1;
    }

    // Калории
    const foodLogs = await db.food_log.where('date').between(start, end, true, true).toArray();
    for (const f of foodLogs) {
      if (!dailyData[f.date]) continue;
      const cals = (f.items || []).reduce((sum, item) => sum + (item.calories || 0), 0);
      dailyData[f.date].calories = (dailyData[f.date].calories || 0) + cals;
    }

    // Анализ корреляций
    const data = dates.map(d => dailyData[d]);

    // 1. Сон → Продуктивность
    const sleepProd = correlate(
      data.map(d => d.sleep_hours),
      data.map(d => d.tasks_done)
    );
    if (sleepProd !== null && Math.abs(sleepProd) > 0.3) {
      results.push({
        type: 'sleep_productivity',
        icon: '😴→✅',
        correlation: sleepProd,
        text: sleepProd > 0
          ? 'Больше сна = больше выполненных задач'
          : 'Мало спите, но больше делаете (осторожно — это не устойчиво)',
        strength: Math.abs(sleepProd),
      });
    }

    // 2. Тренировки → Настроение
    const trainMood = correlate(
      data.map(d => d.trained || 0),
      data.map(d => d.mood)
    );
    if (trainMood !== null && Math.abs(trainMood) > 0.2) {
      results.push({
        type: 'training_mood',
        icon: '🏋️→😊',
        correlation: trainMood,
        text: trainMood > 0
          ? 'В дни тренировок настроение лучше'
          : 'Тренировки пока не влияют на настроение',
        strength: Math.abs(trainMood),
      });
    }

    // 3. Сон → Настроение
    const sleepMood = correlate(
      data.map(d => d.sleep_hours),
      data.map(d => d.mood)
    );
    if (sleepMood !== null && Math.abs(sleepMood) > 0.3) {
      results.push({
        type: 'sleep_mood',
        icon: '😴→😊',
        correlation: sleepMood,
        text: sleepMood > 0
          ? 'Хороший сон = хорошее настроение'
          : 'Сон не влияет на настроение (редко)',
        strength: Math.abs(sleepMood),
      });
    }

    // 4. Траты → Настроение (emotional spending)
    const spendMood = correlate(
      data.map(d => d.spending),
      data.map(d => d.mood)
    );
    if (spendMood !== null && Math.abs(spendMood) > 0.25) {
      results.push({
        type: 'spending_mood',
        icon: '💸→😊',
        correlation: spendMood,
        text: spendMood > 0
          ? 'Тратите больше когда настроение хорошее (импульсные покупки?)'
          : 'Тратите больше в плохие дни (эмоциональные покупки)',
        strength: Math.abs(spendMood),
      });
    }

    // 5. Рутины → Продуктивность
    const routProd = correlate(
      data.map(d => d.routines_done),
      data.map(d => d.tasks_done)
    );
    if (routProd !== null && Math.abs(routProd) > 0.3) {
      results.push({
        type: 'routines_productivity',
        icon: '🔁→✅',
        correlation: routProd,
        text: routProd > 0
          ? 'Выполненные привычки коррелируют с продуктивностью'
          : 'Рутины отнимают время от задач',
        strength: Math.abs(routProd),
      });
    }

    // 6. Тренировки → Сон
    const trainSleep = correlate(
      data.map(d => d.trained || 0),
      data.map(d => d.sleep_quality)
    );
    if (trainSleep !== null && Math.abs(trainSleep) > 0.2) {
      results.push({
        type: 'training_sleep',
        icon: '🏋️→😴',
        correlation: trainSleep,
        text: trainSleep > 0
          ? 'Тренировки улучшают качество сна'
          : 'Тренировки мешают сну (возможно, слишком поздно)',
        strength: Math.abs(trainSleep),
      });
    }

    // Сортировка по силе
    results.sort((a, b) => b.strength - a.strength);

  } catch (e) {
    console.error('[correlations]', e);
  }

  return results;
}

/**
 * Коэффициент корреляции Пирсона.
 * Возвращает null если недостаточно данных.
 */
function correlate(xs, ys) {
  // Фильтруем пары где оба значения определены
  const pairs = [];
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] != null && ys[i] != null && !isNaN(xs[i]) && !isNaN(ys[i])) {
      pairs.push([xs[i], ys[i]]);
    }
  }

  if (pairs.length < 7) return null; // минимум неделя данных

  const n = pairs.length;
  const sumX = pairs.reduce((s, p) => s + p[0], 0);
  const sumY = pairs.reduce((s, p) => s + p[1], 0);
  const sumXY = pairs.reduce((s, p) => s + p[0] * p[1], 0);
  const sumX2 = pairs.reduce((s, p) => s + p[0] * p[0], 0);
  const sumY2 = pairs.reduce((s, p) => s + p[1] * p[1], 0);

  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denom === 0) return null;

  return (n * sumXY - sumX * sumY) / denom;
}
