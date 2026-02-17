/**
 * M6.3: useDashboardData — один хук для дашборда.
 * Загружает все данные одним Promise.all вместо 12 отдельных useLiveQuery.
 * Используется для BriefingCard и общей статистики.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { getTodayStats, getMonthlyStats } from '../services/expenses';
import { getOverallBudget } from '../services/budgets';
import { getTaskStats } from '../services/tasks';
import { getDailyTotals, getGoals as getNutritionGoals } from '../services/nutrition';
import { getWaterProgress } from '../services/water';
import { getStats as getWorkoutStats } from '../services/workouts';
import { getLatest as getLatestWeight } from '../services/bodyweight';
import { getRoutinesDailyStats } from '../services/routines';
import { getGoals as getActiveGoals, getProgress } from '../services/goals';

export function useDashboardData() {
  return useLiveQuery(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const month = today.slice(0, 7);

      const [
        todayExpenses,
        monthStats,
        budget,
        taskStats,
        nutrition,
        nutritionGoals,
        water,
        workouts,
        weight,
        routines,
        goals,
      ] = await Promise.all([
        getTodayStats().catch(() => ({ total: 0, count: 0 })),
        getMonthlyStats(month).catch(() => ({ total: 0 })),
        getOverallBudget(month).catch(() => null),
        getTaskStats().catch(() => ({ total: 0, done: 0, overdue: 0 })),
        getDailyTotals(today).catch(() => ({ calories: 0, protein: 0, fat: 0, carbs: 0 })),
        getNutritionGoals().catch(() => ({ calories: 2200 })),
        getWaterProgress(today).catch(() => ({ current: 0, goal: 2000 })),
        getWorkoutStats().catch(() => ({ thisWeek: 0, total: 0 })),
        getLatestWeight().catch(() => null),
        getRoutinesDailyStats().catch(() => ({ done: 0, total: 0 })),
        getActiveGoals('active').catch(() => []),
      ]);

      return {
        todayExpenses,
        monthStats,
        budget,
        taskStats,
        nutrition,
        nutritionGoals,
        water,
        workouts,
        weight,
        routines,
        goals: goals.map(g => ({ ...g, progress: getProgress(g) })),
        loaded: true,
      };
    } catch (e) {
      console.error('[useDashboardData]', e);
      return null;
    }
  });
}

/**
 * Краткая сводка для AI briefing и уведомлений.
 */
export function useDashboardSummary() {
  const data = useDashboardData();
  if (!data) return null;

  const budgetPct = data.budget?.total > 0
    ? Math.round((data.budget.spent / data.budget.total) * 100) : 0;
  const calPct = data.nutritionGoals?.calories > 0
    ? Math.round((data.nutrition.calories / data.nutritionGoals.calories) * 100) : 0;
  const routinePct = data.routines.total > 0
    ? Math.round((data.routines.done / data.routines.total) * 100) : 0;

  return {
    budget: { pct: budgetPct, remaining: data.budget?.remaining || 0 },
    tasks: { overdue: data.taskStats.overdue, todayDone: data.taskStats.done },
    calories: { pct: calPct, eaten: data.nutrition.calories },
    water: data.water,
    workouts: data.workouts.thisWeek,
    routines: { pct: routinePct, done: data.routines.done, total: data.routines.total },
    weight: data.weight?.weight || null,
    goalCount: data.goals.length,
    goalsNearComplete: data.goals.filter(g => g.progress >= 80).length,
  };
}
