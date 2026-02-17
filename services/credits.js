/**
 * credits.js — CRUD кредитов + график погашения + досрочное погашение
 *
 * Таблица: credits '++id, name, next_payment_date'
 * Типы: 'mortgage' | 'consumer' | 'credit_card' | 'auto'
 */

import db from '../db/index';

// ─── CRUD ───────────────────────────────────────────────

export async function addCredit(data) {
  try {
    const record = {
      name: data.name || '',
      type: data.type || 'consumer',
      bank: data.bank || '',
      original_amount: data.original_amount || 0,
      remaining_amount: data.remaining_amount || data.original_amount || 0,
      interest_rate: data.interest_rate || 0,
      monthly_payment: data.monthly_payment || 0,
      payment_day: data.payment_day || 1,
      next_payment_date: data.next_payment_date || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      credit_limit: data.credit_limit || null,
      grace_period_days: data.grace_period_days || null,
      is_active: data.is_active !== undefined ? data.is_active : true,
    };

    const id = await db.credits.add(record);
    return { ...record, id };

  } catch (e) {
    console.error('[credits.addCredit]', e);
    throw e;
  }
}

export async function getCredit(id) {
  try {
    return db.credits.get(id);

  } catch (e) {
    console.error('[credits.getCredit]', e);
    return null;
  }
}

export async function getCredits() {
  try {
    return db.credits.toArray();

  } catch (e) {
    console.error('[credits.getCredits]', e);
    return [];
  }
}

export async function getActiveCredits() {
  try {
    return db.credits.filter(c => c.is_active !== false).toArray();

  } catch (e) {
    console.error('[credits.getActiveCredits]', e);
    return [];
  }
}

export async function updateCredit(id, data) {
  try {
    await db.credits.update(id, data);
    return db.credits.get(id);

  } catch (e) {
    console.error('[credits.updateCredit]', e);
    throw e;
  }
}

export async function deleteCredit(id) {
  try {
    await db.credits.delete(id);

  } catch (e) {
    console.error('[credits.deleteCredit]', e);
    throw e;
  }
}

// ─── Ближайшие платежи ──────────────────────────────────

/**
 * Платежи в ближайшие N дней.
 * @param {number} days - горизонт (по умолчанию 30)
 */
export async function getUpcomingPayments(days = 30) {
  try {
    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + days);
    const horizonStr = horizon.toISOString().slice(0, 10);
    const todayStr = now.toISOString().slice(0, 10);

    const credits = await db.credits
      .where('next_payment_date')
      .between(todayStr, horizonStr, true, true)
      .toArray();

    return credits
      .filter(c => c.is_active !== false)
      .map(c => ({
        credit_id: c.id,
        name: c.name,
        bank: c.bank,
        date: c.next_payment_date,
        amount: c.monthly_payment,
        remaining: c.remaining_amount,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

  } catch (e) {
    console.error('[credits.getUpcomingPayments]', e);
    return [];
  }
}

// ─── График погашения ───────────────────────────────────

// ─── Досрочное погашение ────────────────────────────────

/**
 * Рассчитать экономию при досрочном погашении.
 * @param {object} credit - запись кредита
 * @param {number} extraMonthly - дополнительный ежемесячный платёж
 * @returns {{ originalMonths, newMonths, savedMonths, savedInterest }}
 */
export function calculateEarlyPayoff(credit, extraMonthly) {
  const monthlyRate = (credit.interest_rate || 0) / 100 / 12;
  const basePay = credit.monthly_payment || 0;

  if (basePay <= 0 || monthlyRate <= 0) {
    return { originalMonths: 0, newMonths: 0, savedMonths: 0, savedInterest: 0 };
  }

  // Считаем оригинальный график
  function simulate(payment) {
    let rem = credit.remaining_amount || 0;
    let months = 0;
    let totalInterest = 0;
    while (rem > 0 && months < 600) { // max 50 лет
      const interest = rem * monthlyRate;
      totalInterest += interest;
      const principal = Math.min(payment - interest, rem);
      if (principal <= 0) break; // платёж не покрывает проценты
      rem -= principal;
      months++;
    }
    return { months, totalInterest: Math.round(totalInterest * 100) / 100 };
  }

  const original = simulate(basePay);
  const accelerated = simulate(basePay + extraMonthly);

  return {
    originalMonths: original.months,
    newMonths: accelerated.months,
    savedMonths: original.months - accelerated.months,
    savedInterest: Math.round((original.totalInterest - accelerated.totalInterest) * 100) / 100,
  };
}
