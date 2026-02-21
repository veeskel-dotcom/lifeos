/**
 * services/categories.js — CRUD для категорий расходов, доходов, подписок.
 *
 * Категории создаются при первом запуске (db/seed.js).
 * Этот сервис — для runtime-операций из экранов.
 */
import db from '../db/index';

/**
 * Получить категории по модулю.
 * @param {'expense'|'income'|'subscriptions'} module
 * @returns {Promise<Array>}
 */
export async function getCategories(module) {
  try {
    return await db.categories.where('module').equals(module).toArray();
  } catch (e) {
    console.error('[categories.getCategories]', e);
    return [];
  }
}

/**
 * Получить одну категорию по ID.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getCategory(id) {
  try {
    return (await db.categories.get(id)) || null;
  } catch (e) {
    console.error('[categories.getCategory]', e);
    return null;
  }
}

/**
 * Все категории (все модули).
 * @returns {Promise<Array>}
 */
export async function getAllCategories() {
  try {
    return await db.categories.toArray();
  } catch (e) {
    console.error('[categories.getAllCategories]', e);
    return [];
  }
}

/**
 * Добавить пользовательскую категорию.
 * @param {Object} data — { module, name, icon, color, parent_id? }
 * @returns {Promise<number|null>} ID новой категории
 */
export async function addCategory(data) {
  try {
    const maxSort = await db.categories
      .where('module').equals(data.module)
      .toArray()
      .then(arr => Math.max(0, ...arr.map(c => c.sort_order || 0)));
    return await db.categories.add({
      ...data,
      sort_order: maxSort + 1,
      is_system: false,
    });
  } catch (e) {
    console.error('[categories.addCategory]', e);
    throw e;
  }
}

/**
 * Обновить категорию.
 * @param {number} id
 * @param {Object} data
 */
export async function updateCategory(id, data) {
  try {
    await db.categories.update(id, data);
  } catch (e) {
    console.error('[categories.updateCategory]', e);
    throw e;
  }
}

/**
 * Удалить категорию (только пользовательские).
 * @param {number} id
 */
export async function deleteCategory(id) {
  try {
    const cat = await db.categories.get(id);
    if (cat?.is_system) {
      throw new Error('Нельзя удалить системную категорию');
    }

    // Каскад: перенести записи на "Прочее"
    const fallback = await db.categories
      .where('module').equals(cat.module)
      .filter(c => c.is_system && c.name === 'Прочее')
      .first();
    const fallbackId = fallback?.id || null;

    const table = cat.module === 'expense' ? db.expenses
      : cat.module === 'income' ? db.incomes
      : cat.module === 'subscriptions' ? db.subscriptions
      : null;

    if (table) {
      await table.where('category_id').equals(id).modify({ category_id: fallbackId });
    }

    await db.categories.delete(id);
  } catch (e) {
    console.error('[categories.deleteCategory]', e);
    throw e;
  }
}
