/**
 * registerSW.js — Регистрация Service Worker + update prompt.
 * Использует virtual:pwa-register от vite-plugin-pwa.
 * Автопроверка обновлений каждые 60 минут.
 */
import { registerSW } from 'virtual:pwa-register';

let updateSW;

/**
 * Инициализация Service Worker.
 * @param {Function} onNeedRefresh — вызывается когда доступно обновление
 */
export function initServiceWorker(onNeedRefresh) {
  updateSW = registerSW({
    onNeedRefresh() {
      if (onNeedRefresh) onNeedRefresh();
    },
    onOfflineReady() {
      console.log('[LifeOS] Готов к офлайн-работе');
    },
    onRegisteredSW(swUrl, registration) {
      // Проверять обновления каждые 60 минут
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      }
    },
  });
}

/**
 * Применить обновление: skipWaiting + reload.
 */
export function applyUpdate() {
  if (updateSW) updateSW(true);
}
