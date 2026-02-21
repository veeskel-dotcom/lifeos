// ═══════════════════════════════════════════
// LifeOS — Глобальные константы
// ═══════════════════════════════════════════

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
  { slug: 'google/gemini-2.5-flash',          label: 'Gemini 2.5 Flash',    short: 'Flash' },
  { slug: 'anthropic/claude-haiku-4.5',       label: 'Claude Haiku 4.5',    short: 'Haiku' },
  { slug: 'anthropic/claude-sonnet-4.6',      label: 'Claude Sonnet 4.6',   short: 'Sonnet' },
  { slug: 'anthropic/claude-opus-4.6',        label: 'Claude Opus 4.6',     short: 'Opus' },
];

// Задача → модель по умолчанию
export const MODEL_REGISTRY = {
  parsing:        'google/gemini-2.5-flash',
  analysis:       'anthropic/claude-opus-4.6',
  reports:        'anthropic/claude-sonnet-4.6',
  briefing:       'anthropic/claude-sonnet-4.6',
  ocr:            'anthropic/claude-sonnet-4.6',
  food_vision:    'anthropic/claude-sonnet-4.6',
  food_disambig:  'google/gemini-2.5-flash',
  video_analysis: 'anthropic/claude-sonnet-4.6',
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
  'google/gemini-2.5-flash':          { input: 0.30,  output: 2.50 },
  'anthropic/claude-haiku-4.5':       { input: 1.0,   output: 5.0 },
  'anthropic/claude-sonnet-4.6':      { input: 3.0,   output: 15.0 },
  'anthropic/claude-opus-4.6':        { input: 5.0,   output: 25.0 },
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

