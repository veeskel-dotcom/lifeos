import db from '../db/index';

const CATEGORIES = ['front', 'side', 'back'];

export { CATEGORIES as PHOTO_CATEGORIES };

export async function addPhoto(date, category, dataUrl) {
  try {
    return db.progress_photos.add({
      date: date || new Date().toISOString().slice(0, 10),
      category,
      data: dataUrl,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[progressPhotos.addPhoto]', e);
    throw e;
  }
}

export async function getPhotos({ limit = 50, category } = {}) {
  try {
    let query = db.progress_photos.orderBy('date').reverse();
    const all = await query.toArray();
    const filtered = category ? all.filter(p => p.category === category) : all;
    return filtered.slice(0, limit);
  } catch (e) {
    console.error('[progressPhotos.getPhotos]', e);
    return [];
  }
}

export async function getPhotosByDate(date) {
  try {
    return db.progress_photos.where('date').equals(date).toArray();
  } catch (e) {
    console.error('[progressPhotos.getPhotosByDate]', e);
    return [];
  }
}

export async function deletePhoto(id) {
  try {
    return db.progress_photos.delete(id);
  } catch (e) {
    console.error('[progressPhotos.deletePhoto]', e);
    throw e;
  }
}

export async function getTimelinePhotos(category = 'front') {
  try {
    const all = await db.progress_photos
      .where('category').equals(category)
      .toArray();
    all.sort((a, b) => a.date.localeCompare(b.date));
    return all;
  } catch (e) {
    console.error('[progressPhotos.getTimelinePhotos]', e);
    return [];
  }
}
