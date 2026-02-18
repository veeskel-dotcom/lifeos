import db from '../db/index';
import { getAllQuotes } from './quotes';

export async function getPortfolio() {
  try {
    const assets = await db.portfolio.toArray();
    const tickers = assets.map(a => a.ticker).filter(Boolean);
    const qMap = tickers.length > 0 ? await getAllQuotes(tickers) : {};

    return assets.map(a => {
      const quote = qMap[a.ticker];
      const currentPrice = quote?.price || a.avg_price;
      const changePct = quote?.changePct || 0;
      const value = a.quantity * currentPrice;
      const cost = a.quantity * a.avg_price;
      const pnl = value - cost;
      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

      return {
        ...a,
        currentPrice,
        changePct,
        value,
        cost,
        pnl,
        pnlPct,
      };
    });

  } catch (e) {
    console.error('[portfolio.getPortfolio]', e);
    return [];
  }
}

export async function getAsset(id) {
  try {
    return db.portfolio.get(id);

  } catch (e) {
    console.error('[portfolio.getAsset]', e);
    return null;
  }
}

export async function getPortfolioValue() {
  try {
    const items = await getPortfolio();
    return items.reduce((s, a) => s + a.value, 0);

  } catch (e) {
    console.error('[portfolio.getPortfolioValue]', e);
    return null;
  }
}

export async function getPortfolioPnL() {
  try {
    const items = await getPortfolio();
    return items.reduce((s, a) => s + a.pnl, 0);

  } catch (e) {
    console.error('[portfolio.getPortfolioPnL]', e);
    return null;
  }
}

export async function getDailyChange() {
  try {
    const items = await getPortfolio();
    return items.reduce((s, a) => s + (a.value * a.changePct / 100), 0);

  } catch (e) {
    console.error('[portfolio.getDailyChange]', e);
    return null;
  }
}

export async function getDistribution(groupBy = 'sector') {
  try {
    const items = await getPortfolio();
    const totalValue = items.reduce((s, a) => s + a.value, 0);
    if (totalValue === 0) return [];

    const grouped = {};
    for (const a of items) {
      const key = a[groupBy] || 'Прочее';
      grouped[key] = (grouped[key] || 0) + a.value;
    }

    return Object.entries(grouped)
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        percent: Math.round((value / totalValue) * 100),
      }))
      .sort((a, b) => b.value - a.value);

  } catch (e) {
    console.error('[portfolio.getDistribution]', e);
    return [];
  }
}

export async function getPortfolioSummary() {
  try {
    const items = await getPortfolio();
    const totalValue = items.reduce((s, a) => s + a.value, 0);
    const totalCost = items.reduce((s, a) => s + a.cost, 0);
    return { totalValue, totalCost, pnl: totalValue - totalCost };

  } catch (e) {
    console.error('[portfolio.getPortfolioSummary]', e);
    return null;
  }
}

export async function addAssetFromTrade(trade) {
  try {
    let asset = await db.portfolio.where('ticker').equals(trade.ticker).first();

    if (!asset) {
      if (trade.type === 'sell') return;
      const id = await db.portfolio.add({
        ticker: trade.ticker,
        name: trade.name || trade.ticker,
        type: trade.assetType || 'stock',
        broker: trade.broker || '',
        quantity: trade.quantity,
        avg_price: trade.price,
        currency: trade.currency || 'RUB',
        sector: trade.sector || 'Прочее',
      });
      return db.portfolio.get(id);
    }

    if (trade.type === 'buy') {
      const totalCost = asset.quantity * asset.avg_price + trade.quantity * trade.price;
      const totalQty = asset.quantity + trade.quantity;
      await db.portfolio.update(asset.id, {
        quantity: totalQty,
        avg_price: totalQty > 0 ? totalCost / totalQty : 0,
      });
    } else {
      const newQty = asset.quantity - trade.quantity;
      if (newQty <= 0) {
        await db.portfolio.delete(asset.id);
        return null;
      }
      await db.portfolio.update(asset.id, { quantity: newQty });
    }

    return db.portfolio.get(asset.id);

  } catch (e) {
    console.error('[portfolio.addAssetFromTrade]', e);
    throw e;
  }
}

export async function recalcAvgPrice(ticker) {
  try {
    const trades = await db.trades.where('ticker').equals(ticker).toArray();
    trades.sort((a, b) => a.date.localeCompare(b.date));

    let totalQty = 0;
    let totalCost = 0;

    for (const t of trades) {
      if (t.type === 'buy') {
        totalCost += t.quantity * t.price;
        totalQty += t.quantity;
      } else {
        if (totalQty > 0) {
          const ratio = t.quantity / totalQty;
          totalCost -= totalCost * ratio;
          totalQty -= t.quantity;
        }
      }
    }

    const asset = await db.portfolio.where('ticker').equals(ticker).first();
    if (asset && totalQty > 0) {
      await db.portfolio.update(asset.id, {
        quantity: totalQty,
        avg_price: totalCost / totalQty,
      });
    } else if (asset && totalQty <= 0) {
      await db.portfolio.delete(asset.id);
    }

    return totalQty > 0 ? totalCost / totalQty : 0;

  } catch (e) {
    console.error('[portfolio.recalcAvgPrice]', e);
    throw e;
  }
}

export async function removeAsset(id) {
  try {
    await db.portfolio.delete(id);

  } catch (e) {
    console.error('[portfolio.removeAsset]', e);
    throw e;
  }
}

/* ═══ E5 — Доходность vs бенчмарк ═══ */

export async function getPerformanceVsBenchmark(months = 6) {
  try {
    const result = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const trades = await db.trades.where('date').belowOrEqual(monthKey + '-31').toArray();
      let portfolioValue = 0;
      const holdings = {};
      for (const t of trades) {
        if (t.type === 'buy') holdings[t.ticker] = (holdings[t.ticker] || 0) + t.quantity;
        if (t.type === 'sell') holdings[t.ticker] = (holdings[t.ticker] || 0) - t.quantity;
      }
      for (const [ticker, qty] of Object.entries(holdings)) {
        if (qty > 0) {
          const quote = await db.quotes.get(ticker);
          portfolioValue += qty * (quote?.last_price || 0);
        }
      }

      result.push({ month: monthKey, portfolio: portfolioValue, moex: null });
    }

    const startPortfolio = result[0]?.portfolio || 1;
    const normalized = result.map(r => ({
      month: r.month,
      portfolio: Math.round((r.portfolio / startPortfolio) * 100),
      moex: 100,
    }));

    return normalized;
  } catch {
    return [];
  }
}

/**
 * Returns metadata for a given broker (margin, divForecast, etc.).
 * Stub implementation — returns null to indicate no stored metadata.
 */
export async function getBrokerMeta(_broker) {
  return null;
}

/**
 * Лёгкая карта тикер → кол-во акций (без загрузки котировок).
 * @returns {Promise<Object>} { 'SBER': 10, 'GAZP': 50, ... }
 */
export async function getPortfolioQuantities() {
  try {
    const assets = await db.portfolio.toArray();
    return Object.fromEntries(assets.map(a => [a.ticker, a.quantity || 0]));
  } catch (e) {
    console.error('[portfolio.getPortfolioQuantities]', e);
    return {};
  }
}
