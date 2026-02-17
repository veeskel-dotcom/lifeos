import db from '../db/index';

export async function createReminder(entityType, entityId, triggerAt, title) {
  try {
    const reminder = {
      trigger_at: triggerAt,
      entity_type: entityType,
      entity_id: entityId,
      title,
      is_fired: false,
    };
    const id = await db.reminders.add(reminder);
    return { ...reminder, id };

  } catch (e) {
    console.error('[reminders.createReminder]', e);
    throw e;
  }
}

export async function checkReminders() {
  try {
    const now = new Date().toISOString();
    const unfired = await db.reminders
      .where('trigger_at')
      .belowOrEqual(now)
      .toArray();
    return unfired.filter(r => !r.is_fired);

  } catch (e) {
    console.error('[reminders.checkReminders]', e);
    return [];
  }
}

export async function markFired(id) {
  try {
    await db.reminders.update(id, { is_fired: true });

  } catch (e) {
    console.error('[reminders.markFired]', e);
    throw e;
  }
}

export async function deleteReminder(id) {
  try {
    await db.reminders.delete(id);

  } catch (e) {
    console.error('[reminders.deleteReminder]', e);
    throw e;
  }
}

export async function getRemindersForEntity(entityType, entityId) {
  try {
    return db.reminders
      .where('entity_type').equals(entityType)
      .filter(r => r.entity_id === entityId)
      .toArray();

  } catch (e) {
    console.error('[reminders.getRemindersForEntity]', e);
    return [];
  }
}
