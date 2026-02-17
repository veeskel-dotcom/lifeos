/**
 * demoSeed.js — Генератор демо-данных (30 дней).
 * Пользователь: Алексей, 28 лет, Алматы, KZT.
 * Все даты относительно today.
 */
import db from './index';

/* ─── HELPERS ─── */
function daysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().split('T')[0];
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max, dec = 1) {
  return +(min + Math.random() * (max - min)).toFixed(dec);
}

function pick(arr) {
  return arr[rand(0, arr.length - 1)];
}

function chance(pct) {
  return Math.random() < pct;
}

function dateISO(dStr, h = 12, m = 0) {
  return `${dStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/* ─── DATA PATTERNS ─── */
const EXPENSE_PATTERNS = [
  { category: 'Продукты', range: [800, 4000], freq: 0.8,
    descs: ['Магнум', 'Galmart', 'Small', 'Рынок', 'Арбуз'] },
  { category: 'Кафе и рестораны', range: [1500, 5000], freq: 0.4,
    descs: ['Starbucks', 'Paul', 'Del Papa', 'Wok&Go', 'Glovo доставка'] },
  { category: 'Транспорт', range: [300, 2000], freq: 0.5,
    descs: ['Яндекс Такси', '2GIS автобус', 'Бензин', 'InDrive'] },
  { category: 'Развлечения', range: [2000, 8000], freq: 0.15,
    descs: ['Кино Chaplin', 'Боулинг', 'Караоке', 'Концерт'] },
  { category: 'Одежда', range: [5000, 25000], freq: 0.07,
    descs: ['Zara', 'H&M', 'MEGA Park', 'Dostyk Plaza'] },
  { category: 'Спорт', range: [1500, 3000], freq: 0.1,
    descs: ['Протеин', 'Спортпит', 'Перчатки'] },
  { category: 'Здоровье', range: [3000, 15000], freq: 0.05,
    descs: ['Аптека', 'Анализы', 'Стоматолог'] },
  { category: 'Образование', range: [5000, 20000], freq: 0.03,
    descs: ['Udemy курс', 'Книга', 'Подписка Coursera'] },
  { category: 'Связь', range: [3000, 5000], freq: 0.03,
    descs: ['Beeline', 'Интернет Kcell'] },
  { category: 'Бытовое', range: [1000, 8000], freq: 0.07,
    descs: ['Средства для дома', 'Лампочки', 'Фильтр для воды'] },
];

const MEALS = {
  breakfast: [
    { name: 'Овсянка с бананом', calories: 350, protein: 12, fat: 8, carbs: 58, amount_g: 300 },
    { name: 'Яичница 3 яйца + тост', calories: 420, protein: 28, fat: 24, carbs: 22, amount_g: 250 },
    { name: 'Творог с мёдом', calories: 280, protein: 24, fat: 8, carbs: 30, amount_g: 200 },
    { name: 'Сырники', calories: 380, protein: 18, fat: 16, carbs: 40, amount_g: 220 },
  ],
  lunch: [
    { name: 'Плов', calories: 580, protein: 22, fat: 24, carbs: 68, amount_g: 350 },
    { name: 'Лагман', calories: 450, protein: 18, fat: 16, carbs: 55, amount_g: 400 },
    { name: 'Куриная грудка + гречка', calories: 380, protein: 35, fat: 6, carbs: 48, amount_g: 350 },
    { name: 'Бизнес-ланч', calories: 650, protein: 25, fat: 28, carbs: 72, amount_g: 450 },
    { name: 'Борщ + хлеб', calories: 420, protein: 16, fat: 14, carbs: 52, amount_g: 400 },
  ],
  dinner: [
    { name: 'Салат Цезарь', calories: 320, protein: 22, fat: 18, carbs: 16, amount_g: 280 },
    { name: 'Стейк + овощи', calories: 520, protein: 42, fat: 28, carbs: 12, amount_g: 350 },
    { name: 'Суп + хлеб', calories: 280, protein: 12, fat: 8, carbs: 38, amount_g: 400 },
    { name: 'Паста карбонара', calories: 480, protein: 20, fat: 22, carbs: 50, amount_g: 320 },
  ],
  snack: [
    { name: 'Протеин коктейль', calories: 180, protein: 30, fat: 3, carbs: 8, amount_g: 300 },
    { name: 'Банан + орехи', calories: 250, protein: 6, fat: 14, carbs: 30, amount_g: 120 },
    { name: 'Кофе латте', calories: 150, protein: 5, fat: 6, carbs: 18, amount_g: 350 },
    { name: 'Яблоко', calories: 80, protein: 0, fat: 0, carbs: 20, amount_g: 180 },
  ],
};

const WORKOUT_TEMPLATES = [
  {
    name: 'Грудь + трицепс', type: 'strength', duration_min: 55,
    exercises: [
      { name: 'Жим лёжа', sets: [{ reps: 10, weight: 70 }, { reps: 8, weight: 80 }, { reps: 6, weight: 85 }] },
      { name: 'Жим гантелей наклон', sets: [{ reps: 10, weight: 24 }, { reps: 10, weight: 26 }, { reps: 8, weight: 28 }] },
      { name: 'Разводка гантелей', sets: [{ reps: 12, weight: 14 }, { reps: 12, weight: 16 }] },
      { name: 'Французский жим', sets: [{ reps: 10, weight: 25 }, { reps: 10, weight: 30 }] },
    ],
  },
  {
    name: 'Спина + бицепс', type: 'strength', duration_min: 50,
    exercises: [
      { name: 'Тяга верхнего блока', sets: [{ reps: 10, weight: 55 }, { reps: 8, weight: 60 }, { reps: 8, weight: 65 }] },
      { name: 'Тяга гантели в наклоне', sets: [{ reps: 10, weight: 22 }, { reps: 10, weight: 24 }] },
      { name: 'Подъём штанги на бицепс', sets: [{ reps: 10, weight: 25 }, { reps: 8, weight: 30 }] },
    ],
  },
  {
    name: 'Ноги', type: 'strength', duration_min: 45,
    exercises: [
      { name: 'Приседания', sets: [{ reps: 10, weight: 70 }, { reps: 8, weight: 80 }, { reps: 6, weight: 90 }] },
      { name: 'Жим ногами', sets: [{ reps: 12, weight: 120 }, { reps: 10, weight: 140 }] },
      { name: 'Выпады', sets: [{ reps: 10, weight: 16 }, { reps: 10, weight: 18 }] },
    ],
  },
];

const TASK_LIST = [
  // done
  { title: 'Оплатить коммуналку', status: 'done', priority: 'high' },
  { title: 'Закончить отчёт Q4', status: 'done', priority: 'high' },
  { title: 'Сдать документы в банк', status: 'done', priority: 'medium' },
  { title: 'Записаться на ТО машины', status: 'done', priority: 'low' },
  { title: 'Заказать визитки', status: 'done', priority: 'low' },
  // overdue
  { title: 'Записаться к стоматологу', status: 'todo', priority: 'high', overdue: true },
  { title: 'Обновить резюме', status: 'todo', priority: 'medium', overdue: true },
  { title: 'Вернуть книгу Диме', status: 'todo', priority: 'low', overdue: true },
  // in_progress
  { title: 'Презентация для клиента', status: 'in_progress', priority: 'high', future: true },
  { title: 'Купить подарок маме', status: 'todo', priority: 'high', future: true },
  { title: 'Позвонить в банк', status: 'todo', priority: 'medium', future: true },
  { title: 'Забронировать отель', status: 'todo', priority: 'medium', future: true },
  { title: 'Пройти курс по React', status: 'in_progress', priority: 'low', future: true },
  // backlog
  { title: 'Разобрать гараж', status: 'todo', priority: 'low' },
  { title: 'Начать вести дневник', status: 'todo', priority: 'low' },
  { title: 'Изучить Rust', status: 'todo', priority: 'low' },
  { title: 'Организовать фотоархив', status: 'todo', priority: 'low' },
];

const SUBSCRIPTIONS = [
  { name: 'Spotify', amount: 199, next_day: 15, category_id: null },
  { name: 'Netflix', amount: 2500, next_day: 1, category_id: null },
  { name: 'iCloud+', amount: 449, next_day: 8, category_id: null },
  { name: 'YouTube Premium', amount: 1790, next_day: 20, category_id: null },
  { name: 'Тренажёрный зал', amount: 15000, next_day: 5, category_id: null },
];

const NOTES = [
  { title: 'Список целей на 2026', body: '1. Похудеть до 75кг\n2. Выучить Rust\n3. Накопить 2М₸\n4. Пробежать полумарафон\n5. Прочитать 24 книги', tags: ['цели'] },
  { title: 'Рецепт бешбармака', body: 'Мясо — 1.5кг баранины\nТесто — мука 500г, вода, яйцо\nЛук — 4 крупных\nВарить мясо 2.5 часа. Тесто раскатать тонко, нарезать ромбами.', tags: ['рецепты'] },
  { title: 'Идеи для side-project', body: '- Трекер привычек с AI\n- Telegram бот для учёта расходов\n- Калькулятор инвестиций MOEX', tags: ['работа'] },
  { title: 'Книги для чтения', body: '- Atomic Habits\n- Thinking, Fast and Slow\n- The Psychology of Money\n- Deep Work', tags: ['книги'] },
  { title: 'Фильмы на вечер', body: '- Оппенгеймер\n- Интерстеллар (пересмотр)\n- Дюна 2', tags: ['развлечения'] },
];

const DIARY_ENTRIES = [
  { mood: 7, body: 'Хороший день. Продуктивно поработал, вечером тренировка. Чувствую прогресс.' },
  { mood: 5, body: 'Устал. Много звонков, не успел поесть нормально. Надо лучше планировать.' },
  { mood: 8, body: 'Отличные выходные! Гулял по горам, свежий воздух. Нужно чаще выбираться.' },
];

const DOCUMENTS = [
  { name: 'Паспорт РК', type: 'passport', daysUntilExpiry: 730 },
  { name: 'Водительские права', type: 'license', daysUntilExpiry: 240 },
  { name: 'Страховка авто', type: 'insurance', daysUntilExpiry: 45 },
];

const PORTFOLIO = [
  { ticker: 'SBER', name: 'Сбербанк', quantity: 50, avg_price: 280, current: 295, broker: 'Freedom' },
  { ticker: 'GAZP', name: 'Газпром', quantity: 100, avg_price: 160, current: 155, broker: 'Freedom' },
  { ticker: 'LKOH', name: 'Лукойл', quantity: 5, avg_price: 6800, current: 7100, broker: 'Freedom' },
  { ticker: 'YNDX', name: 'Яндекс', quantity: 10, avg_price: 3200, current: 3450, broker: 'Freedom' },
];

/* ─── MAIN ─── */
export async function loadDemoData() {
  // Очистить все таблицы кроме settings и user_profile
  for (const table of db.tables) {
    if (table.name !== 'settings' && table.name !== 'user_profile') {
      await table.clear();
    }
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // ─── Settings ───
  const settings = [
    { key: 'monthly_budget', value: 350000 },
    { key: 'daily_calorie_goal', value: 2200 },
    { key: 'daily_protein_goal', value: 120 },
    { key: 'daily_water_goal', value: 2000 },
    { key: 'base_currency', value: 'KZT' },
    { key: 'user_name', value: 'Алексей' },
    { key: 'target_weight', value: 75 },
  ];
  await db.settings.bulkPut(settings);

  // ─── 1. Accounts ───
  await db.accounts.bulkAdd([
    { bank: 'Kaspi', type: 'debit', name: 'Каспи Gold', balance: 320000, currency: 'KZT' },
    { bank: 'Halyk', type: 'debit', name: 'Halyk карта', balance: 85000, currency: 'KZT' },
    { bank: 'cash', type: 'cash', name: 'Наличные', balance: 25000, currency: 'KZT' },
  ]);

  // ─── 2. Credits ───
  await db.credits.bulkAdd([{
    name: 'Кредитка Каспи',
    type: 'credit_card',
    limit: 500000,
    used: 120000,
    monthly_payment: 15000,
    next_payment_date: daysAgo(-5), // через 5 дней
    interest_rate: 24,
    currency: 'KZT',
  }]);

  // ─── 3. Expenses ───
  const expenses = [];
  for (let i = 29; i >= 0; i--) {
    const dateStr = daysAgo(i);
    for (const pattern of EXPENSE_PATTERNS) {
      if (chance(pattern.freq)) {
        expenses.push({
          date: dateStr,
          ts: dateISO(dateStr, rand(8, 22), rand(0, 59)),
          amount: rand(pattern.range[0], pattern.range[1]),
          amount_base: null,
          currency: 'KZT',
          category_id: null,
          category_name: pattern.category,
          description: pick(pattern.descs),
          account_id: rand(1, 2), // Каспи или Halyk
        });
      }
    }
  }
  if (expenses.length > 0) await db.expenses.bulkAdd(expenses);

  // ─── 4. Incomes ───
  const incomes = [];
  // Зарплата 5-го числа
  const thisMonth5 = todayStr.slice(0, 8) + '05';
  const prevMonth5 = (() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0].slice(0, 8) + '05';
  })();
  incomes.push({ date: prevMonth5, amount: 450000, source: 'Зарплата', account_id: 1, currency: 'KZT' });
  if (thisMonth5 <= todayStr) {
    incomes.push({ date: thisMonth5, amount: 450000, source: 'Зарплата', account_id: 1, currency: 'KZT' });
  }
  // Фриланс ~15-го (50%)
  if (chance(0.5)) {
    const freelanceDate = todayStr.slice(0, 8) + '15';
    if (freelanceDate <= todayStr) {
      incomes.push({ date: freelanceDate, amount: 80000, source: 'Фриланс', account_id: 2, currency: 'KZT' });
    }
  }
  await db.incomes.bulkAdd(incomes);

  // ─── 5. Tasks ───
  const tasks = TASK_LIST.map((t, idx) => {
    let deadline = null;
    if (t.status === 'done') {
      deadline = daysAgo(rand(5, 12));
    } else if (t.overdue) {
      deadline = daysAgo(rand(1, 7));
    } else if (t.future) {
      deadline = daysAgo(-rand(1, 10));
    }
    // else backlog — no deadline
    return {
      title: t.title,
      status: t.status,
      priority: t.priority,
      deadline,
      project_id: null,
      created_at: daysAgo(rand(15, 30)),
    };
  });
  await db.tasks.bulkAdd(tasks);

  // ─── 6. Food Log ───
  const foodLogs = [];
  for (let i = 29; i >= 0; i--) {
    if (!chance(0.85)) continue; // 85% дней
    const dateStr = daysAgo(i);
    const mealTypes = ['breakfast', 'lunch', 'dinner'];
    if (chance(0.6)) mealTypes.push('snack');
    if (chance(0.3)) mealTypes.push('snack');

    for (const meal of mealTypes) {
      const food = pick(MEALS[meal]);
      // Slight variation
      const factor = randFloat(0.8, 1.2);
      foodLogs.push({
        date: dateStr,
        meal,
        items: [{ name: food.name, amount_g: Math.round(food.amount_g * factor), ...food }],
        total_calories: Math.round(food.calories * factor),
        total_protein: Math.round(food.protein * factor),
        total_fat: Math.round(food.fat * factor),
        total_carbs: Math.round(food.carbs * factor),
      });
    }
  }
  await db.food_log.bulkAdd(foodLogs);

  // ─── 7. Water Log ───
  const waterLogs = [];
  const waterAmounts = [250, 250, 250, 350, 350, 500];
  for (let i = 29; i >= 0; i--) {
    if (!chance(0.85)) continue;
    const dateStr = daysAgo(i);
    const count = rand(3, 8);
    for (let j = 0; j < count; j++) {
      waterLogs.push({
        date: dateStr,
        amount_ml: pick(waterAmounts),
        time: dateISO(dateStr, rand(7, 22), rand(0, 59)),
      });
    }
  }
  await db.water_log.bulkAdd(waterLogs);

  // ─── 8. Workouts ───
  const workouts = [];
  let workoutIdx = 0;
  for (let i = 29; i >= 0; i--) {
    // Чередуем: тренировка, тренировка, отдых, тренировка, отдых...
    // ~3 тренировки на 7 дней
    if (i % 3 === 0 || i % 7 === 2) {
      const tmpl = WORKOUT_TEMPLATES[workoutIdx % 3];
      workoutIdx++;
      workouts.push({
        date: daysAgo(i),
        name: tmpl.name,
        type: tmpl.type,
        duration_min: tmpl.duration_min + rand(-5, 5),
        exercises: tmpl.exercises,
      });
    }
  }
  await db.workouts.bulkAdd(workouts);

  // ─── 9. Body Weight ───
  const weights = [];
  const startWeight = 79.5;
  const endWeight = 78.2;
  for (let i = 29; i >= 0; i--) {
    if (!chance(0.6)) continue; // ~18 записей
    const progress = (29 - i) / 29;
    const trend = startWeight - progress * (startWeight - endWeight);
    weights.push({
      date: daysAgo(i),
      weight: +( trend + randFloat(-0.3, 0.3) ).toFixed(1),
    });
  }
  await db.body_weight.bulkAdd(weights);

  // ─── 10. Sleep Log ───
  const sleepLogs = [];
  for (let i = 29; i >= 1; i--) {
    if (!chance(0.87)) continue;
    const bedHour = rand(22, 25); // 22:00 - 01:30
    const bedMin = rand(0, 59);
    const wakeHour = rand(6, 9);
    const wakeMin = rand(0, 59);

    const bedTotal = bedHour * 60 + bedMin;
    const wakeTotal = wakeHour * 60 + wakeMin;
    const durationMin = bedHour >= 24
      ? (24 * 60 - bedTotal + wakeTotal + 24 * 60) % (24 * 60)
      : wakeTotal + (24 * 60 - bedTotal);

    // Корреляция: поздний сон → качество ниже
    const baseQuality = bedHour >= 24 ? rand(4, 6) : bedHour >= 23 ? rand(5, 7) : rand(6, 9);

    sleepLogs.push({
      date: daysAgo(i),
      bed_time: `${String(bedHour % 24).padStart(2, '0')}:${String(bedMin).padStart(2, '0')}`,
      wake_time: `${String(wakeHour).padStart(2, '0')}:${String(wakeMin).padStart(2, '0')}`,
      duration_min: durationMin,
      quality: baseQuality,
    });
  }
  await db.sleep_log.bulkAdd(sleepLogs);

  // ─── 11. Routines + Routine Log ───
  const routineDefs = [
    { name: 'Зарядка', type: 'morning', frequency: 'daily', is_active: 1, completionRate: 0.7 },
    { name: 'Чтение 30 мин', type: 'evening', frequency: 'daily', is_active: 1, completionRate: 0.5 },
    { name: 'Уборка', type: 'evening', frequency: 'weekly', is_active: 1, completionRate: 0.75 },
  ];
  const routineIds = await Promise.all(
    routineDefs.map(r => db.routines.add({
      name: r.name, type: r.type, frequency: r.frequency, is_active: r.is_active,
    }))
  );

  const routineLogs = [];
  for (let i = 29; i >= 0; i--) {
    const dateStr = daysAgo(i);
    const dayOfWeek = new Date(Date.now() - i * 86400000).getDay();
    routineDefs.forEach((r, idx) => {
      if (r.frequency === 'weekly' && dayOfWeek !== 0) return; // воскресенье
      routineLogs.push({
        routine_id: routineIds[idx],
        date: dateStr,
        completed: chance(r.completionRate),
      });
    });
  }
  await db.routine_log.bulkAdd(routineLogs);

  // ─── 12. Subscriptions ───
  const now = new Date();
  const subData = SUBSCRIPTIONS.map(s => {
    // next_payment: ближайшая дата в будущем с нужным числом
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), s.next_day);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, s.next_day);
    const next = thisMonth >= now ? thisMonth : nextMonth;
    return {
      name: s.name,
      amount: s.amount,
      currency: 'KZT',
      frequency: 'monthly',
      next_payment: next.toISOString().split('T')[0],
      category_id: s.category_id,
    };
  });
  await db.subscriptions.bulkAdd(subData);

  // ─── 13. Notes + Mood ───
  const notes = NOTES.map((n, i) => ({
    title: n.title,
    body: n.body,
    tags: n.tags,
    type: 'note',
    created_at: daysAgo(rand(5, 28)),
  }));

  DIARY_ENTRIES.forEach((d, i) => {
    notes.push({
      title: `Дневник`,
      body: d.body,
      tags: ['дневник'],
      type: 'diary',
      mood: d.mood,
      created_at: daysAgo(rand(2, 20)),
    });
  });
  await db.notes.bulkAdd(notes);

  // ─── 14. Documents ───
  await db.documents.bulkAdd(DOCUMENTS.map(d => ({
    name: d.name,
    type: d.type,
    expires_at: daysAgo(-d.daysUntilExpiry),
    created_at: daysAgo(365),
  })));

  // ─── 15. Portfolio + Quotes + Trades ───
  const portfolioItems = PORTFOLIO.map(p => ({
    ticker: p.ticker,
    name: p.name,
    quantity: p.quantity,
    avg_price: p.avg_price,
    broker: p.broker,
    currency: 'RUB',
  }));
  await db.portfolio.bulkAdd(portfolioItems);

  // Quotes (текущие цены)
  await db.quotes.bulkPut(PORTFOLIO.map(p => ({
    ticker: p.ticker,
    price: p.current + randFloat(-5, 5),
    change_pct: randFloat(-2, 3),
    updated_at: new Date().toISOString(),
  })));

  // Trades
  const trades = [];
  for (const p of PORTFOLIO) {
    trades.push({
      ticker: p.ticker,
      date: daysAgo(rand(60, 90)),
      type: 'buy',
      quantity: Math.ceil(p.quantity * 0.6),
      price: p.avg_price - rand(5, 20),
      broker: p.broker,
    });
    trades.push({
      ticker: p.ticker,
      date: daysAgo(rand(20, 55)),
      type: 'buy',
      quantity: Math.floor(p.quantity * 0.4),
      price: p.avg_price + rand(0, 15),
      broker: p.broker,
    });
  }
  await db.trades.bulkAdd(trades);

  return {
    expenses: expenses.length,
    foodLogs: foodLogs.length,
    workouts: workouts.length,
    waterLogs: waterLogs.length,
    sleepLogs: sleepLogs.length,
    tasks: tasks.length,
  };
}
