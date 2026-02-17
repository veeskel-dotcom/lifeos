/**
 * hooks/useDB.js — Реактивные хуки для доступа к данным.
 *
 * ПРАВИЛО: Это ЕДИНСТВЕННЫЙ файл (кроме сервисов), который импортирует db.
 * Экраны импортируют хуки отсюда, НЕ из db/index напрямую.
 *
 * Для сложных запросов экраны могут обернуть сервисную функцию в useLiveQuery:
 *   const data = useLiveQuery(() => getAccountOps(id).catch(() => []), [id]);
 * Dexie отследит таблицы автоматически через цепочку вызовов.
 *
 * Re-export useLiveQuery чтобы экранам не нужен dexie-react-hooks напрямую.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import db from '../db/index';

// Re-export для экранов, которым нужен useLiveQuery с сервисными функциями
export { useLiveQuery };

// ══════════════════════════════════════
// SETTINGS & PROFILE
// ══════════════════════════════════════

/** Реактивное значение из settings по ключу */
export function useSetting(key) {
  return useLiveQuery(
    () => db.settings.get(key).then(r => r?.value ?? null).catch(() => null),
    [key]
  );
}

/** Несколько settings сразу: useSettings(['key1','key2']) → { key1: val, key2: val } */
export function useSettings(keys) {
  return useLiveQuery(
    () => db.settings.bulkGet(keys)
      .then(rows => {
        const obj = {};
        (rows || []).filter(Boolean).forEach(r => { obj[r.key] = r.value; });
        return obj;
      })
      .catch(() => ({})),
    [keys.join(',')]
  );
}

/** Профиль пользователя */
export function useProfile() {
  return useLiveQuery(
    () => db.user_profile.get('profile').then(r => r?.value ?? null).catch(() => null),
    []
  );
}

// ══════════════════════════════════════
// FINANCE — Accounts
// ══════════════════════════════════════

export function useAccounts() {
  return useLiveQuery(() => db.accounts.toArray().catch(() => []), []);
}

export function useActiveAccounts() {
  return useLiveQuery(
    () => db.accounts.filter(a => a.is_active !== false).toArray().catch(() => []),
    []
  );
}

export function useAccount(id) {
  return useLiveQuery(
    () => id ? db.accounts.get(id).catch(() => null) : null,
    [id]
  );
}

// ══════════════════════════════════════
// FINANCE — Categories
// ══════════════════════════════════════

export function useCategories(module) {
  return useLiveQuery(
    () => db.categories.where('module').equals(module).toArray().catch(() => []),
    [module]
  );
}

export function useExpenseCategories() {
  return useCategories('expense');
}

// ══════════════════════════════════════
// FINANCE — Expenses & Incomes
// ══════════════════════════════════════

export function useMonthExpenses(monthStart, monthEnd) {
  return useLiveQuery(
    () => db.expenses.where('date').between(monthStart, monthEnd + '\uffff').toArray().catch(() => []),
    [monthStart, monthEnd]
  );
}

export function useMonthIncomes(monthStart, monthEnd) {
  return useLiveQuery(
    () => db.incomes.where('date').between(monthStart, monthEnd + '\uffff').toArray().catch(() => []),
    [monthStart, monthEnd]
  );
}

export function useIncomeSources() {
  return useLiveQuery(
    () => db.incomes.toArray().then(rows => {
      const sources = [...new Set(rows.map(r => r.source).filter(Boolean))];
      return sources;
    }).catch(() => []),
    []
  );
}

export function useRecentExpenses(limit = 5) {
  return useLiveQuery(
    () => db.expenses.orderBy('ts').reverse().limit(limit).toArray().catch(() => []),
    [limit]
  );
}

// ══════════════════════════════════════
// FINANCE — Budgets
// ══════════════════════════════════════

export function useBudgets(month) {
  return useLiveQuery(
    () => db.budgets.where('month').equals(month).toArray().catch(() => []),
    [month]
  );
}

// ══════════════════════════════════════
// FINANCE — Credits
// ══════════════════════════════════════

export function useCredits() {
  return useLiveQuery(() => db.credits.toArray().catch(() => []), []);
}

export function useActiveCredits() {
  return useLiveQuery(
    () => db.credits.filter(c => c.is_active !== false).toArray().catch(() => []),
    []
  );
}

export function useCredit(id) {
  return useLiveQuery(
    () => id ? db.credits.get(id).catch(() => null) : null,
    [id]
  );
}

// ══════════════════════════════════════
// SPORT — Workouts
// ══════════════════════════════════════

export function useWorkout(id) {
  return useLiveQuery(
    () => id ? db.workouts.get(id).catch(() => null) : null,
    [id]
  );
}

export function useRecentWorkouts(limit = 5) {
  return useLiveQuery(
    () => db.workouts.orderBy('date').reverse().limit(limit).toArray().catch(() => []),
    [limit]
  );
}

/** Все тренировки (для истории с фильтрацией на клиенте) */
export function useAllWorkouts() {
  return useLiveQuery(
    () => db.workouts.orderBy('date').reverse().toArray().catch(() => []),
    []
  );
}

// ══════════════════════════════════════
// SPORT — Templates & Exercises
// ══════════════════════════════════════

export function useTemplates() {
  return useLiveQuery(() => db.workout_templates.toArray().catch(() => []), []);
}

export function useExercises() {
  return useLiveQuery(() => db.exercises.toArray().catch(() => []), []);
}

// ══════════════════════════════════════
// SPORT — Videos
// ══════════════════════════════════════

export function useSportVideos(sportType) {
  return useLiveQuery(
    () => sportType
      ? db.sport_videos.where('sport_type').equals(sportType).reverse().toArray().catch(() => [])
      : [],
    [sportType]
  );
}
