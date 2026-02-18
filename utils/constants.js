// ═══════════════════════════════════════════
// LifeOS — Глобальные константы
// ═══════════════════════════════════════════

export const APP_VERSION = '0.1.0';
export const APP_NAME = 'LifeOS';
export const DB_NAME = 'lifeos';

// AI лимиты
export const AI_LIMITS = {
  daily_calls: 60,
  daily_cost_cap: 1.00,
  monthly_cost_cap: 15.00,
  cooldown_ms: 1000,
};

// ═══ AI модели ═══

// Доступные модели для UI
export const AVAILABLE_MODELS = [
  { slug: 'google/gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash', short: 'Flash' },
  { slug: 'anthropic/claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', short: 'Sonnet 4.5' },
  { slug: 'anthropic/claude-opus-4-20250514', label: 'Claude Opus 4', short: 'Opus 4' },
];

// Задача → модель по умолчанию
export const MODEL_REGISTRY = {
  parsing:        'google/gemini-2.5-flash-preview',
  analysis:       'anthropic/claude-opus-4-20250514',
  reports:        'anthropic/claude-sonnet-4-5-20250929',
  briefing:       'anthropic/claude-sonnet-4-5-20250929',
  ocr:            'anthropic/claude-sonnet-4-5-20250929',
  food_vision:    'anthropic/claude-sonnet-4-5-20250929',
  food_disambig:  'google/gemini-2.5-flash-preview',
  video_analysis: 'anthropic/claude-sonnet-4-5-20250929',
};

// Legacy маппинг (fast/smart → новые ключи)
export const LEGACY_MODEL_MAP = {
  fast: 'parsing',
  smart: 'analysis',
};

// Русские названия задач для UI
export const TASK_TYPE_LABELS = {
  parsing:        'Парсинг текста',
  analysis:       'Глубокий анализ',
  reports:        'Еженедельные отчёты',
  briefing:       'Утренний брифинг',
  ocr:            'OCR документов',
  food_vision:    'Распознавание еды',
  food_disambig:  'Уточнение продуктов',
  video_analysis: 'Видеоанализ техники',
};

// Тарифы моделей ($/1M токенов)
export const COST_RATES = {
  'google/gemini-2.5-flash-preview':       { input: 0.15, output: 0.60 },
  'anthropic/claude-sonnet-4-5-20250929':   { input: 3.0,  output: 15.0 },
  'anthropic/claude-opus-4-20250514':       { input: 15.0, output: 75.0 },
  'anthropic/claude-sonnet-4-20250514':     { input: 3.0,  output: 15.0 },
};

// Дефолты профиля
export const DEFAULTS = {
  currency: 'KZT',
  daily_calories: 2200,
  daily_protein: 120,
  daily_fat: 80,
  daily_carbs: 250,
  daily_water: 2000,
  workouts_per_week: 3,
  lock_timeout_ms: 300000,
  rest_timer_seconds: 90,
  briefing_mode: 'smart',
};

// Валюты
export const CURRENCIES = [
  { code: 'KZT', symbol: '₸', flag: '🇰🇿', name: 'Тенге' },
  { code: 'RUB', symbol: '₽', flag: '🇷🇺', name: 'Рубль' },
  { code: 'USD', symbol: '$', flag: '🇺🇸', name: 'Доллар' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺', name: 'Евро' },
];

// Shorthand для экранов, которым нужны только коды
export const CURRENCY_CODES = CURRENCIES.map(c => c.code);

// Категории расходов (иконки для UI)
export const EXPENSE_ICONS = {
  'Продукты': '🛒',
  'Кафе и рестораны': '🍽️',
  'Транспорт': '🚕',
  'Жильё': '🏠',
  'Здоровье': '💊',
  'Одежда': '👕',
  'Развлечения': '🎬',
  'Образование': '📚',
  'Связь': '📱',
  'Подписки': '🔄',
  'Бытовое': '🧹',
  'Переводы': '💸',
  'Спорт': '🏋️',
  'Красота': '💅',
  'Прочее': '📦',
};

// Мышечные группы (для спорта)
export const MUSCLE_GROUPS = ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки', 'Кор'];

// Типы документов
export const DOCUMENT_TYPES = [
  'Паспорт', 'Удостоверение', 'Водительские', 'Страховка',
  'Виза', 'Сертификат', 'Договор', 'Справка', 'Прочее',
];
