import Dexie from 'dexie';

const db = new Dexie('LifeOS');

db.version(1).stores({
  // ═══ НАСТРОЙКИ И ПРОФИЛЬ ═══
  settings:           'key',
  user_profile:       'key',

  // ═══ ЭТАП 1: ФИНАНСЫ ═══
  expenses:           '++id, ts, date, category_id, account_id',
  incomes:            '++id, ts, date, category_id, account_id',
  accounts:           '++id, bank, type',
  credits:            '++id, type, next_payment_date',
  budgets:            '++id, month, category_id',
  categories:         '++id, module, parent_id',
  currencies:         'code, updated_at',

  // ═══ ЭТАП 2: ЗАДАЧИ И КАЛЕНДАРЬ ═══
  tasks:              '++id, status, deadline, priority, project_id, [status+deadline]',
  projects:           '++id, status',
  events:             '++id, date, type, [date+type]',
  reminders:          '++id, entity_type, entity_id, trigger_at',

  // ═══ ЭТАП 3: ЕДА ═══
  food_log:           '++id, date, meal_type',
  food_products:      '++id, barcode, *name_tokens, usage_count',
  food_dishes:        '++id, is_favorite',
  water_log:          '++id, date',
  shopping_list:      '++id, is_checked, category',

  // ═══ ЭТАП 4: СПОРТ ═══
  workouts:           '++id, date, template_id',
  exercises:          '++id, muscle_group, equipment',
  workout_templates:  '++id',
  body_weight:        '++id, date',
  sport_videos:       '++id, sport, created_at',

  // ═══ ЭТАП 5: ИНВЕСТИЦИИ ═══
  portfolio:          '++id, ticker, broker',
  quotes:             'ticker, updated_at',
  dividends:          '++id, ticker, ex_date',
  trades:             '++id, ticker, date, broker',

  // ═══ ЭТАП 6: БЫТ ═══
  routines:           '++id, type, frequency',
  routine_log:        '++id, routine_id, date, [routine_id+date]',
  subscriptions:      '++id, next_payment, category_id',
  notes:              '++id, created_at, *tags',
  mood_log:           '++id, date',
  documents:          '++id, type, expires_at',
  sleep_log:          '++id, date',

  // ═══ AI И СИСТЕМНЫЕ ═══
  ai_conversations:   '++id, session_id, created_at',
  ai_cache:           'key, expires_at',
  ai_corrections:     '++id, created_at',
  ai_auto_rules:      'input_pattern',
  security_log:       '++id, ts, event_type',
});

// Wave 2: обмеры тела
db.version(2).stores({
  body_measurements: '++id, date',
});

// Wave 7: фото прогресса + price alerts + goals
db.version(3).stores({
  progress_photos: '++id, date, category',
  price_alerts: '++id, ticker, direction',
  goals: '++id, type, status',
});

// Wave 8: ЖКХ утилиты
db.version(4).stores({
  utilities: '++id, month, meter_id, [month+meter_id]',
});

// Wave 9: error logging
db.version(5).stores({
  error_log: '++id, ts, level',
});

// Wave 10: AI память
db.version(6).stores({
  ai_memory: '++id, category, created_at',
});

export default db;
