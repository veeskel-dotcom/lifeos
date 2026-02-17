/**
 * budgets.js — CRUD бюджетов + динамический расчёт spent
 *
 * Таблица: budgets '++id, month, category_id'
 * spent считается динамически из expenses за месяц и категорию.
 */

import db from '../db/index';

// ─── Helpers ────────────────────────────────────────────

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthRange(month) {
  const m = month || currentMonth();
  const [y, mo] = m.split('-').map(Number);
  const lastDay = new Date(y, mo, 0).getDate();
  return {
    dateFrom: `${m}-01`,
    dateTo: `${m}-${String(lastDay).padStart(2, '0')}`,
  };
}

/**
 * Получить расходы за месяц, сгруппированные по category_id.
 * @returns {Map<number|null, number>} category_id → сумма amount_base
 */
async function getMonthlyExpensesByCategory(month) {
  try {
    const { dateFrom, dateTo } = monthRange(month);
    const expenses = await db.expenses
      .where('date')
      .between(dateFrom, dateTo, true, true)
      .toArray();

    const map = new Map();
    let total = 0;
    for (const e of expenses) {
      const key = e.category_id || null;
      map.set(key, (map.get(key) || 0) + e.amount_base);
      total += e.amount_base;
    }
    map.set('__total__', total);
    return map;
  } catch (e) {
    console.error('[budgets.getMonthlyExpensesByCategory]', e);
    return new Map();
  }
}

// ─── CRUD ───────────────────────────────────────────────

/**
 * Установить лимит бюджета для категории в месяце.
 * Если бюджет уже есть — обновляет, иначе создаёт.
 * @param {string} month - 'YYYY-MM'
 * @param {number|null} categoryId - null = общий бюджет
 * @param {number} limit - сумма лимита
 */
export async function setBudgetLimit(month, categoryId, limit) {
  try {
    const m = month || currentMonth();

    // Ищем существующий бюджет для этой категории и месяца
    const existing = await db.budgets
      .where('month')
      .equals(m)
      .filter(b => b.category_id === categoryId)
      .first();

    // Снапшот категории
    let catName = 'Общий';
    if (categoryId) {
      const cat = await db.categories.get(categoryId);
      if (cat) catName = cat.name;
    }

    if (existing) {
      await db.budgets.update(existing.id, { limit, category_name_snapshot: catName });
      return db.budgets.get(existing.id);
    }

    const id = await db.budgets.add({
      month: m,
      category_id: categoryId,
      category_name_snapshot: catName,
      limit,
    });

    return db.budgets.get(id);

  } catch (e) {
    console.error('[budgets.setBudgetLimit]', e);
    throw e;
  }
}

export async function deleteBudget(id) {
  try {
    await db.budgets.delete(id);

  } catch (e) {
    console.error('[budgets.deleteBudget]', e);
    throw e;
  }
}

// ─── Запросы ────────────────────────────────────────────

/**
 * Все бюджеты за месяц с динамическим spent.
 * @param {string} month - 'YYYY-MM'
 * @returns {Array<{id, category_id, category_name_snapshot, limit, spent, percent, remaining}>}
 */
export async function getBudgets(month) {
  try {
    const m = month || currentMonth();
    const budgets = await db.budgets.where('month').equals(m).toArray();
    const spentMap = await getMonthlyExpensesByCategory(m);

    return budgets.map(b => {
      const spent = b.category_id
        ? (spentMap.get(b.category_id) || 0)
        : (spentMap.get('__total__') || 0);
      const rounded = Math.round(spent * 100) / 100;
      const percent = b.limit > 0 ? Math.round((rounded / b.limit) * 100) : 0;

      return {
        id: b.id,
        category_id: b.category_id,
        category_name_snapshot: b.category_name_snapshot || 'Общий',
        limit: b.limit,
        spent: rounded,
        percent,
        remaining: Math.round((b.limit - rounded) * 100) / 100,
      };
    });

  } catch (e) {
    console.error('[budgets.getBudgets]', e);
    return [];
  }
}

/**
 * Общий бюджет за месяц: итого лимит, потрачено, остаток, дневной лимит.
 * @param {string} month - 'YYYY-MM'
 */
export async function getOverallBudget(month) {
  try {
    const m = month || currentMonth();
    const budgets = await db.budgets.where('month').equals(m).toArray();
    const totalLimit = budgets.reduce((s, b) => s + (b.limit || 0), 0);

    const spentMap = await getMonthlyExpensesByCategory(m);
    const spent = spentMap.get('__total__') || 0;
    const remaining = totalLimit - spent;

    // Дневной лимит: остаток / оставшиеся дни
    const today = new Date();
    const [y, mo] = m.split('-').map(Number);
    const lastDay = new Date(y, mo, 0).getDate();
    const currentDay = today.getDate();
    const daysLeft = Math.max(1, lastDay - currentDay + 1);

    return {
      total: totalLimit,
      spent: Math.round(spent * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      dailyLimit: Math.max(0, Math.round(remaining / daysLeft)),
    };

  } catch (e) {
    console.error('[budgets.getOverallBudget]', e);
    return { total: 0, spent: 0, remaining: 0, dailyLimit: 0 };
  }
}

/**
 * Нераспределённый бюджет: общий лимит − Σ лимитов по категориям.
 * @param {string} month - 'YYYY-MM'
 */
export async function getUnallocated(month) {
  try {
    const m = month || currentMonth();
    const budgets = await db.budgets.where('month').equals(m).toArray();

    const overall = budgets.find(b => b.category_id === null);
    const categoryLimits = budgets
      .filter(b => b.category_id !== null)
      .reduce((s, b) => s + (b.limit || 0), 0);

    const totalBudget = overall ? overall.limit : 0;

    return {
      total: totalBudget,
      allocated: categoryLimits,
      unallocated: totalBudget - categoryLimits,
    };

  } catch (e) {
    console.error('[budgets.getUnallocated]', e);
    return { total: 0, allocated: 0, unallocated: 0 };
  }
}
