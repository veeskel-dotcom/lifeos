import db from '../db/index';
import { emit } from './triggerBus';

export function calculate1RM(weight, reps) {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export async function startWorkout(templateId) {
  try {
    let name = 'Тренировка';
    let exercises = [];
    if (templateId) {
      const tpl = await db.workout_templates.get(templateId);
      if (tpl) {
        name = tpl.name;
        exercises = tpl.exercises.map(e => ({
          exercise_id: e.exercise_id,
          name: e.name,
          sets: [],
          target_sets: e.target_sets,
          target_reps: e.target_reps,
        }));
        await db.workout_templates.update(templateId, {
          usage_count: (tpl.usage_count || 0) + 1,
          last_used: new Date().toISOString().split('T')[0],
        });
      }
    }
    const id = await db.workouts.add({
      date: new Date().toISOString().split('T')[0],
      type: 'gym',
      name,
      template_id: templateId || null,
      duration_min: 0,
      exercises,
      total_tonnage: 0,
      total_sets: 0,
      notes: '',
      source: 'manual',
      created_at: new Date().toISOString(),
      started_at: Date.now(),
      status: 'active',
    });
    return id;

  } catch (e) {
    console.error('[workouts.startWorkout]', e);
    throw e;
  }
}

export async function addSet(workoutId, exerciseIdx, { weight, reps, isWarmup }) {
  try {
    const workout = await db.workouts.get(workoutId);
    if (!workout) return;
    const ex = workout.exercises[exerciseIdx];
    if (!ex) return;
    ex.sets.push({ weight: parseFloat(weight), reps: parseInt(reps), is_warmup: !!isWarmup });
    await db.workouts.update(workoutId, { exercises: workout.exercises });
    return workout;

  } catch (e) {
    console.error('[workouts.addSet]', e);
    throw e;
  }
}

export async function addExerciseToWorkout(workoutId, exercise) {
  try {
    const workout = await db.workouts.get(workoutId);
    if (!workout) return;
    workout.exercises.push({
      exercise_id: exercise.id,
      name: exercise.name,
      sets: [],
    });
    await db.workouts.update(workoutId, { exercises: workout.exercises });

  } catch (e) {
    console.error('[workouts.addExerciseToWorkout]', e);
    throw e;
  }
}

export async function removeSet(workoutId, exerciseIdx, setIdx) {
  try {
    const workout = await db.workouts.get(workoutId);
    if (!workout) return;
    workout.exercises[exerciseIdx]?.sets.splice(setIdx, 1);
    await db.workouts.update(workoutId, { exercises: workout.exercises });

  } catch (e) {
    console.error('[workouts.removeSet]', e);
    throw e;
  }
}

export async function finishWorkout(workoutId) {
  try {
    const workout = await db.workouts.get(workoutId);
    if (!workout) return null;

    let totalTonnage = 0;
    let totalSets = 0;
    workout.exercises.forEach(ex => {
      ex.sets.forEach(s => {
        if (!s.is_warmup) {
          totalTonnage += s.weight * s.reps;
          totalSets++;
        }
      });
    });

    const durationMin = Math.round((Date.now() - (workout.started_at || Date.now())) / 60000);

    await db.workouts.update(workoutId, {
      status: 'done',
      duration_min: durationMin,
      total_tonnage: Math.round(totalTonnage),
      total_sets: totalSets,
    });

    emit('workout_completed', { duration: durationMin, tonnage: Math.round(totalTonnage) }).catch(() => {});
    return { ...workout, duration_min: durationMin, total_tonnage: Math.round(totalTonnage), total_sets: totalSets };

  } catch (e) {
    console.error('[workouts.finishWorkout]', e);
    throw e;
  }
}

export async function cancelWorkout(workoutId) {
  try {
    return db.workouts.delete(workoutId);

  } catch (e) {
    console.error('[workouts.cancelWorkout]', e);
    throw e;
  }
}

export async function getWorkout(id) {
  try {
    return db.workouts.get(id);

  } catch (e) {
    console.error('[workouts.getWorkout]', e);
    return null;
  }
}

export async function getWorkoutHistory({ type, limit = 20, offset = 0 } = {}) {
  try {
    let all = await db.workouts.where('date').above('').reverse().toArray();
    all = all.filter(w => w.status === 'done');
    if (type) all = all.filter(w => w.type === type);
    return all.slice(offset, offset + limit);

  } catch (e) {
    console.error('[workouts.getWorkoutHistory]', e);
    return [];
  }
}

export async function getLastWorkoutForExercise(exerciseId) {
  try {
    const all = await db.workouts.where('type').equals('gym').reverse().toArray();
    for (const w of all) {
      if (w.status !== 'done') continue;
      const ex = w.exercises?.find(e => e.exercise_id === exerciseId);
      if (ex && ex.sets.length > 0) return ex;
    }
    return null;

  } catch (e) {
    console.error('[workouts.getLastWorkoutForExercise]', e);
    return [];
  }
}

export async function detectPR(exerciseId, weight) {
  try {
    const all = await db.workouts.where('type').equals('gym').toArray();
    let maxWeight = 0;
    all.forEach(w => {
      if (w.status !== 'done') return;
      w.exercises?.forEach(ex => {
        if (ex.exercise_id === exerciseId) {
          ex.sets.forEach(s => { if (s.weight > maxWeight) maxWeight = s.weight; });
        }
      });
    });
    return weight > maxWeight;

  } catch (e) {
    console.error('[workouts.detectPR]', e);
    throw e;
  }
}

export async function getStats() {
  try {
    const all = await db.workouts.where('date').above('').toArray();
    const done = all.filter(w => w.status === 'done');
    const totalWorkouts = done.length;

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const thisWeek = done.filter(w => w.date >= weekStartStr).length;

    const avgDuration = totalWorkouts > 0
      ? Math.round(done.reduce((s, w) => s + (w.duration_min || 0), 0) / totalWorkouts)
      : 0;

    let streak = 0;
    const dates = [...new Set(done.map(w => w.date))].sort().reverse();
    if (dates.length > 0) {
      let checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);
      if (!dates.includes(checkDate.toISOString().split('T')[0])) {
        checkDate.setDate(checkDate.getDate() - 1);
      }
      for (let i = 0; i < 365; i++) {
        const ds = checkDate.toISOString().split('T')[0];
        if (dates.includes(ds)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    return { totalWorkouts, streak, thisWeek, avgDuration };

  } catch (e) {
    console.error('[workouts.getStats]', e);
    return [];
  }
}

export async function getMonthlyTonnage(months = 6) {
  try {
    const result = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const start = monthKey + '-01';
      const end = monthKey + '-31\uffff';
      const workouts = await db.workouts.where('date').between(start, end).toArray();
      const tonnage = workouts
        .filter(w => w.status === 'done')
        .reduce((s, w) => s + (w.total_tonnage || 0), 0);
      result.push({ month: monthKey, tonnage });
    }
    return result;

  } catch (e) {
    console.error('[workouts.getMonthlyTonnage]', e);
    return [];
  }
}

export async function getExerciseProgress(exerciseId, months = 3) {
  try {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const all = await db.workouts.where('date').above(cutoffStr).toArray();
    const points = [];
    all
      .filter(w => w.status === 'done' && w.type === 'gym')
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(w => {
        const ex = w.exercises?.find(e => e.exercise_id === exerciseId);
        if (!ex || !ex.sets.length) return;
        const workingSets = ex.sets.filter(s => !s.is_warmup);
        if (!workingSets.length) return;
        const maxWeight = Math.max(...workingSets.map(s => s.weight));
        const bestSet = workingSets.reduce((best, s) => calculate1RM(s.weight, s.reps) > calculate1RM(best.weight, best.reps) ? s : best);
        points.push({
          date: w.date,
          maxWeight,
          estimated1RM: calculate1RM(bestSet.weight, bestSet.reps),
        });
      });
    return points;

  } catch (e) {
    console.error('[workouts.getExerciseProgress]', e);
    return [];
  }
}

/* ═══ D2.1 — Нагрузка по мышечным группам ═══ */

export async function getMuscleGroupLoad(days = 7) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    const workouts = await db.workouts.where('date').above(sinceStr).toArray();
    const load = {};

    for (const w of workouts.filter(w => w.status === 'done')) {
      for (const ex of (w.exercises || [])) {
        const exercise = await db.exercises.get(ex.exercise_id);
        if (exercise?.muscle_group) {
          const sets = (ex.sets || []).filter(s => !s.is_warmup).length;
          load[exercise.muscle_group] = (load[exercise.muscle_group] || 0) + sets;
        }
      }
    }
    return load;
  } catch {
    return {};
  }
}

/* ═══ D2.2 — Частота тренировок по дням недели ═══ */

export async function getFrequencyByDay(days = 30) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    const workouts = await db.workouts.where('date').above(sinceStr)
      .filter(w => w.status === 'done').toArray();

    const LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    for (const w of workouts) {
      const d = new Date(w.date + 'T12:00:00');
      let dow = d.getDay(); // 0=Вс
      dow = dow === 0 ? 6 : dow - 1; // 0=Пн
      counts[dow]++;
    }

    return LABELS.map((label, i) => ({ label, count: counts[i] }));
  } catch {
    return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(label => ({ label, count: 0 }));
  }
}

/* ═══ D2.3 — Все Personal Records ═══ */

export async function getAllPRs() {
  try {
    const allWorkouts = await db.workouts.orderBy('date').toArray();
    const done = allWorkouts.filter(w => w.status === 'done' && w.type === 'gym');
    const prs = [];
    const bestByExercise = {};

    for (const w of done) {
      for (const ex of (w.exercises || [])) {
        const workingSets = (ex.sets || []).filter(s => !s.is_warmup);
        if (workingSets.length === 0) continue;
        const maxWeight = Math.max(...workingSets.map(s => s.weight || 0));
        if (maxWeight <= 0) continue;

        const prev = bestByExercise[ex.exercise_id];
        if (!prev || maxWeight > prev) {
          if (prev) {
            prs.push({
              date: w.date,
              exercise_id: ex.exercise_id,
              exercise_name: ex.name,
              weight: maxWeight,
              prev: prev,
              improvement: maxWeight - prev,
            });
          }
          bestByExercise[ex.exercise_id] = maxWeight;
        }
      }
    }

    return prs.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

/**
 * Обновить метаданные тренировки (pr_count, notes и т.д.)
 * @param {number} id
 * @param {Object} data — поля для обновления
 */
export async function updateWorkoutMeta(id, data) {
  try {
    await db.workouts.update(id, data);
  } catch (e) {
    console.error('[workouts.updateWorkoutMeta]', e);
  }
}

/**
 * Все тренировки (для heatmap / группировки по датам).
 * @returns {Promise<Array>}
 */
export async function getAllWorkouts() {
  try {
    return await db.workouts.toArray();
  } catch (e) {
    console.error('[workouts.getAllWorkouts]', e);
    return [];
  }
}

/**
 * История тренировок для конкретного упражнения.
 * @param {number} exerciseId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function getExerciseHistory(exerciseId, limit = 20) {
  try {
    const all = await db.workouts.where('status').equals('done').reverse().toArray();
    const results = [];
    for (const w of all) {
      const ex = w.exercises?.find(e => e.exercise_id === exerciseId);
      if (ex) {
        results.push({ date: w.date, sets: ex.sets, workout_id: w.id });
        if (results.length >= limit) break;
      }
    }
    return results;
  } catch (e) {
    console.error('[workouts.getExerciseHistory]', e);
    return [];
  }
}
