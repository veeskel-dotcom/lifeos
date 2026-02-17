import { getSetting, logSecurityEvent } from '../db/helpers';

// Анти-брутфорс задержки
const DELAY_MAP = [
  { from: 1, to: 3, delay: 0 },
  { from: 4, to: 5, delay: 5000 },
  { from: 6, to: 8, delay: 30000 },
  { from: 9, to: 9, delay: 60000 },
  { from: 10, to: 14, delay: 300000 },    // 5 мин
  { from: 15, to: Infinity, delay: 1800000 }, // 30 мин
];

export function getLockDelay(attempts) {
  const rule = DELAY_MAP.find(r => attempts >= r.from && attempts <= r.to);
  return rule ? rule.delay : 1800000;
}

// Формат задержки для UI
export function formatDelay(ms) {
  if (ms >= 60000) return `${Math.floor(ms / 60000)} мин`;
  return `${Math.floor(ms / 1000)} сек`;
}

// Lock timeout: запираем при возврате из фона
export function setupLockTimeout(onLock) {
  sessionStorage.setItem('lifeos_last_active', Date.now().toString());

  const handler = async () => {
    if (document.visibilityState === 'visible') {
      const lastActive = parseInt(sessionStorage.getItem('lifeos_last_active') || '0');
      const timeout = (await getSetting('lock_timeout_ms')) || 300000;
      if (Date.now() - lastActive > timeout) {
        await logSecurityEvent('lock_timeout');
        onLock();
      }
    } else {
      sessionStorage.setItem('lifeos_last_active', Date.now().toString());
    }
  };

  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
