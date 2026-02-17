// ═══════════════════════════════════════════
// LifeOS — Глобальные константы
// ═══════════════════════════════════════════

export const APP_VERSION = '0.1.0';
export const APP_NAME = 'LifeOS';
export const DB_NAME = 'lifeos';

// AI лимиты
export const AI_LIMITS = {
  daily_calls: 60,
  daily_cost_cap: 0.50,
  monthly_cost_cap: 10.00,
  cooldown_ms: 1000,
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
