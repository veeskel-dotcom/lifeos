/**
 * sync.js — Оркестратор синхронизации данных
 *
 * Вызывать при:
 * 1. Открытии приложения (App.jsx useEffect)
 * 2. Возвращении онлайн (offlineDetector)
 * 3. По таймеру каждые 30 мин (если приложение открыто)
 */
import { refreshPortfolioQuotes, isTradingHours } from './quotes';
import { getRates } from './currencies';

// ─── Полная синхронизация ───────────────────────────────

/**
 * Синхронизировать всё что можно.
 * @returns {{ synced: boolean, reason?: string, results?: Object }}
 */
export async function syncAll() {
  if (!navigator.onLine) return { synced: false, reason: 'offline' };

  const results = {};

  // Курсы валют (раз в 24ч — внутри getRates проверит кэш)
  try {
    results.currencies = await getRates('KZT');
  } catch (e) {
    results.currencies = { error: e.message };
  }

  // Котировки (только в торговые часы)
  if (isTradingHours()) {
    try {
      results.quotes = await refreshPortfolioQuotes();
    } catch (e) {
      results.quotes = { error: e.message };
    }
  }

  return { synced: true, results };
}

// ─── Периодическая синхронизация ────────────────────────

let syncInterval = null;

/**
 * Запустить периодическую синхронизацию.
 * @param {number} intervalMs — интервал (default 30 мин)
 */
export function startPeriodicSync(intervalMs = 30 * 60 * 1000) {
  stopPeriodicSync();
  syncAll(); // сразу при старте
  syncInterval = setInterval(syncAll, intervalMs);
}

/**
 * Остановить периодическую синхронизацию.
 */
export function stopPeriodicSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
