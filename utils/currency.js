/**
 * currency.js — единый формат валюты из настроек пользователя.
 * Убирает хардкод ₽/₸, берёт из settings.currency.
 */
import { getSetting } from '../db/helpers';

const SYMBOLS = { KZT: '₸', RUB: '₽', USD: '$', EUR: '€', GBP: '£', CNY: '¥', TRY: '₺' };

let _cachedSymbol = null;
let _cachedCode = null;

export async function loadCurrency() {
  _cachedCode = (await getSetting('currency')) || 'RUB';
  _cachedSymbol = SYMBOLS[_cachedCode] || _cachedCode;
  return { code: _cachedCode, symbol: _cachedSymbol };
}

/** Синхронный доступ (после первого loadCurrency) */
export function getCurrencySymbol() {
  return _cachedSymbol || '₽';
}

export function getCurrencyCode() {
  return _cachedCode || 'RUB';
}

/** Форматированная сумма: 15 000₽ */
export function fmtMoney(n, symbol) {
  if (n == null) return `0${symbol || getCurrencySymbol()}`;
  return Math.round(n).toLocaleString('ru-RU') + (symbol || getCurrencySymbol());
}

/** Форматированная сумма с дробными: 15 000.50₽ */
export function fmtMoneyFrac(n, decimals = 2, symbol) {
  if (n == null) return `0${symbol || getCurrencySymbol()}`;
  return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: decimals }) + (symbol || getCurrencySymbol());
}

export function getSymbolForCode(code) {
  return SYMBOLS[code] || code || getCurrencySymbol();
}
