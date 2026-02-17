/**
 * quotes.js — Котировки MOEX с 3-уровневым кэшем: memory → IndexedDB → API
 * Таблица: quotes 'ticker, updated_at'
 *
 * API-клиент: ../api/moex (создаёт B)
 */
import db from '../db/index';
import { getQuotes as fetchQuotes, getQuoteHistory } from '../api/moex';

const CACHE_TTL = 5 * 60 * 1000; // 5 минут
const memoryCache = new Map(); // ticker → { data, ts }

// ─── Получить котировки ─────────────────────────────────

/**
 * Получить котировки для списка тикеров.
 * Каскад: memory cache → IndexedDB → MOEX API
 * @param {string[]} tickers
 * @returns {Object<string, {price, change, changePct, name}>}
 */
export async function getQuotes(tickers) {
  if (!tickers || tickers.length === 0) return {};

  const result = {};
  const needFetch = [];

  // 1. Проверить memory cache
  for (const t of tickers) {
    const cached = memoryCache.get(t);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      result[t] = cached.data;
    } else {
      needFetch.push(t);
    }
  }

  if (needFetch.length === 0) return result;

  // 2. Проверить IndexedDB cache
  for (const t of [...needFetch]) {
    try {
      const dbQuote = await db.quotes.get(t);
      if (dbQuote && Date.now() - new Date(dbQuote.updated_at).getTime() < CACHE_TTL) {
        const data = {
          price: dbQuote.price,
          change: dbQuote.change,
          changePct: dbQuote.change_pct,
          name: dbQuote.name,
        };
        result[t] = data;
        memoryCache.set(t, { data, ts: Date.now() });
        needFetch.splice(needFetch.indexOf(t), 1);
      }
    } catch {}
  }

  if (needFetch.length === 0 || !navigator.onLine) return result;

  // 3. Fetch from MOEX
  try {
    const fresh = await fetchQuotes(needFetch);
    for (const [ticker, data] of Object.entries(fresh)) {
      result[ticker] = data;
      memoryCache.set(ticker, { data, ts: Date.now() });

      // Сохранить в IndexedDB
      await db.quotes.put({
        ticker,
        price: data.price,
        change: data.change,
        change_pct: data.changePct,
        name: data.name,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('MOEX fetch failed:', err.message);
    // Вернуть что есть из кэша
  }

  return result;
}

// ─── История для графика ────────────────────────────────

/**
 * Получить историю цены для графика.
 * @param {string} ticker
 * @param {number} days — сколько дней назад (default 90)
 */
export async function getHistory(ticker, days = 90) {
  if (!navigator.onLine) return [];

  const toDate = new Date().toISOString().split('T')[0];
  const fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  try {
    return await getQuoteHistory(ticker, fromDate, toDate);
  } catch {
    return [];
  }
}

// ─── Портфель ───────────────────────────────────────────

/**
 * Пересчитать котировки для всех активов в портфеле.
 */
export async function refreshPortfolioQuotes() {
  try {
    const assets = await db.portfolio.toArray();
    const tickers = [...new Set(assets.map(a => a.ticker).filter(Boolean))];
    if (tickers.length === 0) return {};

    // Очистить memory cache чтобы принудить обновление
    tickers.forEach(t => memoryCache.delete(t));

    return getQuotes(tickers);

  } catch (e) {
    console.error('[quotes.refreshPortfolioQuotes]', e);
    throw e;
  }
}

// ─── Торговые часы MOEX ─────────────────────────────────

/**
 * Проверить торговые часы MOEX (Пн-Пт 10:00-18:50 МСК).
 */
export function isTradingHours() {
  const now = new Date();
  const msk = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const day = msk.getDay();
  const hour = msk.getHours();
  const min = msk.getMinutes();

  if (day === 0 || day === 6) return false; // выходные
  if (hour < 10 || hour > 18) return false;
  if (hour === 18 && min > 50) return false;
  return true;
}

// ─── Алиасы для совместимости с invest экранами ─────────

/** Алиас refreshPortfolioQuotes для InvestOverview */
export const refreshIfStale = refreshPortfolioQuotes;

/** Котировка одного тикера (обёртка getQuotes) */
export async function getQuote(ticker) {
  try {
    const result = await getQuotes([ticker]);
    return result[ticker] || null;

  } catch (e) {
    console.error('[quotes.getQuote]', e);
    return null;
  }
}

/** Алиас getQuotes для portfolio.js */
export const getAllQuotes = getQuotes;
