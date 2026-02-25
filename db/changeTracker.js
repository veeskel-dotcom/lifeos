/**
 * changeTracker.js — Dexie middleware для отслеживания изменений.
 * Перехватывает все mutate() на trackable таблицах,
 * записывает в _sync_changelog для дельта-синка.
 */
import db from './index';

// Таблицы, которые НЕ трекаем
const EXCLUDED = new Set([
  'settings', 'user_profile', 'currencies', 'quotes',
  'ai_conversations', 'ai_cache', 'ai_corrections',
  'ai_auto_rules', 'ai_memory', 'security_log', 'error_log',
  '_sync_changelog',
]);

let _enabled = false;
const MAX_ENTRIES = 2000;
const PRUNE_TO = 500;

// ─── Middleware ──────────────────────────────────────────

function logChanges(tableName, req, res) {
  const now = Date.now();
  const entries = [];

  try {
    if (req.type === 'add' || req.type === 'put') {
      const values = req.values || [];
      const keys = res.results || [];
      for (let i = 0; i < values.length; i++) {
        const record = { ...values[i] };
        if (keys[i] != null) record.id = keys[i];
        entries.push({
          table_name: tableName,
          op: req.type,
          record_id: keys[i] ?? record.id,
          data: record,
          ts: now,
        });
      }
    } else if (req.type === 'delete') {
      const keys = req.keys || [];
      for (const key of keys) {
        entries.push({
          table_name: tableName,
          op: 'delete',
          record_id: key,
          data: null,
          ts: now,
        });
      }
    } else if (req.type === 'deleteRange') {
      // Range delete — записываем как bulk delete без конкретных id
      // Full sync подхватит
      entries.push({
        table_name: tableName,
        op: 'deleteRange',
        record_id: null,
        data: null,
        ts: now,
      });
    }

    if (entries.length > 0) {
      // Fire-and-forget — отдельная транзакция
      db._sync_changelog.bulkAdd(entries).catch(() => {});
    }
  } catch {
    // Не ломаем основное приложение
  }
}

// Для update операций — дочитать полную запись
function logUpdateChanges(tableName, req, res) {
  const now = Date.now();
  const keys = req.keys || [];
  if (keys.length === 0) return;

  // Прочитать полные записи после обновления
  Promise.all(
    keys.map(key =>
      db.table(tableName).get(key).then(record => {
        if (!record) return null;
        return {
          table_name: tableName,
          op: 'update',
          record_id: key,
          data: record,
          ts: now,
        };
      }).catch(() => null)
    )
  ).then(entries => {
    const valid = entries.filter(Boolean);
    if (valid.length > 0) {
      db._sync_changelog.bulkAdd(valid).catch(() => {});
    }
  }).catch(() => {});
}

// Регистрация middleware
db.use({
  stack: 'dbcore',
  name: 'ChangeTracker',
  create(downlevelDB) {
    return {
      ...downlevelDB,
      table(tableName) {
        const downlevelTable = downlevelDB.table(tableName);
        if (EXCLUDED.has(tableName)) return downlevelTable;
        return {
          ...downlevelTable,
          mutate(req) {
            return downlevelTable.mutate(req).then(res => {
              if (!_enabled) return res;
              if (req.type === 'add' || req.type === 'put' || req.type === 'delete' || req.type === 'deleteRange') {
                logChanges(tableName, req, res);
              } else if (req.type === 'update') {
                logUpdateChanges(tableName, req, res);
              }
              return res;
            });
          },
        };
      },
    };
  },
});

// ─── Public API ─────────────────────────────────────────

export function enableTracking() {
  _enabled = true;
}

export function disableTracking() {
  _enabled = false;
}

export function isTrackingEnabled() {
  return _enabled;
}

export async function getPendingChanges() {
  return db._sync_changelog.orderBy('id').toArray();
}

export async function getPendingCount() {
  return db._sync_changelog.count();
}

export async function clearChanges(upToId) {
  return db._sync_changelog.where('id').belowOrEqual(upToId).delete();
}

export async function clearAllChanges() {
  return db._sync_changelog.clear();
}

export async function pruneIfNeeded() {
  const count = await db._sync_changelog.count();
  if (count <= MAX_ENTRIES) return false;

  // Оставить последние PRUNE_TO записей
  const keep = await db._sync_changelog.orderBy('id').reverse().limit(PRUNE_TO).toArray();
  const minKeepId = Math.min(...keep.map(r => r.id));
  await db._sync_changelog.where('id').below(minKeepId).delete();
  return true;
}
