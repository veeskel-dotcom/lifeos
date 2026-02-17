import { logSecurityEvent } from '../db/helpers';

// Запросить persistent storage
export async function requestPersistence() {
  if (!navigator.storage?.persist) return { supported: false };
  
  const granted = await navigator.storage.persist();
  await logSecurityEvent(granted ? 'persist_granted' : 'persist_denied');
  return { supported: true, granted };
}

// Проверить текущий статус
export async function checkPersistence() {
  if (!navigator.storage?.persisted) return { supported: false, persisted: false };
  const persisted = await navigator.storage.persisted();
  return { supported: true, persisted };
}

// Оценка использования хранилища
export async function getStorageEstimate() {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  return {
    usageMB: Math.round(usage / 1024 / 1024 * 10) / 10,
    quotaMB: Math.round(quota / 1024 / 1024),
    percent: Math.round(usage / quota * 100),
  };
}

// Проверка standalone режима
export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

// Eviction risk assessment
export function getEvictionRisk() {
  const standalone = isStandalone();
  // Если не на Home Screen — высокий риск (7-day eviction)
  if (!standalone) return 'high';
  return 'low';
}
