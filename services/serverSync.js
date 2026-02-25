/**
 * serverSync.js — Синхронизация с VPS через Vercel proxy.
 * Этап 1: ручной push (кнопка в настройках).
 */
import { getSetting, setSetting } from '../db/helpers';

const SYNC_TABLES_EXCLUDE = new Set([
  'ai_conversations', 'ai_cache', 'ai_corrections',
  'ai_auto_rules', 'ai_memory', 'security_log', 'error_log',
]);

/**
 * Экспорт данных для синхронизации.
 * НЕ использует exportAll() — возвращает объект (одна сериализация в fetch).
 */
export async function exportForSync() {
  const db = (await import('../db/index')).default;
  const data = {};

  for (const table of db.tables) {
    if (!SYNC_TABLES_EXCLUDE.has(table.name)) {
      try {
        data[table.name] = await table.toArray();
      } catch {
        data[table.name] = [];
      }
    }
  }

  data._meta = {
    version: db.verno,
    exported_at: new Date().toISOString(),
    records_count: Object.values(data)
      .reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0),
  };

  return data;
}

/**
 * Вычислить сводку для дашборда (считается на клиенте, $0).
 */
function computeSummary(data) {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.slice(0, 8) + '01';

  const expenses = data.expenses || [];
  const incomes = data.incomes || [];
  const tasks = data.tasks || [];
  const foodLog = data.food_log || [];
  const waterLog = data.water_log || [];
  const workouts = data.workouts || [];
  const portfolio = data.portfolio || [];
  const bodyWeight = data.body_weight || [];

  return {
    today,
    month_expenses: expenses
      .filter(e => e.date >= monthStart)
      .reduce((s, e) => s + (e.amount_base || e.amount || 0), 0),
    month_incomes: incomes
      .filter(i => i.date >= monthStart)
      .reduce((s, i) => s + (i.amount_base || i.amount || 0), 0),
    active_tasks: tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length,
    overdue_tasks: tasks.filter(t => t.deadline && t.deadline < today && t.status !== 'done').length,
    today_calories: foodLog
      .filter(f => f.date === today)
      .reduce((s, f) => s + (f.total_calories || f.calories || 0), 0),
    today_water_ml: waterLog
      .filter(w => w.date === today)
      .reduce((s, w) => s + (w.amount_ml || 0), 0),
    last_workout_date: workouts.length
      ? [...workouts].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]?.date
      : null,
    portfolio_count: portfolio.length,
    weight_current: bodyWeight.length
      ? [...bodyWeight].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]?.weight
      : null,
    total_expenses_count: expenses.length,
    total_tasks_count: tasks.length,
  };
}

let _retried = false;

/**
 * Отправить полный снапшот на сервер.
 * @returns {{ ok: boolean, error?: string, records?: number }}
 */
export async function pushToServer() {
  try {
    const data = await exportForSync();
    const summary = computeSummary(data);

    const response = await fetch('/api/proxy/sync?endpoint=push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, _summary: summary }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw Object.assign(new Error(err.error || `HTTP ${response.status}`), { noRetry: response.status < 500 });
    }

    const result = await response.json();
    await setSetting('last_server_sync', new Date().toISOString());
    await setSetting('last_server_sync_records', result.records || data._meta.records_count);
    _retried = false;

    return { ok: true, ...result };
  } catch (e) {
    if (!_retried && !e.noRetry) {
      _retried = true;
      await new Promise(r => setTimeout(r, 2000));
      return pushToServer();
    }
    _retried = false;
    const msg = e.name === 'TimeoutError' ? 'Таймаут соединения (30с)'
      : e.message || 'Ошибка синхронизации';
    return { ok: false, error: msg };
  }
}

/**
 * Получить статус синхронизации с сервера.
 */
export async function getSyncStatus() {
  try {
    const response = await fetch('/api/proxy/sync?endpoint=status', {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
