import db from '../db/index';
import { getSetting, setSetting } from '../db/helpers';
import { emit } from './triggerBus';

export async function addWeight(date, weight, notes) {
  try {
    const existing = await db.body_weight.where('date').equals(date).first();
    if (existing) {
      await db.body_weight.update(existing.id, { weight, notes: notes || null });
      emit('weight_logged', { weight }).catch(() => {});
      return existing.id;
    }
    const id = await db.body_weight.add({
      date,
      weight,
      notes: notes || null,
      created_at: new Date().toISOString(),
    });
    emit('weight_logged', { weight }).catch(() => {});
    return id;

  } catch (e) {
    console.error('[bodyweight.addWeight]', e);
    throw e;
  }
}

export async function deleteWeight(id) {
  try {
    await db.body_weight.delete(id);
  } catch (e) {
    console.error('[bodyweight.deleteWeight]', e);
    throw e;
  }
}

export async function getWeights(days = 30) {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return db.body_weight.where('date').above(cutoffStr).sortBy('date');

  } catch (e) {
    console.error('[bodyweight.getWeights]', e);
    return [];
  }
}

export async function getAllWeights() {
  try {
    return db.body_weight.orderBy('date').toArray();

  } catch (e) {
    console.error('[bodyweight.getAllWeights]', e);
    return [];
  }
}

export async function getLatest() {
  try {
    const all = await db.body_weight.orderBy('date').reverse().limit(1).toArray();
    return all[0] || null;

  } catch (e) {
    console.error('[bodyweight.getLatest]', e);
    return [];
  }
}

export function getTrend(entries) {
  if (!entries || entries.length < 2) return null;
  const n = entries.length;
  const first = new Date(entries[0].date + 'T00:00:00').getTime();
  const xs = entries.map(e => (new Date(e.date + 'T00:00:00').getTime() - first) / (1000 * 60 * 60 * 24));
  const ys = entries.map(e => e.weight);

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumXX = xs.reduce((a, x) => a + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  if (isNaN(slope)) return null;

  return Math.round(slope * 7 * 100) / 100;
}

export async function getGoal() {
  try {
    return getSetting('weight_goal');

  } catch (e) {
    console.error('[bodyweight.getGoal]', e);
    return null;
  }
}

/* ═══ D3.3 — Цель по весу с прогнозом ═══ */

export async function setWeightGoal(kg) {
  try {
    return setSetting('target_weight', kg);

  } catch (e) {
    console.error('[bodyweight.setWeightGoal]', e);
    throw e;
  }
}

export async function getWeightGoal() {
  try {
    return getSetting('target_weight');

  } catch (e) {
    console.error('[bodyweight.getWeightGoal]', e);
    return null;
  }
}

export async function getWeightPrediction() {
  try {
    const goal = await getWeightGoal();
    if (!goal) return null;

    const weights = await getWeights(90);
    if (weights.length < 7) return null;

    const n = weights.length;
    const xs = weights.map((_, i) => i);
    const ys = weights.map(w => w.weight);
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
    const sumX2 = xs.reduce((s, x) => s + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const currentWeight = ys[ys.length - 1];
    const weeklyChange = Math.round(slope * 7 * 10) / 10;

    if (Math.abs(slope) < 0.001) return { daysToGoal: null, weeklyChange, message: 'Вес стабилен' };

    const daysToGoal = Math.round((goal - currentWeight) / slope);
    if (daysToGoal <= 0) return { daysToGoal: null, weeklyChange, message: 'Цель уже достигнута или тренд в другую сторону' };

    const predictedDate = new Date();
    predictedDate.setDate(predictedDate.getDate() + daysToGoal);

    return {
      daysToGoal,
      weeklyChange,
      predictedDate: predictedDate.toISOString().slice(0, 10),
      message: `При текущем темпе — через ${daysToGoal} дней (${predictedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })})`,
    };
  } catch {
    return null;
  }
}
