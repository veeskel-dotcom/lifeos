/**
 * S1-S4, S8: Система целей.
 * Типы: finance, fitness, weight, habits, reading, custom
 * Метрика: target_value + current_value, автообновление из сервисов.
 */
import db from '../db/index';
import { getMonthlyStats } from './expenses';
import { getStats as getWorkoutStats } from './workouts';
import { getLatest as getLatestWeight } from './bodyweight';
import { getRoutinesDailyStats } from './routines';

const GOAL_TYPES = [
  { type: 'finance_save', label: 'Накопить', icon: '💰', unit: '₸', module: 'finance' },
  { type: 'finance_limit', label: 'Тратить не более', icon: '🛑', unit: '₸/мес', module: 'finance' },
  { type: 'fitness_workouts', label: 'Тренировок в неделю', icon: '🏋️', unit: 'раз', module: 'sport' },
  { type: 'weight_target', label: 'Целевой вес', icon: '⚖️', unit: 'кг', module: 'sport' },
  { type: 'habits_streak', label: 'Серия рутин', icon: '🔥', unit: 'дней', module: 'routines' },
  { type: 'reading_books', label: 'Книг в год', icon: '📚', unit: 'шт', module: 'notes' },
  { type: 'custom', label: 'Своя цель', icon: '🎯', unit: '', module: null },
];

export { GOAL_TYPES };

export async function addGoal(data) {
  try {
    return db.goals.add({
      type: data.type,
      title: data.title || GOAL_TYPES.find(t => t.type === data.type)?.label || 'Цель',
      icon: data.icon || GOAL_TYPES.find(t => t.type === data.type)?.icon || '🎯',
      target_value: data.target_value,
      current_value: 0,
      unit: data.unit || GOAL_TYPES.find(t => t.type === data.type)?.unit || '',
      deadline: data.deadline || null,
      status: 'active',
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[goals.addGoal]', e);
    throw e;
  }
}

export async function getGoals(status = 'active') {
  try {
    if (status === 'all') return db.goals.toArray();
    return db.goals.where('status').equals(status).toArray();
  } catch (e) {
    console.error('[goals.getGoals]', e);
    return [];
  }
}

export async function updateGoal(id, data) {
  try {
    return db.goals.update(id, data);
  } catch (e) {
    console.error('[goals.updateGoal]', e);
    throw e;
  }
}

export async function completeGoal(id) {
  return db.goals.update(id, { status: 'completed', completed_at: new Date().toISOString() });
}

export async function deleteGoal(id) {
  return db.goals.delete(id);
}

/**
 * Автообновление current_value из реальных данных.
 */
export async function refreshGoalProgress(goal) {
  let current = goal.current_value || 0;

  try {
    switch (goal.type) {
      case 'finance_limit': {
        const month = new Date().toISOString().slice(0, 7);
        const stats = await getMonthlyStats(month);
        current = stats?.total || 0;
        break;
      }
      case 'fitness_workouts': {
        const stats = await getWorkoutStats();
        current = stats?.thisWeek || 0;
        break;
      }
      case 'weight_target': {
        const latest = await getLatestWeight();
        current = latest?.weight || 0;
        break;
      }
      case 'habits_streak': {
        const stats = await getRoutinesDailyStats();
        current = stats?.streak || 0;
        break;
      }
      default:
        return goal;
    }
  } catch {}

  if (current !== goal.current_value) {
    await db.goals.update(goal.id, { current_value: current });
  }

  return { ...goal, current_value: current };
}

/**
 * Обновить все активные цели.
 */
export async function refreshAllGoals() {
  const goals = await getGoals('active');
  return Promise.all(goals.map(refreshGoalProgress));
}

/**
 * Прогресс в процентах.
 */
export function getProgress(goal) {
  if (!goal.target_value) return 0;
  // Для weight_target — инвертировать (ближе к цели = лучше)
  if (goal.type === 'weight_target') {
    const start = goal.start_value || goal.current_value;
    const diff = Math.abs(start - goal.target_value);
    const progress = Math.abs(start - goal.current_value);
    return diff > 0 ? Math.min(100, Math.round((progress / diff) * 100)) : 0;
  }
  // Для finance_limit — инвертировать (меньше = лучше)
  if (goal.type === 'finance_limit') {
    return Math.min(100, Math.round(((goal.target_value - goal.current_value) / goal.target_value) * 100));
  }
  return Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
}
