import db from './index';

// ═══ SETTINGS (key-value) ═══

export async function getSetting(key) {
  const row = await db.settings.get(key);
  return row?.value ?? null;
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

export async function getSettings(keys) {
  const rows = await db.settings.bulkGet(keys);
  return Object.fromEntries(rows.filter(Boolean).map(r => [r.key, r.value]));
}

// ═══ PROFILE ═══

export async function getProfile() {
  const row = await db.user_profile.get('profile');
  return row?.value ?? null;
}

export async function setProfile(data) {
  await db.user_profile.put({ key: 'profile', value: data });
}

// ═══ SECURITY LOG ═══

// Типы событий:
// 'pin_created', 'pin_changed', 'pin_success', 'pin_failed',
// 'pin_locked', 'faceid_success', 'faceid_failed',
// 'recovery_used', 'export_created', 'import_completed',
// 'app_opened', 'lock_timeout'

export async function logSecurityEvent(eventType, details = {}) {
  await db.security_log.add({
    ts: Date.now(),
    event_type: eventType,
    details,
    ip: null, // PWA — нет серверной стороны
  });
}

export async function getSecurityLog(limit = 50) {
  return db.security_log.orderBy('ts').reverse().limit(limit).toArray();
}

// ═══ CATEGORIES (seed) ═══

export async function seedCategories() {
  const count = await db.categories.count();
  if (count > 0) return; // уже заполнено

  const cats = [
    // Расходы (15)
    { module: 'expense', name: 'Еда', icon: '🍕', parent_id: null },
    { module: 'expense', name: 'Еда/Кофе', icon: '☕', parent_id: null },
    { module: 'expense', name: 'Еда/Продукты', icon: '🛒', parent_id: null },
    { module: 'expense', name: 'Еда/Доставка', icon: '🛵', parent_id: null },
    { module: 'expense', name: 'Транспорт', icon: '🚕', parent_id: null },
    { module: 'expense', name: 'Жильё', icon: '🏠', parent_id: null },
    { module: 'expense', name: 'Здоровье', icon: '💊', parent_id: null },
    { module: 'expense', name: 'Одежда', icon: '👕', parent_id: null },
    { module: 'expense', name: 'Развлечения', icon: '🎬', parent_id: null },
    { module: 'expense', name: 'Связь', icon: '📱', parent_id: null },
    { module: 'expense', name: 'Спорт', icon: '🏋️', parent_id: null },
    { module: 'expense', name: 'Образование', icon: '🎓', parent_id: null },
    { module: 'expense', name: 'Подарки', icon: '🎁', parent_id: null },
    { module: 'expense', name: 'Переводы', icon: '💸', parent_id: null },
    { module: 'expense', name: 'Прочее', icon: '📦', parent_id: null },
    // Доходы (5)
    { module: 'income', name: 'Зарплата', icon: '💼', parent_id: null },
    { module: 'income', name: 'Фриланс', icon: '💻', parent_id: null },
    { module: 'income', name: 'Дивиденды', icon: '📈', parent_id: null },
    { module: 'income', name: 'Кэшбэк', icon: '💰', parent_id: null },
    { module: 'income', name: 'Прочее', icon: '📦', parent_id: null },
  ];

  await db.categories.bulkAdd(cats);
}

// ═══ DEFAULT SETTINGS ═══

export async function seedDefaultSettings() {
  const defaults = {
    theme: 'system',
    default_currency: 'KZT',
    daily_calorie_goal: 2200,
    daily_water_goal: 2000,
    daily_protein_goal: 120,
    workout_days: ['mon', 'wed', 'fri'],
    briefing_mode: 'smart',
    modules_enabled: ['finance', 'tasks', 'food', 'sport'],
    lock_timeout_ms: 300000,
    has_completed_onboarding: false,
  };

  for (const [key, value] of Object.entries(defaults)) {
    const existing = await db.settings.get(key);
    if (!existing) {
      await db.settings.put({ key, value });
    }
  }
}

// ═══ ИНИЦИАЛИЗАЦИЯ ═══

export async function initializeDB() {
  // Делегируем seed.js (единственный источник правды для категорий и настроек)
  const { runSeeds } = await import('./seed');
  await runSeeds();
}
