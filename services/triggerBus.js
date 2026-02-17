/**
 * Trigger bus — простой pub/sub для smart triggers.
 * Сервисы вызывают emit(), App подписывается через subscribe().
 */
import { checkTriggers } from './smartTriggers';

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function emit(event, data = {}) {
  try {
    const notifications = await checkTriggers(event, data);
    if (notifications.length > 0) {
      for (const fn of listeners) {
        fn(notifications);
      }
    }
    return notifications;
  } catch (e) {
    console.error('[triggerBus]', e);
    return [];
  }
}
