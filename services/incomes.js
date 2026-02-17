/**
 * incomes.js — CRUD доходов + фильтры
 *
 * Таблица: incomes '++id, date, source, account_id'
 * Инвариант: amount_base фиксируется НА МОМЕНТ СОЗДАНИЯ.
 */

import db from '../db/index';
import { convert } from './currencies';
import { getSetting } from '../db/helpers';

// ─── Helpers ────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── CRUD ───────────────────────────────────────────────

export async function addIncome(data) {
  const baseCurrency = (await getSetting('default_currency')) || 'KZT';
  const date = data.date || today();

  // Снапшот счёта
  let accountSnapshot = data.account_name_snapshot || '';
  if (data.account_id && !accountSnapshot) {
    const acc = await db.accounts.get(data.account_id);
    if (acc) accountSnapshot = acc.name || `${acc.bank} ${acc.type}`;
  }

  // Конвертация
  const currency = data.currency || baseCurrency;
  let amountBase = data.amount;
  if (currency !== baseCurrency) {
    try {
      amountBase = await convert(data.amount, currency, baseCurrency);
    } catch {
      amountBase = data.amount;
    }
  }

  const record = {
    amount: data.amount,
    amount_base: Math.round(amountBase * 100) / 100,
    currency,
    source: data.source || 'Прочее',
    description: data.description || '',
    date,
    account_id: data.account_id || null,
    account_name_snapshot: accountSnapshot,
    is_recurring: data.is_recurring || false,
    recurrence: data.recurrence || null,
    created_at: new Date().toISOString(),
  };

  const id = await db.incomes.add(record);
  return { ...record, id };
}

export async function getIncome(id) {
  try {
    return db.incomes.get(id);

  } catch (e) {
    console.error('[incomes.getIncome]', e);
    return null;
  }
}

export async function updateIncome(id, data) {
  try {
    await db.incomes.update(id, data);
    return db.incomes.get(id);

  } catch (e) {
    console.error('[incomes.updateIncome]', e);
    throw e;
  }
}

export async function deleteIncome(id) {
  try {
    await db.incomes.delete(id);

  } catch (e) {
    console.error('[incomes.deleteIncome]', e);
    throw e;
  }
}

// ─── Фильтрованные списки ──────────────────────────────

export async function getIncomes({
    dateFrom,
    dateTo,
    source,
    accountId,
    limit = 50,
    offset = 0,
  } = {}) {
  try {
    let collection;

    if (dateFrom && dateTo) {
      collection = db.incomes.where('date').between(dateFrom, dateTo, true, true);
    } else if (dateFrom) {
      collection = db.incomes.where('date').aboveOrEqual(dateFrom);
    } else if (dateTo) {
      collection = db.incomes.where('date').belowOrEqual(dateTo);
    } else {
      collection = db.incomes.orderBy('date');
    }

    if (source || accountId) {
      collection = collection.filter(i => {
        if (source && i.source !== source) return false;
        if (accountId && i.account_id !== accountId) return false;
        return true;
      });
    }

    const results = await collection.reverse().toArray();
    return results.slice(offset, offset + limit);

  } catch (e) {
    console.error('[incomes.getIncomes]', e);
    return [];
  }
}

// ─── Агрегаты ───────────────────────────────────────────

/**
 * Итого доходов за месяц.
 * @param {string} month - 'YYYY-MM'
 */
export async function getMonthlyIncome(month) {
  try {
    const m = month || new Date().toISOString().slice(0, 7);
    const [y, mo] = m.split('-').map(Number);
    const lastDay = new Date(y, mo, 0).getDate();
    const dateFrom = `${m}-01`;
    const dateTo = `${m}-${String(lastDay).padStart(2, '0')}`;

    const incomes = await db.incomes
      .where('date')
      .between(dateFrom, dateTo, true, true)
      .toArray();

    const total = incomes.reduce((s, i) => s + i.amount_base, 0);

    // По источникам
    const bySource = new Map();
    for (const i of incomes) {
      const key = i.source || 'Прочее';
      bySource.set(key, (bySource.get(key) || 0) + i.amount_base);
    }

    return {
      total: Math.round(total * 100) / 100,
      bySource: [...bySource.entries()]
        .map(([source, sum]) => ({ source, sum: Math.round(sum * 100) / 100 }))
        .sort((a, b) => b.sum - a.sum),
    };

  } catch (e) {
    console.error('[incomes.getMonthlyIncome]', e);
    return [];
  }
}
