/**
 * frankfurter.js — Курсы валют.
 * Frankfurter API (ECB) не поддерживает KZT напрямую.
 * Стратегия: запрашиваем EUR-based курсы, пересчитываем кросс-курсы.
 * Офлайн: используем последний кэш или fallback.
 */
import { fetchWithRetry, requireOnline, emitNetworkError } from './_shared';

const BASE_URL = 'https://api.frankfurter.app';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24ч

// Примерный курс KZT/EUR для fallback (обновлять вручную раз в квартал)
const FALLBACK_RATES = {
  KZT: { USD: 0.00197, EUR: 0.00181, RUB: 0.176 },
  USD: { KZT: 507, EUR: 0.92, RUB: 89.5 },
  EUR: { KZT: 553, USD: 1.09, RUB: 97.5 },
  RUB: { KZT: 5.68, USD: 0.0112, EUR: 0.0103 },
};

/* ─── Cache ─── */

async function getCachedRates(base) {
  try {
    const { default: db } = await import('../db/index');
    const cached = await db.currencies.get(base);
    if (cached && Date.now() - new Date(cached.updated_at).getTime() < CACHE_TTL) {
      return cached;
    }
  } catch {}
  return null;
}

async function setCachedRates(base, rates, date) {
  try {
    const { default: db } = await import('../db/index');
    await db.currencies.put({
      code: base,
      rates,
      date,
      updated_at: new Date().toISOString(),
    });
  } catch {}
}

/* ─── Get Exchange Rates ─── */

export async function getExchangeRates(base = 'KZT', currencies = ['RUB', 'USD', 'EUR']) {
  // Попробовать кэш
  const cached = await getCachedRates(base);
  if (cached?.rates) {
    const hasCurrencies = currencies.every(c => c in cached.rates);
    if (hasCurrencies) {
      // Фоновое обновление если онлайн
      if (navigator.onLine) {
        fetchAndCalcRates(base, currencies).catch(() => {});
      }
      return { base, date: cached.date, rates: cached.rates };
    }
  }

  if (!navigator.onLine) {
    if (cached?.rates) return { base, date: cached.date, rates: cached.rates };
    // Fallback офлайн
    return { base, date: new Date().toISOString().split('T')[0], rates: FALLBACK_RATES[base] || {} };
  }

  try {
    return await fetchAndCalcRates(base, currencies);
  } catch {
    emitNetworkError('currency', 'Курсы валют недоступны, используем кэш');
    return { base, date: new Date().toISOString().split('T')[0], rates: FALLBACK_RATES[base] || {} };
  }
}

/**
 * Запрос через EUR (поддерживается ECB) + пересчёт кросс-курсов.
 * EUR → USD, RUB, KZT (если доступны), потом вычисляем base→target.
 */
async function fetchAndCalcRates(base, currencies) {
  // Все нужные валюты включая base
  const allCurrencies = [...new Set([base, ...currencies])].filter(c => c !== 'EUR');
  const to = allCurrencies.join(',');

  let data;
  try {
    data = await fetchWithRetry(`${BASE_URL}/latest?from=EUR&to=${to}`, {}, { retries: 1 });
  } catch {
    return { base, date: new Date().toISOString().split('T')[0], rates: FALLBACK_RATES[base] || {} };
  }

  const eurRates = data.rates || {};
  // eurRates теперь содержит EUR→X для каждой валюты

  // Пересчитываем base→target
  const baseToEur = eurRates[base]; // сколько base за 1 EUR
  if (!baseToEur && base !== 'EUR') {
    // ECB не знает эту валюту — fallback
    return { base, date: data.date, rates: FALLBACK_RATES[base] || {} };
  }

  const rates = {};
  for (const target of currencies) {
    if (target === base) continue;
    if (base === 'EUR') {
      rates[target] = eurRates[target] || FALLBACK_RATES.EUR?.[target];
    } else if (target === 'EUR') {
      rates[target] = baseToEur ? 1 / baseToEur : FALLBACK_RATES[base]?.EUR;
    } else {
      const targetToEur = eurRates[target];
      if (baseToEur && targetToEur) {
        rates[target] = +(targetToEur / baseToEur).toFixed(6);
      } else {
        rates[target] = FALLBACK_RATES[base]?.[target];
      }
    }
  }

  const result = {
    base,
    date: data.date || new Date().toISOString().split('T')[0],
    rates,
  };

  await setCachedRates(base, result.rates, result.date);
  return result;
}

/* ─── Convert ─── */

export async function convert(amount, from, to) {
  if (from === to) return amount;
  const { rates } = await getExchangeRates(from, [to]);
  const rate = rates[to];
  if (!rate) throw new Error(`Курс ${from}→${to} не найден`);
  return +(amount * rate).toFixed(2);
}

/* ─── Historical ─── */

export async function getHistoricalRate(date, base = 'KZT', currencies = ['RUB', 'USD', 'EUR']) {
  if (!navigator.onLine) {
    return { base, date, rates: FALLBACK_RATES[base] || {} };
  }
  try {
    const allCurrencies = [...new Set([base, ...currencies])].filter(c => c !== 'EUR');
    const to = allCurrencies.join(',');
    const data = await fetchWithRetry(`${BASE_URL}/${date}?from=EUR&to=${to}`, {}, { retries: 1 });
    const eurRates = data.rates || {};
    const baseToEur = eurRates[base];
    const rates = {};
    for (const target of currencies) {
      if (target === base) continue;
      if (base === 'EUR') { rates[target] = eurRates[target]; }
      else if (target === 'EUR') { rates[target] = baseToEur ? 1 / baseToEur : null; }
      else {
        const t = eurRates[target];
        rates[target] = (baseToEur && t) ? +(t / baseToEur).toFixed(6) : null;
      }
    }
    return { base, date: data.date, rates };
  } catch {
    return { base, date, rates: FALLBACK_RATES[base] || {} };
  }
}
