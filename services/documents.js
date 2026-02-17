import db from '../db/index';

export async function addDocument(data) {
  try {
    return db.documents.add(data);

  } catch (e) {
    console.error('[documents.addDocument]', e);
    throw e;
  }
}

export async function getDocument(id) {
  try {
    return db.documents.get(id);

  } catch (e) {
    console.error('[documents.getDocument]', e);
    return null;
  }
}

export async function updateDocument(id, data) {
  try {
    return db.documents.update(id, data);

  } catch (e) {
    console.error('[documents.updateDocument]', e);
    throw e;
  }
}

export async function deleteDocument(id) {
  try {
    return db.documents.delete(id);

  } catch (e) {
    console.error('[documents.deleteDocument]', e);
    throw e;
  }
}

export async function getDocuments() {
  try {
    return db.documents.toArray();

  } catch (e) {
    console.error('[documents.getDocuments]', e);
    return [];
  }
}

export async function getExpiringSoon(days = 60) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const docs = await db.documents.toArray();
    return docs.filter(d => {
      if (!d.expires_at) return false;
      const remindDays = d.remind_before_days || days;
      const warnDate = new Date();
      warnDate.setDate(warnDate.getDate() + remindDays);
      return d.expires_at <= warnDate.toISOString().slice(0, 10) && d.expires_at >= today;
    }).sort((a, b) => a.expires_at.localeCompare(b.expires_at));

  } catch (e) {
    console.error('[documents.getExpiringSoon]', e);
    return [];
  }
}

export async function getByCategory() {
  try {
    const docs = await getDocuments();
    const TYPE_GROUPS = {
      passport: 'Личные', passport_intl: 'Личные', driver: 'Личные',
      insurance: 'Страхование', car_insurance: 'Машина',
      medical: 'Медицина', visa: 'Личные',
      contract: 'Контракты', other: 'Прочее',
    };
    const groups = {};
    docs.forEach(d => {
      const cat = TYPE_GROUPS[d.type] || 'Прочее';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(d);
    });
    return groups;

  } catch (e) {
    console.error('[documents.getByCategory]', e);
    return null;
  }
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
  return Math.ceil(diff);
}
