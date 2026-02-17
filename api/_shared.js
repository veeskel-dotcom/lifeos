/**
 * _shared.js — Общие утилиты для API-клиентов.
 * fetchWithTimeout, fetchWithRetry, requireOnline, emitNetworkError.
 */

/** Дедупликация тостов: не показывать одну и ту же ошибку чаще раза в 30с */
const _lastErrors = new Map();

export function emitNetworkError(source, message) {
  const key = `${source}:${message}`;
  const now = Date.now();
  if (_lastErrors.get(key) > now - 30000) return;
  _lastErrors.set(key, now);
  document.dispatchEvent(new CustomEvent('lifeos:network-error', {
    detail: { source, message },
  }));
}

export function requireOnline() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Нет подключения к интернету');
  }
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchWithRetry(url, options = {}, { retries = 2, delay = 1000, timeoutMs = 10000 } = {}) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetchWithTimeout(url, options, timeoutMs);
    } catch (e) {
      if (i === retries) {
        emitNetworkError('network', e.message);
        throw e;
      }
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
}
