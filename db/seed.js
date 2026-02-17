import db from './index';

export async function seedCategories() {
  const count = await db.categories.count();
  if (count > 0) return;

  const EXPENSE_CATEGORIES = [
    { module: 'expense', name: 'Продукты', parent_id: null, icon: '🛒', color: '#34C759', sort_order: 1, is_system: true },
    { module: 'expense', name: 'Кафе и рестораны', parent_id: null, icon: '🍽️', color: '#FF9500', sort_order: 2, is_system: true },
    { module: 'expense', name: 'Транспорт', parent_id: null, icon: '🚗', color: '#007AFF', sort_order: 3, is_system: true },
    { module: 'expense', name: 'Жильё', parent_id: null, icon: '🏠', color: '#5856D6', sort_order: 4, is_system: true },
    { module: 'expense', name: 'ЖКХ', parent_id: null, icon: '🔧', color: '#8E8E93', sort_order: 5, is_system: true },
    { module: 'expense', name: 'Здоровье', parent_id: null, icon: '💊', color: '#FF2D55', sort_order: 6, is_system: true },
    { module: 'expense', name: 'Одежда', parent_id: null, icon: '👕', color: '#AF52DE', sort_order: 7, is_system: true },
    { module: 'expense', name: 'Развлечения', parent_id: null, icon: '🎬', color: '#FF3B30', sort_order: 8, is_system: true },
    { module: 'expense', name: 'Образование', parent_id: null, icon: '📚', color: '#5AC8FA', sort_order: 9, is_system: true },
    { module: 'expense', name: 'Связь', parent_id: null, icon: '📱', color: '#64D2FF', sort_order: 10, is_system: true },
    { module: 'expense', name: 'Подписки', parent_id: null, icon: '🔄', color: '#BF5AF2', sort_order: 11, is_system: true },
    { module: 'expense', name: 'Бытовое', parent_id: null, icon: '🧹', color: '#8E8E93', sort_order: 12, is_system: true },
    { module: 'expense', name: 'Переводы', parent_id: null, icon: '💸', color: '#30D158', sort_order: 13, is_system: true },
    { module: 'expense', name: 'Спорт', parent_id: null, icon: '🏋️', color: '#FF9F0A', sort_order: 14, is_system: true },
    { module: 'expense', name: 'Красота', parent_id: null, icon: '💅', color: '#FF375F', sort_order: 15, is_system: true },
    { module: 'expense', name: 'Авто', parent_id: null, icon: '⛽', color: '#FF6B35', sort_order: 16, is_system: true },
    { module: 'expense', name: 'Прочее', parent_id: null, icon: '📦', color: '#8E8E93', sort_order: 17, is_system: true },
  ];

  const INCOME_CATEGORIES = [
    { module: 'income', name: 'Зарплата', parent_id: null, icon: '💰', color: '#34C759', sort_order: 1, is_system: true },
    { module: 'income', name: 'Фриланс', parent_id: null, icon: '💻', color: '#007AFF', sort_order: 2, is_system: true },
    { module: 'income', name: 'Инвестиции', parent_id: null, icon: '📈', color: '#5856D6', sort_order: 3, is_system: true },
    { module: 'income', name: 'Подарки', parent_id: null, icon: '🎁', color: '#FF9500', sort_order: 4, is_system: true },
    { module: 'income', name: 'Прочее', parent_id: null, icon: '📦', color: '#8E8E93', sort_order: 5, is_system: true },
  ];

  const SUBSCRIPTION_CATEGORIES = [
    { module: 'subscriptions', name: 'Стриминг', parent_id: null, icon: '🎬', color: '#FF3B30', sort_order: 1, is_system: true },
    { module: 'subscriptions', name: 'Музыка', parent_id: null, icon: '🎵', color: '#FF2D55', sort_order: 2, is_system: true },
    { module: 'subscriptions', name: 'Софт', parent_id: null, icon: '💻', color: '#007AFF', sort_order: 3, is_system: true },
    { module: 'subscriptions', name: 'Спорт', parent_id: null, icon: '🏋️', color: '#FF9F0A', sort_order: 4, is_system: true },
    { module: 'subscriptions', name: 'Образование', parent_id: null, icon: '📚', color: '#5AC8FA', sort_order: 5, is_system: true },
    { module: 'subscriptions', name: 'Облако', parent_id: null, icon: '☁️', color: '#64D2FF', sort_order: 6, is_system: true },
    { module: 'subscriptions', name: 'Прочее', parent_id: null, icon: '📦', color: '#8E8E93', sort_order: 7, is_system: true },
  ];

  await db.categories.bulkAdd([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...SUBSCRIPTION_CATEGORIES]);
}

export async function seedDefaultSettings() {
  const defaults = [
    { key: 'theme', value: 'system' },
    { key: 'default_currency', value: 'KZT' },
    { key: 'daily_calorie_goal', value: 2200 },
    { key: 'daily_protein_goal', value: 120 },
    { key: 'daily_fat_goal', value: 80 },
    { key: 'daily_carbs_goal', value: 250 },
    { key: 'daily_water_goal', value: 2000 },
    { key: 'briefing_mode', value: 'smart' },
    { key: 'modules_enabled', value: ['finance', 'tasks', 'food', 'sport', 'invest'] },
    { key: 'lock_timeout_ms', value: 300000 },
    { key: 'rest_timer_seconds', value: 90 },
  ];

  for (const d of defaults) {
    const exists = await db.settings.get(d.key);
    if (!exists) await db.settings.put(d);
  }
}

export async function runSeeds() {
  await seedCategories();
  await seedMissingCategories();
  await seedDefaultSettings();
}

/**
 * R2.3: Добавить новые категории если у пользователя уже есть данные.
 */
async function seedMissingCategories() {
  const existing = await db.categories.toArray();
  const existingNames = new Set(existing.map(c => c.name));

  const newCats = [
    { module: 'expense', name: 'ЖКХ', icon: '🔧', color: '#8E8E93', sort_order: 5, is_system: true },
    { module: 'expense', name: 'Авто', icon: '⛽', color: '#FF6B35', sort_order: 16, is_system: true },
  ];

  const toAdd = newCats.filter(c => !existingNames.has(c.name)).map(c => ({ ...c, parent_id: null }));
  if (toAdd.length > 0) await db.categories.bulkAdd(toAdd);
}

/**
 * R2.4: Шаблоны подписок — пресеты для быстрого добавления.
 */
export const SUBSCRIPTION_PRESETS = [
  { name: 'YouTube Premium', price: 2990, currency: 'KZT', period: 'monthly', icon: '▶️' },
  { name: 'Spotify', price: 2490, currency: 'KZT', period: 'monthly', icon: '🎵' },
  { name: 'Netflix', price: 3990, currency: 'KZT', period: 'monthly', icon: '🎬' },
  { name: 'iCloud+ 50GB', price: 449, currency: 'KZT', period: 'monthly', icon: '☁️' },
  { name: 'iCloud+ 200GB', price: 1490, currency: 'KZT', period: 'monthly', icon: '☁️' },
  { name: 'Яндекс Плюс', price: 2990, currency: 'KZT', period: 'monthly', icon: '🟡' },
  { name: 'Telegram Premium', price: 1490, currency: 'KZT', period: 'monthly', icon: '✈️' },
  { name: 'ChatGPT Plus', price: 20, currency: 'USD', period: 'monthly', icon: '🤖' },
  { name: 'Claude Pro', price: 20, currency: 'USD', period: 'monthly', icon: '🧠' },
  { name: 'Фитнес клуб', price: 25000, currency: 'KZT', period: 'monthly', icon: '🏋️' },
  { name: 'VPN', price: 1500, currency: 'KZT', period: 'monthly', icon: '🔒' },
];
