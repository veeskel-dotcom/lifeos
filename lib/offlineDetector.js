/**
 * offlineDetector.js — Детекция онлайн/офлайн статуса.
 * Слушает window online/offline events, уведомляет подписчиков.
 */

let listeners = [];

export function onOnlineStatusChange(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

function notify() {
  listeners.forEach((cb) => cb(navigator.onLine));
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
}

export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
