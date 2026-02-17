/**
 * dishes.js — CRUD food_dishes (мои блюда)
 * Таблица: food_dishes '++id, name'
 */
import db from '../db/index';

export async function createDish(name, items) {
  try {
    const totals = items.reduce(
      (acc, i) => ({
        calories: acc.calories + (i.calories || 0),
        protein: acc.protein + (i.protein || 0),
        fat: acc.fat + (i.fat || 0),
        carbs: acc.carbs + (i.carbs || 0),
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );

    const record = {
      name,
      items,
      total_calories: Math.round(totals.calories),
      total_protein: Math.round(totals.protein * 10) / 10,
      total_fat: Math.round(totals.fat * 10) / 10,
      total_carbs: Math.round(totals.carbs * 10) / 10,
      usage_count: 0,
      is_favorite: false,
      created_at: new Date().toISOString(),
    };

    const id = await db.food_dishes.add(record);
    return { ...record, id };

  } catch (e) {
    console.error('[dishes.createDish]', e);
    throw e;
  }
}

export async function getDishes() {
  try {
    const all = await db.food_dishes.toArray();
    all.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));
    return all;

  } catch (e) {
    console.error('[dishes.getDishes]', e);
    return [];
  }
}

export async function getDish(id) {
  try {
    return db.food_dishes.get(id);

  } catch (e) {
    console.error('[dishes.getDish]', e);
    return null;
  }
}

export async function updateDish(id, data) {
  try {
    if (data.items) {
      const totals = data.items.reduce(
        (acc, i) => ({
          calories: acc.calories + (i.calories || 0),
          protein: acc.protein + (i.protein || 0),
          fat: acc.fat + (i.fat || 0),
          carbs: acc.carbs + (i.carbs || 0),
        }),
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
      );
      data.total_calories = Math.round(totals.calories);
      data.total_protein = Math.round(totals.protein * 10) / 10;
      data.total_fat = Math.round(totals.fat * 10) / 10;
      data.total_carbs = Math.round(totals.carbs * 10) / 10;
    }
    await db.food_dishes.update(id, data);
    return db.food_dishes.get(id);

  } catch (e) {
    console.error('[dishes.updateDish]', e);
    throw e;
  }
}

export async function deleteDish(id) {
  try {
    await db.food_dishes.delete(id);

  } catch (e) {
    console.error('[dishes.deleteDish]', e);
    throw e;
  }
}

export async function toggleDishFavorite(id) {
  try {
    const d = await db.food_dishes.get(id);
    if (!d) return;
    await db.food_dishes.update(id, { is_favorite: !d.is_favorite });
    return db.food_dishes.get(id);

  } catch (e) {
    console.error('[dishes.toggleDishFavorite]', e);
    throw e;
  }
}

export async function incrementDishUsage(id) {
  try {
    const d = await db.food_dishes.get(id);
    if (!d) return;
    await db.food_dishes.update(id, { usage_count: (d.usage_count || 0) + 1 });

  } catch (e) {
    console.error('[dishes.incrementDishUsage]', e);
    throw e;
  }
}
