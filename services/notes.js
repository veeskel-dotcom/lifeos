import db from '../db/index';

export async function addNote(data) {
  try {
    const now = new Date().toISOString();
    return db.notes.add({ ...data, created_at: now, updated_at: now });

  } catch (e) {
    console.error('[notes.addNote]', e);
    throw e;
  }
}

export async function getNote(id) {
  try {
    return db.notes.get(id);

  } catch (e) {
    console.error('[notes.getNote]', e);
    return null;
  }
}

export async function updateNote(id, data) {
  try {
    return db.notes.update(id, { ...data, updated_at: new Date().toISOString() });

  } catch (e) {
    console.error('[notes.updateNote]', e);
    throw e;
  }
}

export async function deleteNote(id) {
  try {
    return db.notes.delete(id);

  } catch (e) {
    console.error('[notes.deleteNote]', e);
    throw e;
  }
}

export async function getNotes({ type, tag, search, limit = 50, offset = 0 } = {}) {
  try {
    let collection = db.notes.orderBy('created_at').reverse();
    let results = await collection.toArray();

    if (type) results = results.filter(n => n.type === type);
    if (tag) results = results.filter(n => n.tags?.includes(tag));
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q)
      );
    }

    return results.slice(offset, offset + limit);

  } catch (e) {
    console.error('[notes.getNotes]', e);
    return [];
  }
}

export async function getAllTags() {
  try {
    const notes = await db.notes.toArray();
    const tagSet = new Set();
    notes.forEach(n => n.tags?.forEach(t => tagSet.add(t)));
    return [...tagSet].sort();

  } catch (e) {
    console.error('[notes.getAllTags]', e);
    return [];
  }
}

export async function getDiaryEntries(month) {
  try {
    let results = await db.notes.where('type').equals('diary')
      .toArray()
      .catch(() => db.notes.toArray().then(n => n.filter(x => x.type === 'diary')));
    if (month) results = results.filter(n => n.created_at?.startsWith(month));
    return results.sort((a, b) => b.created_at.localeCompare(a.created_at));

  } catch (e) {
    console.error('[notes.getDiaryEntries]', e);
    return [];
  }
}

export async function getNotesCount() {
  try {
    return db.notes.count();

  } catch (e) {
    console.error('[notes.getNotesCount]', e);
    return null;
  }
}

export async function togglePin(id) {
  try {
    const note = await db.notes.get(id);
    if (!note) return;
    await db.notes.update(id, { is_pinned: !note.is_pinned });
  } catch (e) {
    console.error('[notes.togglePin]', e);
  }
}

export async function toggleHidden(id) {
  try {
    const note = await db.notes.get(id);
    if (!note) return;
    await db.notes.update(id, { is_hidden: !note.is_hidden });
  } catch (e) {
    console.error('[notes.toggleHidden]', e);
  }
}
