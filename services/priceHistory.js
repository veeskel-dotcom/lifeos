/**
 * E1: Price History Service
 * Fetches from MOEX ISS API for RU stocks, stores in IndexedDB for offline.
 */
import db from '../db/index';
import { emitNetworkError } from '../api/_shared';

const MOEX_API = 'https://iss.moex.com/iss';

// ── Fetch from MOEX ISS ──
export async function fetchMOEXHistory(ticker, days = 90) {
  try {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const url = `${MOEX_API}/engines/stock/markets/shares/securities/${ticker}/candles.json?from=${from}&till=${to}&interval=24`;
    
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const json = await res.json();
    const cols = json.candles?.columns || [];
    const data = json.candles?.data || [];
    
    const openIdx = cols.indexOf('open');
    const closeIdx = cols.indexOf('close');
    const highIdx = cols.indexOf('high');
    const lowIdx = cols.indexOf('low');
    const volIdx = cols.indexOf('volume');
    const dateIdx = cols.indexOf('begin');
    
    return data.map(row => ({
      date: row[dateIdx]?.slice(0, 10),
      open: row[openIdx],
      close: row[closeIdx],
      high: row[highIdx],
      low: row[lowIdx],
      volume: row[volIdx],
    }));
  } catch (e) {
    emitNetworkError('moex', 'Не удалось загрузить историю котировок');
    return null;
  }
}

// ── Cache in settings ──
export async function getPriceHistory(ticker) {
  try {
    const key = `price_history_${ticker}`;
    const cached = await db.settings.get(key);
    if (cached?.value) {
      const { data, ts } = cached.value;
      // Cache for 4 hours
      if (Date.now() - ts < 4 * 3600000 && data?.length) return data;
    }
  
    // Try fetch
    if (navigator.onLine) {
      const data = await fetchMOEXHistory(ticker);
      if (data?.length) {
        await db.settings.put({ key, value: { data, ts: Date.now() } });
        return data;
      }
    }
  
    return cached?.value?.data || null;

  } catch (e) {
    console.error('[priceHistory.getPriceHistory]', e);
    return null;
  }
}

// ── Generate synthetic data when no API data ──
export function generateSyntheticHistory(currentPrice, days = 30) {
  const data = [];
  let price = currentPrice * (0.85 + Math.random() * 0.15);
  for (let i = days; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    price += (Math.random() - 0.48) * price * 0.02;
    data.push({ date, close: Math.round(price * 100) / 100 });
  }
  data[data.length - 1].close = currentPrice;
  return data;
}
