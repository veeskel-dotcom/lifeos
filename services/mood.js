import db from '../db/index';

const MOOD_LEVELS = [
  { value: 1, emoji: '😫', label: 'Ужасно' },
  { value: 2, emoji: '😔', label: 'Плохо' },
  { value: 3, emoji: '😐', label: 'Нормально' },
  { value: 4, emoji: '🙂', label: 'Хорошо' },
  { value: 5, emoji: '😄', label: 'Отлично' },
];

export { MOOD_LEVELS };

export async function logMood(value, note = '') {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const existing = await db.mood_log.where('date').equals(date).first();
    if (existing) {
      return db.mood_log.update(existing.id, { value, note, updated_at: new Date().toISOString() });
    }
    return db.mood_log.add({
      date,
      value,
      note,
      created_at: new Date().toISOString(),
    });
  } catch {
    return null;
  }
}

export async function getMoodTrend(days = 30) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    const entries = await db.mood_log.where('date').above(sinceStr).toArray();
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

export async function getTodayMood() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    return db.mood_log.where('date').equals(today).first();
  } catch {
    return null;
  }
}

export async function getAverageMood(days = 7) {
  try {
    const trend = await getMoodTrend(days);
    if (trend.length === 0) return null;
    return Math.round(trend.reduce((s, m) => s + m.value, 0) / trend.length * 10) / 10;
  } catch {
    return null;
  }
}
