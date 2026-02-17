import { getSetting, setSetting } from '../db/helpers';
import { AI_LIMITS } from '../utils/constants';

const DAILY_CALL_LIMIT = AI_LIMITS.daily_calls;
const DAILY_COST_LIMIT = AI_LIMITS.daily_cost_cap;
const MONTHLY_COST_LIMIT = AI_LIMITS.monthly_cost_cap;

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

  // Timestamp последнего вызова
  await setSetting('ai_last_call_ts', Date.now());

  return { daily, monthly };
}

// ═══ Проверить лимиты перед вызовом ═══
export async function checkLimits() {
  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);

  const daily = (await getSetting(`ai_daily_${today}`)) || { calls: 0, cost: 0 };
  const monthly = (await getSetting(`ai_monthly_${month}`)) || { calls: 0, cost: 0 };
  const userLimit = (await getSetting('ai_monthly_limit')) || MONTHLY_COST_LIMIT;

  if (daily.calls >= DAILY_CALL_LIMIT) return { blocked: true, reason: 'daily_calls' };
  if (daily.cost >= DAILY_COST_LIMIT) return { blocked: true, reason: 'daily_cost' };
  if (monthly.cost >= userLimit) return { blocked: true, reason: 'monthly_cost' };

  return { blocked: false };
}

// ═══ Статус для UI (Settings → AI) ═══
export async function getLimitsStatus() {
  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);

  const daily = (await getSetting(`ai_daily_${today}`)) || { calls: 0, cost: 0 };
  const monthly = (await getSetting(`ai_monthly_${month}`)) || { calls: 0, cost: 0 };
  const userLimit = (await getSetting('ai_monthly_limit')) || MONTHLY_COST_LIMIT;

  return {
    today_calls: daily.calls,
    today_cost: +daily.cost.toFixed(4),
    month_calls: monthly.calls,
    month_cost: +monthly.cost.toFixed(4),
    daily_call_limit: DAILY_CALL_LIMIT,
    daily_cost_limit: DAILY_COST_LIMIT,
    monthly_cost_limit: userLimit,
  };
}
