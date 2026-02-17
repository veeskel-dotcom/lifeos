import db from '../db/index';
import { getSetting, setSetting } from '../db/helpers';

export async function getWatchlist() {
  try {
    const tickers = JSON.parse((await getSetting('watchlist')) || '[]');
    const quotes = [];
    for (const ticker of tickers) {
      const q = await db.quotes.get(ticker);
      quotes.push({
        ticker,
        price: q?.last_price || null,
        change: q?.change_percent || null,
        name: q?.name || ticker,
        updated_at: q?.updated_at || null,
      });
    }
    return quotes;
  } catch {
    return [];
  }
}

export async function addToWatchlist(ticker) {
  try {
    const current = JSON.parse((await getSetting('watchlist')) || '[]');
    if (!current.includes(ticker)) {
      current.push(ticker);
      await setSetting('watchlist', JSON.stringify(current));
    }
  } catch { /* тихая ошибка */ }
}

export async function removeFromWatchlist(ticker) {
  try {
    const current = JSON.parse((await getSetting('watchlist')) || '[]');
    await setSetting('watchlist', JSON.stringify(current.filter(t => t !== ticker)));
  } catch { /* тихая ошибка */ }
}
