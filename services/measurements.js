import db from '../db/index';

const METRICS = ['biceps', 'chest', 'waist', 'hips', 'thigh', 'calf'];
const LABELS = {
  biceps: 'Бицепс',
  chest: 'Грудь',
  waist: 'Талия',
  hips: 'Бёдра',
  thigh: 'Бедро',
  calf: 'Голень',
};

const COLORS = {
  biceps: '#FF3B30',
  chest: '#007AFF',
  waist: '#FF9500',
  hips: '#AF52DE',
  thigh: '#34C759',
  calf: '#5AC8FA',
};

export { METRICS, LABELS, COLORS };

export async function addMeasurement(data) {
  try {
    return db.body_measurements.add({
      date: data.date || new Date().toISOString().slice(0, 10),
      biceps: data.biceps || null,
      chest: data.chest || null,
      waist: data.waist || null,
      hips: data.hips || null,
      thigh: data.thigh || null,
      calf: data.calf || null,
      created_at: new Date().toISOString(),
    });
  } catch {
    return null;
  }
}

export async function getMeasurements(limit = 30) {
  try {
    return db.body_measurements.orderBy('date').reverse().limit(limit).toArray();
  } catch {
    return [];
  }
}

export async function getLatest() {
  try {
    return db.body_measurements.orderBy('date').reverse().first();
  } catch {
    return null;
  }
}

export async function getMeasurementTrend(metric, months = 3) {
  try {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const sinceStr = since.toISOString().slice(0, 10);

    const all = await db.body_measurements.where('date').above(sinceStr).toArray();
    return all
      .filter(m => m[metric] != null)
      .map(m => ({ date: m.date, value: m[metric] }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}
