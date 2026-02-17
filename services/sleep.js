import db from '../db/index';
import { getSetting } from '../db/helpers';
import { emit } from './triggerBus';

/* ── CRUD ── */

export async function addSleep(data) {
  try {
    const bed = new Date(data.bedtime);
    const wake = new Date(data.waketime);
    const duration_hours = Math.round((wake - bed) / 3600000 * 10) / 10;

    const id = await db.sleep_log.add({
      ...data,
      duration_hours,
      date: data.date || wake.toISOString().slice(0, 10),
    });
    emit('sleep_logged', { duration_hours, quality: data.quality }).catch(() => {});
    return id;

  } catch (e) {
    console.error('[sleep.addSleep]', e);
    throw e;
  }
}

export async function getSleep(date) {
  try {
    return db.sleep_log.where('date').equals(date).first();

  } catch (e) {
    console.error('[sleep.getSleep]', e);
    return null;
  }
}

export async function updateSleep(id, data) {
  try {
    if (data.bedtime && data.waketime) {
      const bed = new Date(data.bedtime);
      const wake = new Date(data.waketime);
      data.duration_hours = Math.round((wake - bed) / 3600000 * 10) / 10;
    }
    return db.sleep_log.update(id, data);

  } catch (e) {
    console.error('[sleep.updateSleep]', e);
    throw e;
  }
}

export async function deleteSleep(id) {
  try {
    return db.sleep_log.delete(id);

  } catch (e) {
    console.error('[sleep.deleteSleep]', e);
    throw e;
  }
}

/* ── Week data (7 days) ── */

export async function getWeekData() {
  try {
    const results = [];
    const d = new Date();
    const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(d);
      date.setDate(d.getDate() - i);
      const ds = date.toISOString().slice(0, 10);
      const entry = await getSleep(ds);
      results.push({
        date: ds,
        day: DAYS[date.getDay()],
        duration: entry?.duration_hours || 0,
        quality: entry?.quality || 0,
      });
    }
    return results;

  } catch (e) {
    console.error('[sleep.getWeekData]', e);
    return null;
  }
}

/* ── Monthly avg ── */

export async function getMonthlyAvg() {
  try {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const since = d.toISOString().slice(0, 10);
    const logs = await db.sleep_log.where('date').above(since).toArray();

    if (!logs.length) return null;

    const avg = logs.reduce((s, l) => s + (l.duration_hours || 0), 0) / logs.length;
    const avgQ = logs.reduce((s, l) => s + (l.quality || 0), 0) / logs.length;

    return {
      avgDuration: Math.round(avg * 10) / 10,
      avgQuality: Math.round(avgQ * 10) / 10,
      count: logs.length,
    };

  } catch (e) {
    console.error('[sleep.getMonthlyAvg]', e);
    return [];
  }
}

/* ── getTrend — 30-day summary ── */

export async function getTrend() {
  try {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const since = d.toISOString().slice(0, 10);
    const logs = await db.sleep_log.where('date').above(since).toArray();

    if (!logs.length) return null;

    const avgDuration = logs.reduce((s, l) => s + (l.duration_hours || 0), 0) / logs.length;
    const avgQuality = logs.reduce((s, l) => s + (l.quality || 0), 0) / logs.length;

    const bedMinutes = logs.filter(l => l.bedtime).map(l => {
      const bd = new Date(l.bedtime);
      let mins = bd.getHours() * 60 + bd.getMinutes();
      if (mins < 720) mins += 1440; // before noon = after midnight
      return mins;
    });

    const avgBedMin = bedMinutes.length
      ? bedMinutes.reduce((s, m) => s + m, 0) / bedMinutes.length
      : null;
    const avgBedTime = avgBedMin
      ? `${Math.floor((avgBedMin % 1440) / 60).toString().padStart(2, '0')}:${Math.floor(avgBedMin % 60).toString().padStart(2, '0')}`
      : null;

    return {
      avgDuration: Math.round(avgDuration * 10) / 10,
      avgQuality: Math.round(avgQuality * 10) / 10,
      avgBedTime,
      count: logs.length,
    };

  } catch (e) {
    console.error('[sleep.getTrend]', e);
    return [];
  }
}

/* ── getMonthData — 30 points for existing LineChart ── */

export async function getMonthData() {
  try {
    const result = [];
    const d = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(d);
      date.setDate(d.getDate() - i);
      const ds = date.toISOString().slice(0, 10);
      const entry = await getSleep(ds);
      result.push({
        date: ds,
        label: date.getDate(),
        duration: entry?.duration_hours || 0,
        quality: entry?.quality || 0,
      });
    }
    return result;

  } catch (e) {
    console.error('[sleep.getMonthData]', e);
    return null;
  }
}

/* ── H1 — getSleepTrend (30-day points for LineChart with null gaps) ── */

export async function getSleepTrend(days = 30) {
  try {
    const today = new Date();
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const entry = await db.sleep_log.where('date').equals(dateStr).first();
      result.push({
        date: dateStr,
        label: d.getDate().toString(),
        hours: entry?.duration_hours ?? null,
      });
    }
    return result;

  } catch (e) {
    console.error('[sleep.getSleepTrend]', e);
    return null;
  }
}

/* ── H2 — getSleepAverage (avg vs goal with diff) ── */

export async function getSleepAverage(days = 7) {
  try {
    const goal = (await getSetting('sleep_target_hours')) || 8;
    const trend = await getSleepTrend(days);
    const withData = trend.filter(d => d.hours != null);
    const avg = withData.length > 0
      ? withData.reduce((s, d) => s + d.hours, 0) / withData.length
      : 0;
    return {
      average: Math.round(avg * 10) / 10,
      goal,
      diff: Math.round((avg - goal) * 10) / 10,
      daysTracked: withData.length,
      totalDays: days,
    };

  } catch (e) {
    console.error('[sleep.getSleepAverage]', e);
    return null;
  }
}

/* ── H3 — getBedtimeRecommendation (рекомендация времени отхода ко сну) ── */

export async function getBedtimeRecommendation() {
  try {
    const goal = Number((await getSetting('sleep_target_hours')) || 8);
    const since = new Date();
    since.setDate(since.getDate() - 14);

    const logs = await db.sleep_log
      .where('date').above(since.toISOString().slice(0, 10))
      .toArray();

    const wakeMinutes = logs
      .filter(l => l.waketime)
      .map(l => {
        const w = new Date(l.waketime);
        return w.getHours() * 60 + w.getMinutes();
      });

    if (wakeMinutes.length < 3) {
      return { bedtime: null, wakeAvg: null, message: 'Недостаточно данных (нужно 3+ записей)' };
    }

    const avgWake = Math.round(wakeMinutes.reduce((a, b) => a + b, 0) / wakeMinutes.length);
    const bedMinutes = avgWake - goal * 60 - 15; // 15 min to fall asleep
    const normalizedBed = bedMinutes < 0 ? bedMinutes + 1440 : bedMinutes;

    const bedH = Math.floor(normalizedBed / 60);
    const bedM = normalizedBed % 60;
    const wakeH = Math.floor(avgWake / 60);
    const wakeM = avgWake % 60;

    const fmt = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    return {
      bedtime: fmt(bedH, bedM),
      wakeAvg: fmt(wakeH, wakeM),
      goalHours: goal,
      message: `Ложись в ${fmt(bedH, bedM)} чтобы спать ${goal}ч (подъём ~${fmt(wakeH, wakeM)})`,
    };

  } catch (e) {
    console.error('[sleep.getBedtimeRecommendation]', e);
    return [];
  }
}

/**
 * Последняя запись сна (для виджетов и сводок).
 * @returns {Promise<Object|null>}
 */
export async function getLatestSleep() {
  try {
    return (await db.sleep_log.orderBy('date').reverse().first()) || null;
  } catch (e) {
    console.error('[sleep.getLatestSleep]', e);
    return null;
  }
}
