import db from '../db/index';
import { convert } from './currencies';
import { getSetting } from '../db/helpers';
import { emit } from './triggerBus';

/* ── Helpers ── */

function generateTs(date, time) {
  if (!date) return Date.now();
  const iso = time ? `${date}T${time}` : `${date}T00:00`;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return today().slice(0, 7); // YYYY-MM
}

/* ── CRUD ── */

export async function addExpense(data) {
  const baseCurrency = await getSetting('default_currency') || 'RUB';
  const date = data.date || today();
  const time = data.time || new Date().toTimeString().slice(0, 5);

  let categorySnapshot = data.category_path_snapshot;
  if (data.category_id && !categorySnapshot) {
    const cat = await db.categories.get(data.category_id);
    if (cat) categorySnapshot = cat.name;
  }

  let accountSnapshot = data.account_name_snapshot;
  if (data.account_id && !accountSnapshot) {
    const acc = await db.accounts.get(data.account_id);
    if (acc) accountSnapshot = `${acc.name} · ${acc.bank || acc.type}`;
  }

  const currency = data.currency || baseCurrency;
  let amountBase = data.amount;
  if (currency !== baseCurrency) {
    try { amountBase = await convert(data.amount, currency, baseCurrency); }
    catch { amountBase = data.amount; /* fallback 1:1 */ }
  }

  const record = {
    amount: data.amount,
    amount_base: Math.round(amountBase * 100) / 100,
    currency,
    category_id: data.category_id || null,
    category_path_snapshot: categorySnapshot,
    description: data.description || '',
    date, time,
    ts: generateTs(date, time),
    account_id: data.account_id || null,
    account_name_snapshot: accountSnapshot,
    source: data.source || 'manual',
    receipt_items: data.receipt_items || null,
    created_at: new Date().toISOString(),
  };

  const id = await db.expenses.add(record);
  emit('expense_added', { amount: record.amount_base, category: categorySnapshot, description: record.description }).catch(() => {});
  return { ...record, id };
}

export async function getExpense(id) {
  try {
    return db.expenses.get(id);

  } catch (e) {
    console.error('[expenses.getExpense]', e);
    return null;
  }
}

export async function updateExpense(id, data) {
  try {
    const updates = { ...data };
    if (data.date || data.time) {
      const existing = await db.expenses.get(id);
      if (existing) {
        const date = data.date || existing.date;
        const time = data.time || existing.time;
        updates.ts = generateTs(date, time);
      }
    }
    await db.expenses.update(id, updates);
    return db.expenses.get(id);

  } catch (e) {
    console.error('[expenses.updateExpense]', e);
    throw e;
  }
}

export async function deleteExpense(id) {
  try {
    await db.expenses.delete(id);

  } catch (e) {
    console.error('[expenses.deleteExpense]', e);
    throw e;
  }
}

/* ── Queries ── */

export async function getExpenses({ dateFrom, dateTo, categoryId, accountId, source, limit = 50, offset = 0 } = {}) {
  try {
    let collection;

    if (dateFrom && dateTo) {
      collection = db.expenses.where('date').between(dateFrom, dateTo, true, true);
    } else if (dateFrom) {
      collection = db.expenses.where('date').aboveOrEqual(dateFrom);
    } else if (dateTo) {
      collection = db.expenses.where('date').belowOrEqual(dateTo);
    } else {
      collection = db.expenses.orderBy('ts');
    }

    if (categoryId || accountId || source) {
      collection = collection.filter(e => {
        if (categoryId && e.category_id !== categoryId) return false;
        if (accountId && e.account_id !== accountId) return false;
        if (source && e.source !== source) return false;
        return true;
      });
    }

    const results = await collection.reverse().toArray();
    return results.slice(offset, offset + limit);

  } catch (e) {
    console.error('[expenses.getExpenses]', e);
    return [];
  }
}

/**
 * @param {string} month — YYYY-MM
 * @returns {{ total, byCategory: [{id, name, icon, sum, percent}], byDay: [{date, sum}] }}
 */
export async function getMonthlyStats(month) {
  try {
    const m = month || currentMonth();
    const dateFrom = `${m}-01`;
    const [y, mo] = m.split('-').map(Number);
    const lastDay = new Date(y, mo, 0).getDate();
    const dateTo = `${m}-${String(lastDay).padStart(2, '0')}`;

    const expenses = await db.expenses
      .where('date').between(dateFrom, dateTo, true, true)
      .toArray();

    const total = expenses.reduce((s, e) => s + (e.amount_base), 0);

    // By category
    const catMap = new Map();
    for (const e of expenses) {
      const key = e.category_id || 0;
      if (!catMap.has(key))
        catMap.set(key, { id: key, name: e.category_path_snapshot || 'Без категории', icon: '', sum: 0 });
      catMap.get(key).sum += e.amount_base;
    }

    const catIds = [...catMap.keys()].filter(k => k !== 0);
    if (catIds.length > 0) {
      const cats = await db.categories.bulkGet(catIds);
      for (const cat of cats) {
        if (cat && catMap.has(cat.id)) {
          const entry = catMap.get(cat.id);
          entry.icon = cat.icon;
          entry.name = cat.name || entry.name;
        }
      }
    }

    const byCategory = [...catMap.values()]
      .map(c => ({ ...c, percent: total > 0 ? Math.round((c.sum / total) * 100) : 0 }))
      .sort((a, b) => b.sum - a.sum);

    // By day
    const dayMap = new Map();
    for (const e of expenses) {
      dayMap.set(e.date, (dayMap.get(e.date) || 0) + e.amount_base);
    }
    const byDay = [...dayMap.entries()]
      .map(([date, sum]) => ({ date, sum }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { total: Math.round(total * 100) / 100, byCategory, byDay };

  } catch (e) {
    console.error('[expenses.getMonthlyStats]', e);
    return [];
  }
}

/**
 * @returns {{ spent, count, dailyLimit }}
 */
export async function getTodayStats() {
  try {
    const d = today();
    const expenses = await db.expenses.where('date').equals(d).toArray();
    const spent = expenses.reduce((s, e) => s + (e.amount_base), 0);

    // dailyLimit
    const m = d.slice(0, 7);
    const [y, mo] = m.split('-').map(Number);
    const lastDay = new Date(y, mo, 0).getDate();
    const currentDay = Number(d.slice(8, 10));
    const daysLeft = lastDay - currentDay + 1;

    const budgets = await db.budgets.where('month').equals(m).toArray();
    const totalBudget = budgets.reduce((s, b) => s + (b.limit || 0), 0);
    const monthExpenses = await db.expenses
      .where('date').between(`${m}-01`, d, true, true)
      .toArray();
    const monthSpent = monthExpenses.reduce((s, e) => s + (e.amount_base), 0);
    const remaining = totalBudget - monthSpent;
    const dailyLimit = daysLeft > 0 ? Math.round(remaining / daysLeft) : 0;

    return {
      spent: Math.round(spent * 100) / 100,
      count: expenses.length,
      dailyLimit: Math.max(0, dailyLimit),
    };

  } catch (e) {
    console.error('[expenses.getTodayStats]', e);
    return [];
  }
}

/**
 * @returns {{ spent, avg }}
 */
export async function getWeeklyStats() {
  try {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 6);
    const dateFrom = weekAgo.toISOString().slice(0, 10);
    const dateTo = today();

    const expenses = await db.expenses
      .where('date').between(dateFrom, dateTo, true, true)
      .toArray();
    const spent = expenses.reduce((s, e) => s + (e.amount_base), 0);

    return {
      spent: Math.round(spent * 100) / 100,
      avg: Math.round((spent / 7) * 100) / 100,
    };

  } catch (e) {
    console.error('[expenses.getWeeklyStats]', e);
    return [];
  }
}

/**
 * @param {string} month — YYYY-MM
 */
export async function getCategoryBreakdown(month) {
  try {
    const stats = await getMonthlyStats(month);
    return stats.byCategory;

  } catch (e) {
    console.error('[expenses.getCategoryBreakdown]', e);
    return null;
  }
}

/**
 * @param {string} month — YYYY-MM
 * @returns {Array<{date, amount}>}
 */
export async function getDailyTrend(month) {
  try {
    const stats = await getMonthlyStats(month);
    return stats.byDay.map(d => ({ date: d.date, amount: d.sum }));

  } catch (e) {
    console.error('[expenses.getDailyTrend]', e);
    return null;
  }
}

/* ── A1.4 — Yearly bar chart ── */

/**
 * 12 месяцев за год.
 * @param {number} year — 2026
 * @returns {Array<{month: string, label: string, total: number}>}
 */
export async function getYearlyStats(year) {
  try {
    const y = year || new Date().getFullYear();
    const dateFrom = `${y}-01-01`;
    const dateTo = `${y}-12-31`;
    const expenses = await db.expenses
      .where('date').between(dateFrom, dateTo, true, true)
      .toArray();

    const LABELS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      const total = expenses
        .filter(e => e.date?.startsWith(key))
        .reduce((s, e) => s + (e.amount_base || 0), 0);
      months.push({ month: key, label: LABELS[m - 1], total: Math.round(total) });
    }
    return months;

  } catch (e) {
    console.error('[expenses.getYearlyStats]', e);
    return [];
  }
}

/**
 * R2.2: Авто-расходы — повторяющиеся расходы.
 * Хранятся как шаблоны в settings, процессятся при открытии приложения.
 */
export async function getRecurringExpenses() {
  try {
    const raw = await getSetting('recurring_expenses');
    return JSON.parse(raw) || [];
  } catch { return []; }
}

export async function addRecurringExpense(template) {
  const list = await getRecurringExpenses();
  list.push({
    id: Date.now().toString(36),
    ...template,
    last_processed: null,
    is_active: true,
  });
  await setSetting('recurring_expenses', JSON.stringify(list));
}

export async function removeRecurringExpense(id) {
  const list = await getRecurringExpenses();
  await setSetting('recurring_expenses', JSON.stringify(list.filter(r => r.id !== id)));
}

export async function processRecurringExpenses() {
  const list = await getRecurringExpenses();
  const today = new Date().toISOString().slice(0, 10);
  let created = 0;

  for (const tmpl of list) {
    if (!tmpl.is_active) continue;

    const dayOfMonth = tmpl.day_of_month || 1;
    const todayDay = new Date().getDate();
    const thisMonth = today.slice(0, 7);
    const processDate = `${thisMonth}-${String(dayOfMonth).padStart(2, '0')}`;

    // Только если день совпал и ещё не обработан в этом месяце
    if (todayDay === dayOfMonth && tmpl.last_processed !== thisMonth) {
      await addExpense({
        amount: tmpl.amount,
        category_id: tmpl.category_id,
        description: tmpl.description || 'Авто-расход',
        date: processDate,
        is_auto: true,
      });
      tmpl.last_processed = thisMonth;
      created++;
    }
  }

  if (created > 0) {
    await setSetting('recurring_expenses', JSON.stringify(list));
  }
  return created;
}

export async function getDailyBudgetRemaining() {
  try {
    const budget = await getSetting('monthly_budget');
    if (!budget || Number(budget) <= 0) return null;
    const monthly = Number(budget);
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daily = Math.round(monthly / daysInMonth);
    const today = now.toISOString().slice(0, 10);
    const expenses = await db.expenses.where('date').equals(today).toArray();
    const spent = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    return { daily, remaining: daily - spent };
  } catch {
    return null;
  }
}
