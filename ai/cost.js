import { getSetting, setSetting } from '../db/helpers';
import { AI_LIMITS } from '../utils/constants';

// ═══ Записать использование после каждого вызова ═══
export async function trackUsage({ model, prompt_tokens, completion_tokens, cost_usd }) {
  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);

  // Дневной счётчик
  const dailyKey = `ai_daily_${today}`;
  const daily = (await getSetting(dailyKey)) || { calls: 0, cost: 0 };
  daily.calls += 1;
  daily.cost += cost_usd || 0;
  await setSetting(dailyKey, daily);

  // Месячный счётчик
  const monthlyKey = `ai_monthly_${month}`;
  const monthly = (await getSetting(monthlyKey)) || { calls: 0, cost: 0 };
  monthly.calls += 1;
  monthly.cost += cost_usd || 0;
  await setSetting(monthlyKey, monthly);

  // Всего за всё время
  const total = (await getSetting('ai_total_usage')) || { calls: 0, cost: 0 };
  total.calls += 1;
  total.cost += cost_usd || 0;
  await setSetting('ai_total_usage', total);

  // Timestamp последнего вызова
  await setSetting('ai_last_call_ts', Date.now());

  return { daily, monthly };
}

// ═══ Получить пользовательские лимиты (с fallback на дефолты) ═══
async function getUserLimits() {
  const dailyCalls = (await getSetting('ai_daily_calls_limit')) || AI_LIMITS.daily_calls;
  const dailyCost = (await getSetting('ai_daily_cost_limit')) || AI_LIMITS.daily_cost_cap;
  const monthlyCost = (await getSetting('ai_monthly_limit')) || AI_LIMITS.monthly_cost_cap;
  return { dailyCalls, dailyCost, monthlyCost };
}

// ═══ Проверить лимиты перед вызовом ═══
export async function checkLimits() {
  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);

  const daily = (await getSetting(`ai_daily_${today}`)) || { calls: 0, cost: 0 };
  const monthly = (await getSetting(`ai_monthly_${month}`)) || { calls: 0, cost: 0 };
  const limits = await getUserLimits();

  if (daily.calls >= limits.dailyCalls) return { blocked: true, reason: 'daily_calls' };
  if (daily.cost >= limits.dailyCost) return { blocked: true, reason: 'daily_cost' };
  if (monthly.cost >= limits.monthlyCost) return { blocked: true, reason: 'monthly_cost' };

  return { blocked: false };
}

// ═══ Статус для UI (Settings → AI) ═══
export async function getLimitsStatus() {
  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);

  const daily = (await getSetting(`ai_daily_${today}`)) || { calls: 0, cost: 0 };
  const monthly = (await getSetting(`ai_monthly_${month}`)) || { calls: 0, cost: 0 };
  const limits = await getUserLimits();

  return {
    today_calls: daily.calls,
    today_cost: +daily.cost.toFixed(4),
    month_calls: monthly.calls,
    month_cost: +monthly.cost.toFixed(4),
    daily_call_limit: limits.dailyCalls,
    daily_cost_limit: limits.dailyCost,
    monthly_cost_limit: limits.monthlyCost,
  };
}

// ═══ Полная статистика для AISettings ═══
export async function getStats() {
  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);

  const daily = (await getSetting(`ai_daily_${today}`)) || { calls: 0, cost: 0 };
  const monthly = (await getSetting(`ai_monthly_${month}`)) || { calls: 0, cost: 0 };
  const total = (await getSetting('ai_total_usage')) || { calls: 0, cost: 0 };
  const limits = await getUserLimits();

  return {
    calls_today: daily.calls,
    cost_today: +daily.cost.toFixed(4),
    calls_month: monthly.calls,
    cost_month: +monthly.cost.toFixed(4),
    calls_total: total.calls,
    cost_total: +total.cost.toFixed(4),
    daily_call_limit: limits.dailyCalls,
    daily_cost_limit: limits.dailyCost,
    monthly_cost_limit: limits.monthlyCost,
  };
}
