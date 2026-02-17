import db from '../db/index';

/* ── CRUD ── */

export async function addAccount(data) {
  try {
    const record = {
      name: data.name || '',
      bank: data.bank || '',
      type: data.type || 'debit',
      currency: data.currency || 'KZT',
      balance: data.balance || 0,
      updated_at: new Date().toISOString(),
      color: data.color || '007AFF',
      icon: data.icon || null,
      last4: data.last4 || null,
      is_active: data.is_active !== undefined ? data.is_active : true,
    };
    const id = await db.accounts.add(record);
    return { ...record, id };

  } catch (e) {
    console.error('[accounts.addAccount]', e);
    throw e;
  }
}

export async function getAccount(id) {
  try {
    return db.accounts.get(id);

  } catch (e) {
    console.error('[accounts.getAccount]', e);
    return null;
  }
}

export async function getAccounts() {
  try {
    return db.accounts.toArray();

  } catch (e) {
    console.error('[accounts.getAccounts]', e);
    return [];
  }
}

export async function getActiveAccounts() {
  try {
    return db.accounts.filter(a => a.is_active !== false).toArray();

  } catch (e) {
    console.error('[accounts.getActiveAccounts]', e);
    return [];
  }
}

export async function updateAccount(id, data) {
  try {
    const updates = { ...data, updated_at: new Date().toISOString() };
    await db.accounts.update(id, updates);
    return db.accounts.get(id);

  } catch (e) {
    console.error('[accounts.updateAccount]', e);
    throw e;
  }
}

/**
 * Удаление с проверкой связей.
 * @returns {{ deleted: boolean, reason?: string }}
 */
export async function deleteAccount(id) {
  try {
    const expenseCount = await db.expenses.where('account_id').equals(id).count();
    const incomeCount = await db.incomes.where('account_id').equals(id).count();

    if (expenseCount > 0 || incomeCount > 0) {
      return {
        deleted: false,
        reason: `${expenseCount} расходов, ${incomeCount} доходов привязано к счёту. Сначала удалите или перенесите их.`,
      };
    }

    await db.accounts.delete(id);
    return { deleted: true };

  } catch (e) {
    console.error('[accounts.deleteAccount]', e);
    throw e;
  }
}

/* ── Net Worth ── */

export async function getNetWorth() {
  try {
    const accounts = await db.accounts.filter(a => a.is_active !== false).toArray();
    const credits = await db.credits.filter(c => c.is_active !== false).toArray();

    const assets = accounts
      .filter(a => ['debit', 'savings', 'cash', 'investment'].includes(a.type))
      .reduce((s, a) => s + (a.balance || 0), 0);
    const debt = credits.reduce((s, c) => s + (c.remaining_amount || 0), 0);

    return {
      assets: Math.round(assets * 100) / 100,
      debt: Math.round(debt * 100) / 100,
      net: Math.round((assets - debt) * 100) / 100,
    };

  } catch (e) {
    console.error('[accounts.getNetWorth]', e);
    return { assets: 0, debt: 0, net: 0 };
  }
}

/**
 * Баланс конкретного счёта.
 */
export async function getAccountBalance(id) {
  try {
    const account = await db.accounts.get(id);
    if (!account) return null;
    return {
      balance: account.balance || 0,
      currency: account.currency || 'KZT',
      updated_at: account.updated_at,
    };

  } catch (e) {
    console.error('[accounts.getAccountBalance]', e);
    return null;
  }
}

/* ── A2.6 — Перевод между счетами ── */

export async function transferBetweenAccounts(fromId, toId, amount, description) {
  try {
    if (!fromId || !toId || fromId === toId) throw new Error('Выберите разные счета');
    if (!amount || amount <= 0) throw new Error('Сумма должна быть > 0');

    const fromAcc = await db.accounts.get(fromId);
    const toAcc = await db.accounts.get(toId);
    if (!fromAcc || !toAcc) throw new Error('Счёт не найден');

    await db.transaction('rw', [db.accounts, db.expenses, db.incomes], async () => {
      await db.accounts.update(fromId, {
        balance: (fromAcc.balance || 0) - amount,
        updated_at: new Date().toISOString(),
      });
      await db.accounts.update(toId, {
        balance: (toAcc.balance || 0) + amount,
        updated_at: new Date().toISOString(),
      });

      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const time = now.toTimeString().slice(0, 5);
      const desc = description || `${fromAcc.name} → ${toAcc.name}`;

      await db.expenses.add({
        amount,
        amount_base: amount,
        currency: fromAcc.currency || 'RUB',
        category_id: null,
        category_path_snapshot: 'Перевод',
        description: desc,
        date, time,
        ts: Date.now(),
        account_id: fromId,
        account_name_snapshot: fromAcc.name,
        source: 'transfer',
      });

      await db.incomes.add({
        amount,
        currency: toAcc.currency || 'RUB',
        source_name: desc,
        date, time,
        ts: Date.now(),
        account_id: toId,
        type: 'transfer',
      });
    });

  } catch (e) {
    console.error('[accounts.transferBetweenAccounts]', e);
    throw e;
  }
}

/* ── Account Detail queries ── */

/**
 * Последние операции по счёту (расходы + доходы, смешанные по времени).
 * @param {number} accountId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function getAccountOperations(accountId, limit = 20) {
  try {
    const [expenses, incomes] = await Promise.all([
      db.expenses.where('account_id').equals(accountId).reverse().limit(limit).toArray(),
      db.incomes.where('account_id').equals(accountId).reverse().limit(Math.ceil(limit / 2)).toArray(),
    ]);
    const all = [
      ...expenses.map(e => ({ ...e, opType: 'expense' })),
      ...incomes.map(i => ({ ...i, opType: 'income' })),
    ];
    all.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return all.slice(0, limit);
  } catch (e) {
    console.error('[accounts.getAccountOperations]', e);
    return [];
  }
}

/**
 * Статистика счёта за текущий месяц.
 * @param {number} accountId
 * @returns {Promise<{spent: number, earned: number, txCount: number}|null>}
 */
export async function getAccountMonthStats(accountId) {
  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = monthStart.slice(0, 8) + '31';
    const [expenses, incomes] = await Promise.all([
      db.expenses.where('account_id').equals(accountId)
        .filter(e => e.date >= monthStart && e.date <= monthEnd).toArray(),
      db.incomes.where('account_id').equals(accountId)
        .filter(i => i.date >= monthStart && i.date <= monthEnd).toArray(),
    ]);
    return {
      spent: expenses.reduce((s, e) => s + (e.amount || 0), 0),
      earned: incomes.reduce((s, i) => s + (i.amount || 0), 0),
      txCount: expenses.length + incomes.length,
    };
  } catch (e) {
    console.error('[accounts.getAccountMonthStats]', e);
    return null;
  }
}
