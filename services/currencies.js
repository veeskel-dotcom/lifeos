/**
 * currencies.js — Курсы валют через Frankfurter API + кэш 24 часа
 * Таблица: currencies 'code, updated_at'
 *
 * API-клиент: ../api/frankfurter (создаёт B)
 */
import db from '../db/index';
import { getExchangeRates, convert as apiConvert } from '../api/frankfurter';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа

// ─── Получить курсы ─────────────────────────────────────

/**
 * Получить курсы валют.
 * @param {string} base — базовая валюта (default 'KZT')
 * @returns {Object<string, number>} rates relative to base
 */
export async function getRates(base = 'KZT') {
  // 1. Проверить IndexedDB cache
  try {
    const cached = await db.currencies.where('code').equals(`${base}_rates`).first();
    if (cached && Date.now() - new Date(cached.updated_at).getTime() < CACHE_TTL) {
      return cached.rates;
    }
  } catch {}

  // 2. Fetch
  if (!navigator.onLine) {
    // Fallback: захардкоженные приблизительные курсы
    return _fallbackRates(base);
  }

  try {
    const data = await getExchangeRates(base);

    // Сохранить
    await db.currencies.put({
      code: `${base}_rates`,
      rates: data.rates,
      updated_at: new Date().toISOString(),
    });

    return data.rates;
  } catch {
    return _fallbackRates(base);
  }
}

// ─── Конвертация ────────────────────────────────────────

/**
 * Конвертировать сумму.
 * @param {number} amount
 * @param {string} from — код валюты
 * @param {string} to — код валюты
 * @returns {number} конвертированная сумма
 */
export async function convert(amount, from, to) {
  if (from === to) return amount;

  try {
    if (navigator.onLine) {
      return await apiConvert(amount, from, to);
    }
  } catch {}

  // Offline fallback через кэшированные курсы
  const rates = await getRates(from);
  const rate = rates[to];
  if (!rate) return amount; // не знаем курс — вернуть как есть
  return Math.round(amount * rate * 100) / 100;
}

// ─── Форматирование ─────────────────────────────────────

/**
 * Форматировать сумму с символом валюты.
 * @param {number} amount
 * @param {string} currency — код валюты
 * @returns {string}
 */
export function formatMoney(amount, currency = 'KZT') {
  const symbols = { KZT: '₸', RUB: '₽', USD: '$', EUR: '€', GBP: '£' };
  const symbol = symbols[currency] || currency;
  const formatted = Math.round(amount).toLocaleString('ru-RU');

  if (currency === 'USD' || currency === 'EUR' || currency === 'GBP') {
    return `${symbol}${formatted}`;
  }
  return `${formatted}${symbol}`;
}

// ─── Private ────────────────────────────────────────────

function _fallbackRates(base) {
  const fallbacks = {
    KZT: { RUB: 0.19, USD: 0.0021, EUR: 0.0019, GBP: 0.0016 },
    USD: { KZT: 480, RUB: 92, EUR: 0.92, GBP: 0.79 },
    RUB: { KZT: 5.2, USD: 0.011, EUR: 0.010, GBP: 0.0086 },
  };
  return fallbacks[base] || fallbacks.KZT;
}
