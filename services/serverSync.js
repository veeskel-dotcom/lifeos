/**
 * serverSync.js — Синхронизация с VPS через Vercel proxy.
 * Этап 1: ручной full push. Этап 2: авто дельта-синк.
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
    const now = new Date().toISOString();
    await setSetting('last_server_sync', now);
    await setSetting('last_full_sync', now);
    await setSetting('last_server_sync_records', result.records || data._meta.records_count);

    // Очистить changelog после успешного full push
    try {
      const { clearAllChanges } = await import('../db/changeTracker');
      await clearAllChanges();
    } catch {}

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

// ─── Этап 2: Дельта-синк ────────────────────────────────

const DELTA_FALLBACK_THRESHOLD = 500;
const FULL_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24ч

/**
 * Отправить только изменения (дельту) на сервер.
 * Fallback на полный push при > 500 изменений или 409 (нет ActiveData).
 */
export async function pushDelta() {
  const { getPendingChanges, clearChanges, pruneIfNeeded } = await import('../db/changeTracker');
  await pruneIfNeeded();

  const changes = await getPendingChanges();
  if (changes.length === 0) return { ok: true, skipped: true };

  // Слишком много — полный push
  if (changes.length > DELTA_FALLBACK_THRESHOLD) {
    return pushToServer();
  }

  try {
    const response = await fetch('/api/proxy/sync?endpoint=delta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changes: changes.map(c => ({
          table: c.table_name,
          op: c.op,
          record_id: c.record_id,
          data: c.data,
          ts: c.ts,
        })),
        _meta: { version: 7, changes_count: changes.length },
      }),
      signal: AbortSignal.timeout(15000),
    });

    // 409 = нет ActiveData, нужен full push
    if (response.status === 409) {
      return pushToServer();
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { ok: false, error: err.error || `HTTP ${response.status}` };
    }

    const result = await response.json();
    const maxId = Math.max(...changes.map(c => c.id));
    await clearChanges(maxId);
    await setSetting('last_server_sync', new Date().toISOString());

    return { ok: true, delta: true, count: changes.length, ...result };
  } catch (e) {
    return {
      ok: false,
      error: e.name === 'TimeoutError' ? 'Таймаут (15с)' : e.message || 'Ошибка дельта-синка',
    };
  }
}

/**
 * Авто дельта-синк: вызывается каждые 5 мин.
 * Проверяет: online, auto_server_sync, есть изменения.
 * Раз в 24ч делает полный push (страховка от потерянных changelog записей).
 */
export async function autoDeltaSync() {
  if (!navigator.onLine) return { skipped: true, reason: 'offline' };

  const autoSync = await getSetting('auto_server_sync');
  if (!autoSync) return { skipped: true, reason: 'disabled' };

  // Страховка: полный push раз в 24ч
  const lastFull = await getSetting('last_full_sync');
  if (!lastFull || Date.now() - new Date(lastFull).getTime() > FULL_SYNC_INTERVAL_MS) {
    return pushToServer();
  }

  const { getPendingCount } = await import('../db/changeTracker');
  const count = await getPendingCount();
  if (count === 0) return { ok: true, skipped: true };

  return pushDelta();
}
