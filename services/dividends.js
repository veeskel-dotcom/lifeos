import db from '../db/index';
import { getPortfolioSummary } from './portfolio';

export async function addDividend(data) {
  try {
    const div = {
      ticker: data.ticker,
      ex_date: data.ex_date,
      payment_date: data.payment_date || null,
      amount_per_share: data.amount_per_share,
      currency: data.currency || 'RUB',
      is_received: false,
      created_at: new Date().toISOString(),
    };
    const id = await db.dividends.add(div);
    return { ...div, id };

  } catch (e) {
    console.error('[dividends.addDividend]', e);
    throw e;
  }
}

export async function getDividends(ticker) {
  try {
    if (ticker) {
      return db.dividends.where('ticker').equals(ticker).toArray();
    }
    return db.dividends.toArray();

  } catch (e) {
    console.error('[dividends.getDividends]', e);
    return [];
  }
}

export async function getUpcomingDividends() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const all = await db.dividends.where('ex_date').above(today).sortBy('ex_date');
    return all;

  } catch (e) {
    console.error('[dividends.getUpcomingDividends]', e);
    return [];
  }
}

export async function markReceived(id) {
  try {
    await db.dividends.update(id, { is_received: true });

  } catch (e) {
    console.error('[dividends.markReceived]', e);
    throw e;
  }
}

export async function getTotalDividendIncome(year) {
  try {
    let divs = await db.dividends.filter(d => d.is_received).toArray();
    if (year) {
      divs = divs.filter(d => d.ex_date?.startsWith(String(year)));
    }

    const portfolio = await db.portfolio.toArray();
    const qtyMap = Object.fromEntries(portfolio.map(p => [p.ticker, p.quantity]));

    return divs.reduce((s, d) => {
      const qty = qtyMap[d.ticker] || 0;
      return s + d.amount_per_share * qty;
    }, 0);

  } catch (e) {
    console.error('[dividends.getTotalDividendIncome]', e);
    return [];
  }
}

export async function deleteDividend(id) {
  try {
    await db.dividends.delete(id);

  } catch (e) {
    console.error('[dividends.deleteDividend]', e);
    throw e;
  }
}

/* ═══ E7 — Дивидендная доходность ═══ */

export async function getDividendYield() {
  try {
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const yearAgoStr = yearAgo.toISOString().slice(0, 10);

    const received = await db.dividends
      .where('ex_date').above(yearAgoStr)
      .filter(d => d.is_received)
      .toArray();

    const portfolio = await db.portfolio.toArray();
    const qtyMap = Object.fromEntries(portfolio.map(p => [p.ticker, p.quantity]));

    const totalDiv = received.reduce((s, d) => {
      const qty = qtyMap[d.ticker] || 0;
      return s + (d.amount_per_share || 0) * qty;
    }, 0);

    const summary = await getPortfolioSummary();
    const yieldPct = summary.totalValue > 0 ? (totalDiv / summary.totalValue * 100) : 0;

    return {
      totalDividends: Math.round(totalDiv),
      portfolioValue: summary.totalValue,
      yield: Math.round(yieldPct * 10) / 10,
    };
  } catch {
    return { totalDividends: 0, portfolioValue: 0, yield: 0 };
  }
}
