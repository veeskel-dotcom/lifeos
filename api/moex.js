/**
 * moex.js — Котировки MOEX ISS.
 * Акции TQBR. Кэш 5мин (память) + 24ч (IndexedDB).
 * Торговые часы: Пн-Пт 10:00-18:50 МСК.
 */
import { fetchWithRetry, requireOnline, emitNetworkError } from './_shared';

const BASE = 'https://iss.moex.com/iss';
const BOARD = 'engines/stock/markets/shares/boards/TQBR';

// Memory cache: 5 минут
const quotesCache = new Map(); // ticker → { data, ts }
const CACHE_TTL = 5 * 60 * 1000;

/* ─── Helpers ─── */

function isTradingHours() {
  const now = new Date();
  // МСК = UTC+3
  const mskHour = (now.getUTCHours() + 3) % 24;
  const day = now.getUTCDay();
  // Пн(1)-Пт(5), 10:00-18:50 МСК
  if (day === 0 || day === 6) return false;
  if (mskHour < 10 || mskHour > 18) return false;
  if (mskHour === 18 && now.getUTCMinutes() > 50) return false;
  return true;
}

function parseSecurities(data) {
  const sec = data.securities || {};
  const md = data.marketdata || {};

  const secCols = sec.columns || [];
  const mdCols = md.columns || [];
  const secRows = sec.data || [];
  const mdRows = md.data || [];

  // Индексы столбцов
  const si = (col) => secCols.indexOf(col);
  const mi = (col) => mdCols.indexOf(col);

  const result = {};

  // Собираем securities данные
  for (const row of secRows) {
    const ticker = row[si('SECID')];
    if (!ticker) continue;
    result[ticker] = {
      ticker,
      name: row[si('SHORTNAME')] || ticker,
      prevPrice: row[si('PREVPRICE')] || 0,
    };
  }

  // Добавляем marketdata
  for (const row of mdRows) {
    const ticker = row[mi('SECID')];
    if (!ticker || !result[ticker]) continue;
    const last = row[mi('LAST')];
    if (last) {
      result[ticker].price = last;
      result[ticker].change = row[mi('CHANGE')] || 0;
      result[ticker].changePct = row[mi('CHANGEPCT')] || 0;
      result[ticker].updatedAt = row[mi('UPDATETIME')] || null;
    } else {
      // Биржа закрыта — использовать prevPrice
      result[ticker].price = result[ticker].prevPrice;
      result[ticker].change = 0;
      result[ticker].changePct = 0;
    }
  }

  return result;
}

/* ─── Get Quotes ─── */

export async function getQuotes(tickers) {
  requireOnline();

  // Проверить memory cache
  const now = Date.now();
  const cached = {};
  const toFetch = [];

  for (const t of tickers) {
    const c = quotesCache.get(t);
    if (c && now - c.ts < CACHE_TTL) {
      cached[t] = c.data;
    } else {
      toFetch.push(t);
    }
  }

  if (toFetch.length === 0) return cached;

  // Fetch all TQBR securities (one request)
  const url = `${BASE}/${BOARD}/securities.json` +
    '?iss.meta=off&iss.only=securities,marketdata' +
    '&securities.columns=SECID,SHORTNAME,PREVPRICE' +
    '&marketdata.columns=SECID,LAST,CHANGE,CHANGEPCT,UPDATETIME';

  const data = await fetchWithRetry(url, {}, { retries: 1 });
  const all = parseSecurities(data);

  // Обновить cache + IndexedDB
  const result = { ...cached };
  for (const t of toFetch) {
    if (all[t]) {
      result[t] = all[t];
      quotesCache.set(t, { data: all[t], ts: now });
    }
  }

  // Сохранить в IndexedDB (quotes таблица)
  try {
    const { default: db } = await import('../db/index');
    const puts = Object.values(result).map(q => ({
      ticker: q.ticker,
      price: q.price,
      change_pct: q.changePct,
      name: q.name,
      updated_at: new Date().toISOString(),
    }));
    await db.quotes.bulkPut(puts);
  } catch {}

  return result;
}

/* ─── Quote History ─── */

export async function getQuoteHistory(ticker, fromDate, toDate) {
  requireOnline();

  const url = `${BASE}/history/${BOARD}/securities/${ticker}.json` +
    `?from=${fromDate}&till=${toDate}` +
    '&iss.meta=off&history.columns=TRADEDATE,CLOSE,VOLUME';

  const data = await fetchWithRetry(url, {}, { retries: 1 });
  const cols = data.history?.columns || [];
  const rows = data.history?.data || [];

  const di = (col) => cols.indexOf(col);

  return rows.map(r => ({
    date: r[di('TRADEDATE')],
    close: r[di('CLOSE')],
    volume: r[di('VOLUME')],
  })).filter(r => r.close != null);
}

/* ─── Search Ticker ─── */

export async function searchTicker(query) {
  requireOnline();

  const url = `${BASE}/${BOARD}/securities.json` +
    '?iss.meta=off&iss.only=securities' +
    '&securities.columns=SECID,SHORTNAME,ISIN';

  const data = await fetchWithRetry(url, {}, { retries: 1 });
  const cols = data.securities?.columns || [];
  const rows = data.securities?.data || [];
  const si = (col) => cols.indexOf(col);
  const q = query.toUpperCase();

  return rows
    .filter(r => {
      const ticker = r[si('SECID')] || '';
      const name = r[si('SHORTNAME')] || '';
      return ticker.includes(q) || name.toUpperCase().includes(q);
    })
    .slice(0, 20)
    .map(r => ({
      ticker: r[si('SECID')],
      name: r[si('SHORTNAME')],
      isin: r[si('ISIN')] || null,
    }));
}

export { isTradingHours };
