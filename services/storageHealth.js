/**
 * T3 + T7 + T8: Здоровье хранилища — версия схемы, целостность, квота.
 */
import db from '../db/index';
import { CURRENT_VERSION, getMigrationStatus } from '../db/migrations';
import { checkStorageHealth } from '../lib/storageHealth';

// ═══ T3: Проверка версии схемы ═══

export function getSchemaVersion() {
  return {
    current: db.verno,
    expected: CURRENT_VERSION,
    match: db.verno === CURRENT_VERSION,
  };
}

// ═══ T7: Integrity check — расширенная проверка целостности ═══

export async function runIntegrityCheck() {
  const issues = [];
  const stats = {};

  try {
    // Размеры таблиц
    for (const table of db.tables) {
      try {
        stats[table.name] = await table.count();
      } catch {
        stats[table.name] = -1;
        issues.push({ type: 'error', table: table.name, detail: 'Не удалось прочитать таблицу' });
      }
    }

    // ── 1. Расходы без существующего счёта ──
    if (stats.expenses > 0 && stats.accounts >= 0) {
      const accountIds = new Set((await db.accounts.toArray()).map(a => a.id));
      const expenses = await db.expenses.toArray();
      for (const e of expenses) {
        if (e.account_id && !accountIds.has(e.account_id)) {
          issues.push({ type: 'orphan', table: 'expenses', id: e.id, detail: `account_id=${e.account_id} не существует`, fixable: true });
        }
      }
    }

    // ── 2. Задачи с несуществующим проектом ──
    if (stats.tasks > 0 && stats.projects >= 0) {
      const projectIds = new Set((await db.projects.toArray()).map(p => p.id));
      const tasks = await db.tasks.toArray();
      for (const t of tasks) {
        if (t.project_id && !projectIds.has(t.project_id)) {
          issues.push({ type: 'orphan', table: 'tasks', id: t.id, detail: `project_id=${t.project_id} не существует`, fixable: true });
        }
      }
    }

    // ── 3. Routine_log без существующей рутины ──
    if (stats.routine_log > 0 && stats.routines >= 0) {
      const routineIds = new Set((await db.routines.toArray()).map(r => r.id));
      const logs = await db.routine_log.toArray();
      for (const l of logs) {
        if (l.routine_id && !routineIds.has(l.routine_id)) {
          issues.push({ type: 'orphan', table: 'routine_log', id: l.id, detail: `routine_id=${l.routine_id} не существует`, fixable: true });
        }
      }
    }

    // ── 4. Trades без записи в portfolio ──
    if (stats.trades > 0 && stats.portfolio >= 0) {
      const portfolioTickers = new Set((await db.portfolio.toArray()).map(p => p.ticker));
      const tradeTickers = new Set((await db.trades.toArray()).map(t => t.ticker));
      for (const ticker of tradeTickers) {
        if (!portfolioTickers.has(ticker)) {
          issues.push({ type: 'warning', table: 'trades', detail: `Тикер «${ticker}» в trades, нет в portfolio` });
        }
      }
    }

    // ── 5. Записи без обязательных полей ──
    if (stats.food_log > 0) {
      const foodLogs = await db.food_log.toArray();
      for (const fl of foodLogs) {
        if (!fl.date) issues.push({ type: 'corrupt', table: 'food_log', id: fl.id, detail: 'Нет даты', fixable: true });
      }
    }

    if (stats.expenses > 0) {
      const expenses = await db.expenses.toArray();
      for (const e of expenses) {
        if (!e.date) issues.push({ type: 'corrupt', table: 'expenses', id: e.id, detail: 'Нет даты', fixable: true });
        if (e.amount === undefined || e.amount === null) {
          issues.push({ type: 'corrupt', table: 'expenses', id: e.id, detail: 'Нет суммы', fixable: false });
        }
      }
    }

    if (stats.sleep_log > 0) {
      const sleepLogs = await db.sleep_log.toArray();
      for (const s of sleepLogs) {
        if (!s.date) issues.push({ type: 'corrupt', table: 'sleep_log', id: s.id, detail: 'Нет даты', fixable: true });
      }
    }

    // ── 6. Подписки с прошедшей датой оплаты ──
    if (stats.subscriptions > 0) {
      const subs = await db.subscriptions.toArray();
      const today = new Date().toISOString().split('T')[0];
      const overdue = subs.filter(s => s.next_payment && s.next_payment < today && s.status !== 'cancelled');
      if (overdue.length > 0) {
        issues.push({ type: 'warning', table: 'subscriptions', detail: `${overdue.length} подписок с просроченной датой оплаты` });
      }
    }

    // ── 7. AI-кэш старше 7 дней ──
    if (stats.ai_cache > 0) {
      const now = Date.now();
      const stale = await db.ai_cache.filter(c => c.expires_at && c.expires_at < now).count();
      if (stale > 0) {
        issues.push({ type: 'cleanup', table: 'ai_cache', detail: `${stale} устаревших записей`, fixable: true });
      }
    }

  } catch (e) {
    issues.push({ type: 'error', detail: `Ошибка проверки: ${e.message}` });
  }

  return {
    issues,
    stats,
    ok: issues.filter(i => i.type === 'corrupt' || i.type === 'error').length === 0,
    total_issues: issues.length,
    critical: issues.filter(i => i.type === 'corrupt' || i.type === 'error').length,
    orphans: issues.filter(i => i.type === 'orphan').length,
    warnings: issues.filter(i => i.type === 'warning').length,
    cleanable: issues.filter(i => i.type === 'cleanup').length,
    fixable: issues.filter(i => i.fixable).length,
  };
}

// ═══ T7: Авторемонт ═══

export async function autoRepair(issues) {
  const results = [];

  for (const issue of issues) {
    if (!issue.fixable) continue;

    try {
      switch (issue.type) {
        case 'orphan': {
          // Обнулить ссылку на несуществующий объект
          if (issue.table === 'expenses' && issue.id) {
            await db.expenses.update(issue.id, { account_id: null });
            results.push({ ...issue, fixed: true });
          } else if (issue.table === 'tasks' && issue.id) {
            await db.tasks.update(issue.id, { project_id: null });
            results.push({ ...issue, fixed: true });
          } else if (issue.table === 'routine_log' && issue.id) {
            await db.routine_log.delete(issue.id);
            results.push({ ...issue, fixed: true, action: 'deleted' });
          }
          break;
        }

        case 'corrupt': {
          if (issue.detail === 'Нет даты' && issue.id) {
            const table = db.table(issue.table);
            await table.update(issue.id, { date: new Date().toISOString().split('T')[0] });
            results.push({ ...issue, fixed: true, action: 'date_set_today' });
          }
          break;
        }

        case 'cleanup': {
          if (issue.table === 'ai_cache') {
            const now = Date.now();
            await db.ai_cache.filter(c => c.expires_at && c.expires_at < now).delete();
            results.push({ ...issue, fixed: true, action: 'stale_cache_cleared' });
          }
          break;
        }
      }
    } catch (err) {
      results.push({ ...issue, fixed: false, error: err.message });
    }
  }

  return results;
}

// ═══ T8: Расширенная проверка квоты ═══

export async function getStorageBreakdown() {
  const breakdown = {};

  for (const table of db.tables) {
    try {
      const count = await table.count();
      if (count === 0) continue;

      // Оценка размера: выборка первых 10 записей → средний размер × count
      const sample = await table.limit(10).toArray();
      const avgSize = sample.reduce((s, r) => s + JSON.stringify(r).length, 0) / sample.length;
      const estimatedKB = Math.round((avgSize * count) / 1024);

      breakdown[table.name] = {
        count,
        estimated_kb: estimatedKB,
        avg_record_bytes: Math.round(avgSize),
      };
    } catch {
      breakdown[table.name] = { count: -1, error: true };
    }
  }

  // Сортировка по размеру
  const sorted = Object.entries(breakdown)
    .filter(([, v]) => v.estimated_kb > 0)
    .sort((a, b) => b[1].estimated_kb - a[1].estimated_kb);

  const totalKB = sorted.reduce((s, [, v]) => s + v.estimated_kb, 0);

  return {
    tables: Object.fromEntries(sorted),
    total_kb: totalKB,
    total_mb: +(totalKB / 1024).toFixed(1),
    top3: sorted.slice(0, 3).map(([name, v]) => ({
      name,
      kb: v.estimated_kb,
      pct: totalKB > 0 ? Math.round((v.estimated_kb / totalKB) * 100) : 0,
    })),
  };
}

// ═══ T8: Запрос persistent storage ═══

export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return { supported: false };
    const persisted = await navigator.storage.persisted();
    if (persisted) return { supported: true, already: true };
    const granted = await navigator.storage.persist();
    return { supported: true, granted };
  } catch (err) {
    return { supported: false, error: err.message };
  }
}

// ═══ T8: Предупреждения квоты ═══

export function getQuotaWarnings(storage) {
  const warnings = [];

  if (!storage) return warnings;
  if (!storage.persistent) {
    warnings.push({ level: 'warning', message: 'Хранилище не защищено. iOS может удалить данные при нехватке места.' });
  }
  if (storage.percent > 90) {
    warnings.push({ level: 'critical', message: `Использовано ${storage.percent}% хранилища. Срочно создайте бэкап!` });
  } else if (storage.percent > 70) {
    warnings.push({ level: 'warning', message: `Использовано ${storage.percent}% хранилища. Рекомендуем создать бэкап.` });
  }
  if (!storage.indexeddb_ok) {
    warnings.push({ level: 'critical', message: 'IndexedDB недоступен. Данные могут быть потеряны.' });
  }

  return warnings;
}

// ═══ Полная проверка здоровья ═══

export async function fullHealthCheck() {
  const schema = getSchemaVersion();
  const storage = await checkStorageHealth();
  const integrity = await runIntegrityCheck();
  const quotaWarnings = getQuotaWarnings(storage);
  let migration = null;

  try {
    migration = await getMigrationStatus();
  } catch {}

  return {
    schema,
    storage,
    integrity,
    migration,
    quotaWarnings,
    overall: !schema.match || integrity.critical > 0 || quotaWarnings.some(w => w.level === 'critical')
      ? integrity.critical > 0 ? 'critical' : 'warning'
      : !integrity.ok
        ? 'warning'
        : 'healthy',
  };
}
