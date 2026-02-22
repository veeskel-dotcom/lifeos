import db from '../db/index';

// ═══ Собрать daily records за N дней ═══
export async function collectDailyRecords(days = 30) {
  const now = new Date();
  const startDate = new Date(now - days * 86400000).toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];
  const range = [startDate, endDate + '\uffff'];

  // 8 batch-запросов вместо 240 (30 дней × 8 запросов)
  const [allSleep, allMeals, allWorkouts, allTasks, allExpenses, allWeights, allWater, allMoods] = await Promise.all([
    db.sleep_log.where('date').between(...range).toArray().catch(() => []),
    db.food_log.where('date').between(...range).toArray().catch(() => []),
    db.workouts.where('date').between(...range).toArray().catch(() => []),
    db.tasks.toArray().catch(() => []), // один раз — фильтруем по completed_at
    db.expenses.where('date').between(...range).toArray().catch(() => []),
    db.body_weight.where('date').between(...range).toArray().catch(() => []),
    db.water_log.where('date').between(...range).toArray().catch(() => []),
    db.mood_log.where('date').between(...range).toArray().catch(() => []),
  ]);

  // Группировка по дате
  const groupBy = (arr) => {
    const map = {};
    arr.forEach(item => { (map[item.date] ??= []).push(item); });
    return map;
  };
  const sleepByDate = groupBy(allSleep);
  const mealsByDate = groupBy(allMeals);
  const workoutsByDate = groupBy(allWorkouts);
  const expensesByDate = groupBy(allExpenses);
  const weightByDate = groupBy(allWeights);
  const waterByDate = groupBy(allWater);
  const moodByDate = groupBy(allMoods);

  const records = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(now - i * 86400000).toISOString().split('T')[0];
    const sleep = sleepByDate[date]?.[0];
    const meals = mealsByDate[date] || [];
    const workouts = workoutsByDate[date] || [];
    const expenses = expensesByDate[date] || [];
    const weight = weightByDate[date]?.[0];
    const water = waterByDate[date] || [];
    const mood = moodByDate[date]?.[0];

    records.push({
      date,
      sleep_hours: sleep?.duration_hours || null,
      calories: meals.reduce((s, m) => s + (m.calories || m.total_calories || 0), 0) || null,
      protein_g: meals.reduce((s, m) => s + (m.protein || m.total_protein || 0), 0) || null,
      workout: workouts.length > 0,
      workout_type: workouts[0]?.type || null,
      tasks_completed: allTasks.filter(t => t.status === 'done' && t.completed_at?.startsWith(date)).length,
      expenses: expenses.reduce((s, e) => s + (e.amount_base || e.amount || 0), 0),
      weight_kg: weight?.weight || null,
      water_ml: water.reduce((s, w) => s + (w.amount_ml || 0), 0) || null,
      mood: mood?.value || mood?.score || null,
    });
  }

  return records.reverse(); // хронологический порядок
}

// ═══ Достаточно ли данных ═══
export function checkDataSufficiency(records) {
  const filled = {
    sleep: records.filter(r => r.sleep_hours != null).length,
    calories: records.filter(r => r.calories != null && r.calories > 0).length,
    workouts: records.filter(r => r.workout).length,
    expenses: records.filter(r => r.expenses > 0).length,
    mood: records.filter(r => r.mood != null).length,
    water: records.filter(r => r.water_ml != null && r.water_ml > 0).length,
  };

  const ready = filled.expenses >= 14 || filled.sleep >= 7 || filled.calories >= 7;

  return {
    ready,
    filled,
    message: !ready
      ? 'Нужно больше данных для анализа (мин. 2 недели расходов или 1 неделя сна/еды)'
      : 'Данных достаточно для анализа',
  };
}

// ═══ Кросс-модульный AI-анализ (~$0.005) ═══
export async function generateCrossAnalysis(days = 30) {
  const records = await collectDailyRecords(days);
  const sufficiency = checkDataSufficiency(records);

  if (!sufficiency.ready) {
    return { ready: false, message: sufficiency.message, filled: sufficiency.filled };
  }

  // Фильтруем записи с хоть какими-то данными
  const meaningful = records.filter(
    r => r.expenses > 0 || r.sleep_hours || r.workout || r.calories
  );

  try {
    const { callAI } = await import('../ai/client');

    const result = await callAI({
      prompt: `Проанализируй данные пользователя за ${days} дней.
Найди корреляции между модулями.
Выдай 3-5 КОНКРЕТНЫХ инсайтов с цифрами.
Формат: наблюдение + рекомендация. Одно предложение на каждое.
Не выдумывай — только то что видишь в данных.
Укажи размер выборки ("из N дней когда...").
Если выборка < 5 дней — пометь "предварительное наблюдение".
Минимальный эффект: разница > 20%.

Данные:
${JSON.stringify(meaningful)}`,
      model: 'reports',
      maxTokens: 1000,
      temperature: 0.3,
    });

    return { ready: true, insights: result.content, records: meaningful };
  } catch (err) {
    return { ready: true, insights: null, error: err.message };
  }
}

// ═══ Еженедельный отчёт (локальные агрегаты) ═══
export async function generateWeeklyReport() {
  try {
    const records = await collectDailyRecords(7);

    const withCalories = records.filter(r => r.calories && r.calories > 0);
    const withSleep = records.filter(r => r.sleep_hours != null);
    const withExpenses = records.filter(r => r.expenses > 0);

    const weights = records.filter(r => r.weight_kg != null);

    const report = {
      period: records.length > 0
        ? `${records[0]?.date} — ${records[records.length - 1]?.date}`
        : '',
      totalExpenses: withExpenses.reduce((s, r) => s + r.expenses, 0),
      avgDailyExpenses: withExpenses.length > 0
        ? Math.round(withExpenses.reduce((s, r) => s + r.expenses, 0) / withExpenses.length)
        : 0,
      tasksCompleted: records.reduce((s, r) => s + (r.tasks_completed || 0), 0),
      avgCalories: withCalories.length > 0
        ? Math.round(withCalories.reduce((s, r) => s + r.calories, 0) / withCalories.length)
        : 0,
      workouts: records.filter(r => r.workout).length,
      avgSleep: withSleep.length > 0
        ? +(withSleep.reduce((s, r) => s + r.sleep_hours, 0) / withSleep.length).toFixed(1)
        : 0,
      avgWater: records.filter(r => r.water_ml).length > 0
        ? Math.round(records.filter(r => r.water_ml).reduce((s, r) => s + r.water_ml, 0) / records.filter(r => r.water_ml).length)
        : 0,
      weightStart: weights.length > 0 ? weights[0].weight_kg : null,
      weightEnd: weights.length > 0 ? weights[weights.length - 1].weight_kg : null,
    };

    return report;

  } catch (e) {
    console.error('[crossAnalysis.generateWeeklyReport]', e);
    return null;
  }
}
