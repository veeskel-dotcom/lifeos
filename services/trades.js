import db from '../db/index';
import { addAssetFromTrade, recalcAvgPrice } from './portfolio';

export async function addTrade(data) {
  try {
    const trade = {
      ticker: data.ticker,
      date: data.date || new Date().toISOString().split('T')[0],
      type: data.type, // 'buy' | 'sell'
      quantity: data.quantity,
      price: data.price,
      commission: data.commission || 0,
      broker: data.broker || '',
      source: data.source || 'manual',
      created_at: new Date().toISOString(),
    };

    const id = await db.trades.add(trade);

    // Обновить portfolio
    await addAssetFromTrade({ ...trade, ...data });

    return { ...trade, id };

  } catch (e) {
    console.error('[trades.addTrade]', e);
    throw e;
  }
}

export async function getTrades(ticker) {
  try {
    if (ticker) {
      return db.trades.where('ticker').equals(ticker).reverse().sortBy('date');
    }
    return db.trades.orderBy('date').reverse().toArray();

  } catch (e) {
    console.error('[trades.getTrades]', e);
    return [];
  }
}

export async function deleteTrade(id) {
  try {
    const trade = await db.trades.get(id);
    if (!trade) return;

    await db.trades.delete(id);
    await recalcAvgPrice(trade.ticker);

  } catch (e) {
    console.error('[trades.deleteTrade]', e);
    throw e;
  }
}

export async function getAllTrades() {
  return getTrades();
}

export async function getTradeHistory(period = 'all') {
  try {
    let trades = await db.trades.orderBy('date').toArray();

    if (period !== 'all') {
      const cutoff = new Date();
      const days = { '1d': 1, '1w': 7, '1m': 30, '3m': 90, '1y': 365 };
      cutoff.setDate(cutoff.getDate() - (days[period] || 365));
      const cutoffStr = cutoff.toISOString().split('T')[0];
      trades = trades.filter(t => t.date >= cutoffStr);
    }

    return trades;

  } catch (e) {
    console.error('[trades.getTradeHistory]', e);
    return [];
  }
}
