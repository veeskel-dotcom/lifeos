/**
 * B1.3: Areas — группировка задач и проектов по жизненным сферам.
 * Примеры: Работа, Дом, Здоровье, Финансы, Образование.
 */
import db from '../db/index';

const DEFAULT_AREAS = [
  { name: 'Работа', emoji: '💼', color: '#007AFF' },
  { name: 'Дом', emoji: '🏠', color: '#34C759' },
  { name: 'Здоровье', emoji: '❤️', color: '#FF2D55' },
  { name: 'Финансы', emoji: '💰', color: '#FF9500' },
  { name: 'Образование', emoji: '📚', color: '#5856D6' },
  { name: 'Личное', emoji: '🌟', color: '#AF52DE' },
];

export async function getAreas() {
  try {
    const all = await db.settings.get('areas');
    return all?.value || DEFAULT_AREAS;

  } catch (e) {
    console.error('[areas.getAreas]', e);
    return [];
  }
}

export async function setAreas(areas) {
  try {
    await db.settings.put({ key: 'areas', value: areas });

  } catch (e) {
    console.error('[areas.setAreas]', e);
    throw e;
  }
}

export async function addArea(area) {
  try {
    const areas = await getAreas();
    areas.push(area);
    await setAreas(areas);
    return areas;

  } catch (e) {
    console.error('[areas.addArea]', e);
    throw e;
  }
}

export async function removeArea(index) {
  try {
    const areas = await getAreas();
    areas.splice(index, 1);
    await setAreas(areas);
    return areas;

  } catch (e) {
    console.error('[areas.removeArea]', e);
    throw e;
  }
}

export async function getTasksByArea(areaName) {
  try {
    const tasks = await db.tasks.toArray();
    return tasks.filter(t => t.area === areaName);

  } catch (e) {
    console.error('[areas.getTasksByArea]', e);
    return [];
  }
}

export async function getAreaStats() {
  try {
    const areas = await getAreas();
    const tasks = await db.tasks.toArray();
  
    return areas.map(area => {
      const areaTasks = tasks.filter(t => t.area === area.name);
      const done = areaTasks.filter(t => t.status === 'done').length;
      return {
        ...area,
        total: areaTasks.length,
        done,
        active: areaTasks.length - done,
      };
    });

  } catch (e) {
    console.error('[areas.getAreaStats]', e);
    return [];
  }
}
