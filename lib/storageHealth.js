/**
 * lib/storageHealth.js — Мониторинг хранилища + QuotaExceeded handler.
 * Лёгкий модуль без зависимости от db/index (чтобы main.jsx мог импортировать до инициализации БД).
 */

// ═══ Базовая проверка ═══

export async function checkStorageHealth() {
  const health = {
    persistent: false,
    usage_mb: 0,
    quota_mb: 0,
    percent: 0,
    indexeddb_ok: false,
    storage_available: false,
  };

  // Storage API
  try {
    if (navigator.storage) {
      health.storage_available = true;
      health.persistent = await navigator.storage.persisted();
      const { usage, quota } = await navigator.storage.estimate();
      health.usage_mb = +(usage / 1024 / 1024).toFixed(1);
      health.quota_mb = +(quota / 1024 / 1024).toFixed(0);
      health.percent = quota > 0 ? +((usage / quota) * 100).toFixed(1) : 0;
      health.usage_bytes = usage;
      health.quota_bytes = quota;
    }
  } catch {}

  // IndexedDB доступность
  try {
    const { default: db } = await import('../db/index');
    await db.settings.count();
    health.indexeddb_ok = true;
  } catch {
    health.indexeddb_ok = false;
  }

  return health;
}

// ═══ QuotaExceeded глобальный обработчик ═══

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.name === 'QuotaExceededError') {
      event.preventDefault();
      console.error('[storageHealth] QuotaExceeded detected');
      document.dispatchEvent(new CustomEvent('lifeos:quota-exceeded', {
        detail: { timestamp: Date.now() },
      }));
    }
  });

  // Слушатель для UI
  document.addEventListener('lifeos:quota-exceeded', () => {
    // App.jsx подпишется и покажет toast
    console.warn('[storageHealth] Storage quota exceeded — backup recommended');
  });
}
