import db from '../db/index';

export async function getNetWorth() {
  try {
    // Активы: счета
    const accounts = await db.accounts.toArray();
    const accountsByType = {};
    for (const a of accounts) {
      const t = a.type || 'other';
      accountsByType[t] = (accountsByType[t] || 0) + (a.balance || 0);
    }

    const accountsTotal = (accountsByType.debit || 0)
      + (accountsByType.savings || 0)
      + (accountsByType.cash || 0);

    // Активы: инвестиции
    const portfolio = await db.portfolio.toArray();
    const quotes = await db.quotes.toArray();
    const qMap = Object.fromEntries(quotes.map(q => [q.ticker, q.price]));
    const investTotal = portfolio.reduce(
      (s, p) => s + p.quantity * (qMap[p.ticker] || p.avg_price), 0
    );

    // Пассивы: кредиты
    const credits = await db.credits.toArray();
    const creditsTotal = credits.reduce((s, c) => s + (c.remaining_amount || 0), 0);

    // Пассивы: кредитные карты (лимит − баланс)
    const creditCards = accounts
      .filter(a => a.type === 'credit')
      .reduce((s, a) => s + Math.max(0, (a.credit_limit || 0) - (a.balance || 0)), 0);

    const total = accountsTotal + investTotal - creditsTotal - creditCards;

    return {
      assets: {
        accounts: Math.round(accountsTotal),
        investments: Math.round(investTotal),
        savings: Math.round(accountsByType.savings || 0),
        cash: Math.round(accountsByType.cash || 0),
      },
      liabilities: {
        credits: Math.round(creditsTotal),
        creditCards: Math.round(creditCards),
      },
      total: Math.round(total),
    };

  } catch (e) {
    console.error('[networth.getNetWorth]', e);
    return [];
  }
}

export async function saveSnapshot() {
  try {
    const nw = await getNetWorth();
    const today = new Date().toISOString().split('T')[0];
    await db.settings.put({ key: `networth_${today}`, value: nw.total });

  } catch (e) {
    console.error('[networth.saveSnapshot]', e);
    throw e;
  }
}

export async function getNetWorthHistory(months = 12) {
  try {
    const all = await db.settings.toArray();
    const snapshots = all
      .filter(s => s.key.startsWith('networth_'))
      .map(s => ({ date: s.key.replace('networth_', ''), value: s.value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (months) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      return snapshots.filter(s => s.date >= cutoffStr);
    }
    return snapshots;

  } catch (e) {
    console.error('[networth.getNetWorthHistory]', e);
    return [];
  }
}
