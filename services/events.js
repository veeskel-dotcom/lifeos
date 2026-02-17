import db from '../db/index';

export async function addEvent(data) {
  try {
    const event = {
      title: data.title,
      start: data.start,
      end: data.end || null,
      type: data.type || 'personal',
      location: data.location || '',
      description: data.description || '',
      reminder_min: data.reminder_min ?? 30,
      color: data.color || '#007AFF',
      created_at: new Date().toISOString(),
    };
    const id = await db.events.add(event);
    return { ...event, id };

  } catch (e) {
    console.error('[events.addEvent]', e);
    throw e;
  }
}

export async function getEvent(id) {
  try {
    return db.events.get(id);

  } catch (e) {
    console.error('[events.getEvent]', e);
    return null;
  }
}

export async function updateEvent(id, data) {
  try {
    await db.events.update(id, data);
    return db.events.get(id);

  } catch (e) {
    console.error('[events.updateEvent]', e);
    throw e;
  }
}

export async function deleteEvent(id) {
  try {
    await db.events.delete(id);
    // Удаляем связанные напоминания
    const reminders = await db.reminders
      .where('entity_type').equals('event')
      .filter(r => r.entity_id === id)
      .toArray();
    await db.reminders.bulkDelete(reminders.map(r => r.id));

  } catch (e) {
    console.error('[events.deleteEvent]', e);
    throw e;
  }
}

export async function getEventsForDay(date) {
  try {
    // date = 'YYYY-MM-DD'
    const dayStart = date + 'T00:00:00';
    const dayEnd = date + 'T23:59:59';
    return db.events
      .where('start')
      .between(dayStart, dayEnd, true, true)
      .toArray();

  } catch (e) {
    console.error('[events.getEventsForDay]', e);
    return [];
  }
}

export async function getEventsForMonth(month) {
  try {
    // month = 'YYYY-MM'
    const start = month + '-01T00:00:00';
    const end = month + '-31T23:59:59';
    return db.events
      .where('start')
      .between(start, end, true, true)
      .toArray();

  } catch (e) {
    console.error('[events.getEventsForMonth]', e);
    return [];
  }
}

export async function getUpcomingEvents(days = 7) {
  try {
    const now = new Date().toISOString();
    const future = new Date();
    future.setDate(future.getDate() + days);
    const futureStr = future.toISOString();
    return db.events
      .where('start')
      .between(now, futureStr, true, true)
      .sortBy('start');

  } catch (e) {
    console.error('[events.getUpcomingEvents]', e);
    return [];
  }
}
