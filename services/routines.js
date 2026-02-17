import db from '../db/index';

const today = () => new Date().toISOString().slice(0, 10);

// T1 FIX: ISO day-of-week: 1=Пн … 7=Вс (совпадает с RoutineForm)
const dayOfWeek = () => {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
};

/* ═══ CRUD ═══ */

export async function addRoutine(data) {
  try {
    return db.routines.add({
      ...data,
      streak: 0,
      best_streak: 0,
      is_active: true,
      freeze_available: data.freeze_available ?? 1,
      freeze_used: 0,
    });

  } catch (e) {
    console.error('[routines.addRoutine]', e);
    throw e;
  }
}

export async function getRoutines() {
  try {
    const all = await db.routines.toArray();
    return all.filter((x) => x.is_active !== false);

  } catch (e) {
    console.error('[routines.getRoutines]', e);
    return [];
  }
}

export async function updateRoutine(id, data) {
  try {
    return db.routines.update(id, data);

  } catch (e) {
    console.error('[routines.updateRoutine]', e);
    throw e;
  }
}

export async function deleteRoutine(id) {
  try {
    return db.routines.update(id, { is_active: false });

  } catch (e) {
    console.error('[routines.deleteRoutine]', e);
    throw e;
  }
}

export async function restoreRoutine(id) {
  try {
    return db.routines.update(id, { is_active: true, streak: 0 });

  } catch (e) {
    console.error('[routines.restoreRoutine]', e);
    throw e;
  }
}

export async function getArchivedRoutines() {
  try {
    const all = await db.routines.toArray();
    return all.filter((x) => x.is_active === false);

  } catch (e) {
    console.error('[routines.getArchivedRoutines]', e);
    return [];
  }
}

/* ═══ TODAY ROUTINES ═══ */

export async function getTodayRoutines() {
  try {
    const all = await getRoutines();
    const dow = dayOfWeek();
    const dom = new Date().getDate();

    return all.filter((r) => {
      if (r.frequency === 'daily') return true;
      if (r.frequency === 'weekly') return r.days?.includes(dow);
      if (r.frequency === 'monthly') return r.days?.includes(dom);
      // T1 FIX: custom с interval_days — проверяем реально
      if (r.frequency === 'custom' && r.interval_days) {
        const created = r.created_at ? new Date(r.created_at) : null;
        if (!created) return true;
        const diff = Math.floor((Date.now() - created.getTime()) / 86400000);
        return diff % r.interval_days === 0;
      }
      return false;
    });

  } catch (e) {
    console.error('[routines.getTodayRoutines]', e);
    return [];
  }
}

/* ═══ MILESTONES ═══ */

function checkMilestone(newStreak, oldStreak) {
  const MILESTONES = [7, 14, 30, 60, 100, 365];
  return MILESTONES.find((m) => newStreak >= m && oldStreak < m) || null;
}

/* ═══ TOGGLE ═══ */

export async function toggleRoutine(routineId, date = today()) {
  try {
    const existing = await db.routine_log
      .where('[routine_id+date]')
      .equals([routineId, date])
      .first()
      .catch(() =>
        db.routine_log
          .where('routine_id')
          .equals(routineId)
          .filter((l) => l.date === date)
          .first()
      );

    if (existing) {
      await db.routine_log.delete(existing.id);
      const streak = await calcStreak(routineId);
      await db.routines.update(routineId, { streak });
      return { completed: false, milestone: null };
    } else {
      await db.routine_log.add({
        routine_id: routineId,
        date,
        completed: true,
        completed_at: new Date().toISOString(),
      });
      const routine = await db.routines.get(routineId);
      const oldStreak = routine?.streak || 0;
      const streak = await calcStreak(routineId);
      const best = Math.max(streak, routine?.best_streak || 0);
      await db.routines.update(routineId, { streak, best_streak: best });
      const milestone = checkMilestone(streak, oldStreak);
      return { completed: true, milestone };
    }

  } catch (e) {
    console.error('[routines.toggleRoutine]', e);
    throw e;
  }
}

/* ═══ SHOULD HAVE BEEN DONE ═══ */

// T1 FIX: ISO dow для shouldHaveBeenDone
function shouldHaveBeenDone(routine, date) {
  if (!routine) return true;
  if (routine.frequency === 'daily') return true;
  if (routine.frequency === 'weekly') {
    const rawDow = date.getDay();
    const dow = rawDow === 0 ? 7 : rawDow; // 1=Пн…7=Вс
    return routine.days?.includes(dow) ?? false;
  }
  if (routine.frequency === 'monthly') {
    return routine.days?.includes(date.getDate()) ?? false;
  }
  return true;
}

/* ═══ CALC STREAK ═══ */

async function calcStreak(routineId) {
  const routine = await db.routines.get(routineId);
  const freezeMax = routine?.freeze_available ?? 1;
  const logs = await db.routine_log
    .where('routine_id')
    .equals(routineId)
    .toArray();
  const dates = new Set(logs.filter((l) => l.completed).map((l) => l.date));

  let streak = 0;
  let freezeUsed = 0;
  const d = new Date();
  // T1 FIX: safety limit — max 400 iterations
  const MAX_ITER = 400;
  let iter = 0;

  while (iter++ < MAX_ITER) {
    const ds = d.toISOString().slice(0, 10);
    if (dates.has(ds)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (shouldHaveBeenDone(routine, d)) {
      if (freezeUsed < freezeMax) {
        freezeUsed++;
        // streak freeze — не прибавляем, не ломаем
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    } else {
      d.setDate(d.getDate() - 1);
      continue;
    }
  }
  return streak;
}

export async function getStreak(routineId) {
  try {
    return calcStreak(routineId);

  } catch (e) {
    console.error('[routines.getStreak]', e);
    return null;
  }
}

/* ═══ HEATMAP ═══ */

export async function getHeatmapData(yearMonth) {
  try {
    const month = yearMonth || today().slice(0, 7);
    const logs = await db.routine_log.where('date').startsWith(month).toArray();
    const routines = await getTodayRoutines();
    const totalRoutines = routines.length || 1;
    const map = {};
    logs.forEach((l) => {
      if (!l.completed) return;
      map[l.date] = (map[l.date] || 0) + 1;
    });
    return Object.entries(map).map(([date, count]) => ({
      date,
      percent: Math.min(count / totalRoutines, 1),
    }));

  } catch (e) {
    console.error('[routines.getHeatmapData]', e);
    return [];
  }
}

/* ═══ DAILY COMPLETION ═══ */

export async function getDailyCompletion(date = today()) {
  try {
    const routines = await getTodayRoutines();
    const logs = await db.routine_log.where('date').equals(date).toArray();
    const completedIds = new Set(
      logs.filter((l) => l.completed).map((l) => l.routine_id)
    );
    const completed = routines.filter((r) => completedIds.has(r.id)).length;
    return {
      total: routines.length,
      completed,
      percent: routines.length ? completed / routines.length : 0,
    };

  } catch (e) {
    console.error('[routines.getDailyCompletion]', e);
    return [];
  }
}

/* ═══ BATCH: daily stats for Dashboard (avoids N+1) ═══ */

export async function getRoutinesDailyStats() {
  try {
    const todayDate = today();
    const routines = await getRoutines();
    const active = routines.filter((r) => r.is_active !== false);
    if (active.length === 0) return null;

    const logs = await db.routine_log.where('date').equals(todayDate).toArray();
    const completedSet = new Set(
      logs.filter((l) => l.completed).map((l) => l.routine_id)
    );

    const items = active.slice(0, 4).map((r) => ({
      name: r.name,
      done: completedSet.has(r.id),
    }));

    const completed = active.filter((r) => completedSet.has(r.id)).length;
    const pct = active.length > 0 ? Math.round((completed / active.length) * 100) : 0;

    return {
      total: active.length,
      completed,
      items,
      pct,
    };

  } catch (e) {
    console.error('[routines.getRoutinesDailyStats]', e);
    return [];
  }
}

export async function getRoutineLog(routineId, date) {
  try {
    return db.routine_log
      .where('routine_id')
      .equals(routineId)
      .filter((l) => l.date === date)
      .first();

  } catch (e) {
    console.error('[routines.getRoutineLog]', e);
    return null;
  }
}

/* ── F3 — getOverdueRoutines (time-based reminders) ── */
export async function getOverdueRoutines() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const todayRoutines = await getTodayRoutines();
    const overdue = [];

    for (const r of todayRoutines) {
      if (!r.time) continue;
      const [h, m] = r.time.split(':').map(Number);
      const routineMin = h * 60 + m;
      if (routineMin > nowMin) continue; // not yet due
      const log = await getRoutineLog(r.id, today);
      if (!log?.completed) overdue.push(r);
    }
    return overdue;

  } catch (e) {
    console.error('[routines.getOverdueRoutines]', e);
    return [];
  }
}

/**
 * Полная heatmap (все даты, не только один месяц).
 * @param {number} activeCount — кол-во активных рутин для нормализации
 * @returns {Promise<Array<{date, level}>>}
 */
export async function getFullHeatmapData(activeCount = 1) {
  try {
    const logs = await db.routine_log.toArray();
    const byDate = {};
    logs.forEach(l => {
      if (l.completed) byDate[l.date] = (byDate[l.date] || 0) + 1;
    });
    return Object.entries(byDate).map(([date, count]) => ({
      date,
      level: Math.min(4, Math.round((count / (activeCount || 1)) * 4)),
    }));
  } catch (e) {
    console.error('[routines.getFullHeatmapData]', e);
    return [];
  }
}
