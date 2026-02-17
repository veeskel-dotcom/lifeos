/**
 * water.js — CRUD water_log + прогресс
 * Таблица: water_log '++id, date'
 */
import db from '../db/index';
import { getSetting } from '../db/helpers';

export async function addWater(amount_ml = 250, date) {
  try {
    const d = date || new Date().toISOString().slice(0, 10);
    const time = new Date().toTimeString().slice(0, 5);

    const id = await db.water_log.add({
      date: d,
      amount_ml,
      time,
      created_at: new Date().toISOString(),
    });

    return { id, date: d, amount_ml, time };

  } catch (e) {
    console.error('[water.addWater]', e);
    throw e;
  }
}

export async function getWaterForDay(date) {
  try {
    const d = date || new Date().toISOString().slice(0, 10);
    const entries = await db.water_log.where('date').equals(d).toArray();
    const total = entries.reduce((s, e) => s + (e.amount_ml || 0), 0);
    return { entries: entries.sort((a, b) => a.time?.localeCompare(b.time || '')), total };

  } catch (e) {
    console.error('[water.getWaterForDay]', e);
    return [];
  }
}

export async function getWaterProgress(date) {
  try {
    const d = date || new Date().toISOString().slice(0, 10);
    const { total } = await getWaterForDay(d);
    const goal = (await getSetting('daily_water_goal')) || 2000;
    return {
      current: total,
      goal,
      percent: Math.min(Math.round((total / goal) * 100), 100),
    };

  } catch (e) {
    console.error('[water.getWaterProgress]', e);
    return [];
  }
}

export async function removeWaterEntry(id) {
  try {
    await db.water_log.delete(id);

  } catch (e) {
    console.error('[water.removeWaterEntry]', e);
    throw e;
  }
}

export async function getWeeklyWaterAvg() {
  try {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const entries = await db.water_log.where('date').equals(dt).toArray();
      const total = entries.reduce((s, e) => s + (e.amount_ml || 0), 0);
      if (total > 0) days.push(total);
    }
    if (days.length === 0) return 0;
    return Math.round(days.reduce((s, d) => s + d, 0) / days.length);

  } catch (e) {
    console.error('[water.getWeeklyWaterAvg]', e);
    return [];
  }
}

const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export async function getWeeklyWaterData() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(Date.now() - i * 86400000);
      const dateStr = dt.toISOString().slice(0, 10);
      const entries = await db.water_log.where('date').equals(dateStr).toArray();
      const total = entries.reduce((s, e) => s + (e.amount_ml || 0), 0);
      result.push({
        value: total,
        label: DAY_LABELS[dt.getDay()],
        isToday: dateStr === today,
      });
    }
    return result;
  } catch (e) {
    console.error('[water.getWeeklyWaterData]', e);
    return [];
  }
}
