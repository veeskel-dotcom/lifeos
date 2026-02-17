import db from '../db/index';

export async function createTemplate(name, exercises, dayOfWeek) {
  try {
    return db.workout_templates.add({
      name,
      exercises: exercises.map(e => ({
        exercise_id: e.exercise_id,
        name: e.name,
        target_sets: e.target_sets || 3,
        target_reps: e.target_reps || 10,
      })),
      day_of_week: dayOfWeek ?? null,
      last_used: null,
      usage_count: 0,
    });

  } catch (e) {
    console.error('[templates.createTemplate]', e);
    throw e;
  }
}

export async function getTemplates() {
  try {
    return db.workout_templates.toArray();

  } catch (e) {
    console.error('[templates.getTemplates]', e);
    return [];
  }
}

export async function getTemplate(id) {
  try {
    return db.workout_templates.get(id);

  } catch (e) {
    console.error('[templates.getTemplate]', e);
    return null;
  }
}

export async function updateTemplate(id, data) {
  try {
    return db.workout_templates.update(id, data);

  } catch (e) {
    console.error('[templates.updateTemplate]', e);
    throw e;
  }
}

export async function deleteTemplate(id) {
  try {
    return db.workout_templates.delete(id);

  } catch (e) {
    console.error('[templates.deleteTemplate]', e);
    throw e;
  }
}

export async function useTemplate(id) {
  try {
    const tpl = await db.workout_templates.get(id);
    if (!tpl) return null;
    await db.workout_templates.update(id, {
      usage_count: (tpl.usage_count || 0) + 1,
      last_used: new Date().toISOString().split('T')[0],
    });
    return tpl;

  } catch (e) {
    console.error('[templates.useTemplate]', e);
    throw e;
  }
}

export const DAY_LABELS = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
