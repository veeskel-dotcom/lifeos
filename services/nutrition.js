import db from '../db/index';
import { getSetting, setSetting } from '../db/helpers';
import { findByBarcode, scanBarcode as _scanBarcode } from './products';

export { _scanBarcode as scanBarcode };
export async function searchByBarcode(barcode) {
  return findByBarcode(barcode);
}

// ─── CRUD ───────────────────────────────────────────────

export async function addMeal(date, meal, items) {
  try {
    const totals = items.reduce(
      (acc, i) => ({
        calories: acc.calories + (i.calories || 0),
        protein: acc.protein + (i.protein || 0),
        fat: acc.fat + (i.fat || 0),
        carbs: acc.carbs + (i.carbs || 0),
        fiber: acc.fiber + (i.fiber || 0),
        sugar: acc.sugar + (i.sugar || 0),
        sodium: acc.sodium + (i.sodium || 0),
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0 }
    );

    const record = {
      date: date || new Date().toISOString().slice(0, 10),
      meal,
      items,
      total_calories: Math.round(totals.calories),
      total_protein: Math.round(totals.protein * 10) / 10,
      total_fat: Math.round(totals.fat * 10) / 10,
      total_carbs: Math.round(totals.carbs * 10) / 10,
      total_fiber: Math.round(totals.fiber * 10) / 10,
      total_sugar: Math.round(totals.sugar * 10) / 10,
      total_sodium: Math.round(totals.sodium),
      source: 'manual',
      created_at: new Date().toISOString(),
    };

    const id = await db.food_log.add(record);
    return { ...record, id };

  } catch (e) {
    console.error('[nutrition.addMeal]', e);
    throw e;
  }
}

export async function getMealsForDay(date) {
  try {
    const d = date || new Date().toISOString().slice(0, 10);
    return db.food_log.where('date').equals(d).toArray();

  } catch (e) {
    console.error('[nutrition.getMealsForDay]', e);
    return [];
  }
}

export async function getMealById(id) {
  try {
    return db.food_log.get(id);

  } catch (e) {
    console.error('[nutrition.getMealById]', e);
    return null;
  }
}

export async function updateMealItem(logId, itemIndex, updates) {
  try {
    const log = await db.food_log.get(logId);
    if (!log || !log.items[itemIndex]) return null;

    log.items[itemIndex] = { ...log.items[itemIndex], ...updates };

    const totals = log.items.reduce(
      (acc, i) => ({
        calories: acc.calories + (i.calories || 0),
        protein: acc.protein + (i.protein || 0),
        fat: acc.fat + (i.fat || 0),
        carbs: acc.carbs + (i.carbs || 0),
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );

    await db.food_log.update(logId, {
      items: log.items,
      total_calories: Math.round(totals.calories),
      total_protein: Math.round(totals.protein * 10) / 10,
      total_fat: Math.round(totals.fat * 10) / 10,
      total_carbs: Math.round(totals.carbs * 10) / 10,
    });

    return db.food_log.get(logId);

  } catch (e) {
    console.error('[nutrition.updateMealItem]', e);
    throw e;
  }
}

export async function removeMealItem(logId, itemIndex) {
  try {
    const log = await db.food_log.get(logId);
    if (!log) return null;

    log.items.splice(itemIndex, 1);

    if (log.items.length === 0) {
      await db.food_log.delete(logId);
      return null;
    }

    const totals = log.items.reduce(
      (acc, i) => ({
        calories: acc.calories + (i.calories || 0),
        protein: acc.protein + (i.protein || 0),
        fat: acc.fat + (i.fat || 0),
        carbs: acc.carbs + (i.carbs || 0),
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );

    await db.food_log.update(logId, {
      items: log.items,
      total_calories: Math.round(totals.calories),
      total_protein: Math.round(totals.protein * 10) / 10,
      total_fat: Math.round(totals.fat * 10) / 10,
      total_carbs: Math.round(totals.carbs * 10) / 10,
    });

    return db.food_log.get(logId);

  } catch (e) {
    console.error('[nutrition.removeMealItem]', e);
    throw e;
  }
}

export async function deleteMeal(logId) {
  try {
    await db.food_log.delete(logId);

  } catch (e) {
    console.error('[nutrition.deleteMeal]', e);
    throw e;
  }
}

// ─── Агрегаты ───────────────────────────────────────────

export async function getDailyTotals(date) {
  try {
    const d = date || new Date().toISOString().slice(0, 10);
    const meals = await getMealsForDay(d);
    const waterEntries = await db.water_log.where('date').equals(d).toArray();

    const totals = meals.reduce(
      (acc, m) => ({
        calories: acc.calories + (m.total_calories || 0),
        protein: acc.protein + (m.total_protein || 0),
        fat: acc.fat + (m.total_fat || 0),
        carbs: acc.carbs + (m.total_carbs || 0),
        fiber: acc.fiber + (m.total_fiber || 0),
        sugar: acc.sugar + (m.total_sugar || 0),
        sodium: acc.sodium + (m.total_sodium || 0),
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0 }
    );

    return {
      ...totals,
      water_ml: waterEntries.reduce((s, w) => s + (w.amount_ml || 0), 0),
    };

  } catch (e) {
    console.error('[nutrition.getDailyTotals]', e);
    return [];
  }
}

export async function getWeeklyAvg() {
  try {
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    let totalCal = 0, totalP = 0, totalF = 0, totalC = 0;
    let totalFiber = 0, totalSugar = 0, totalSodium = 0;
    let activeDays = 0;

    for (const date of days) {
      const t = await getDailyTotals(date);
      if (t.calories > 0) {
        totalCal += t.calories;
        totalP += t.protein;
        totalF += t.fat;
        totalC += t.carbs;
        totalFiber += t.fiber || 0;
        totalSugar += t.sugar || 0;
        totalSodium += t.sodium || 0;
        activeDays++;
      }
    }

    const div = activeDays || 1;
    return {
      calories: Math.round(totalCal / div),
      protein: Math.round(totalP / div * 10) / 10,
      fat: Math.round(totalF / div * 10) / 10,
      carbs: Math.round(totalC / div * 10) / 10,
      fiber: Math.round(totalFiber / div * 10) / 10,
      sugar: Math.round(totalSugar / div * 10) / 10,
      sodium: Math.round(totalSodium / div),
      activeDays,
    };

  } catch (e) {
    console.error('[nutrition.getWeeklyAvg]', e);
    return null;
  }
}

export async function getGoals() {
  try {
    const keys = ['daily_calorie_goal', 'daily_protein_goal', 'daily_fat_goal', 'daily_carbs_goal', 'daily_water_goal', 'daily_fiber_goal', 'daily_sugar_goal', 'daily_sodium_goal'];
    const rows = await db.settings.bulkGet(keys);
    const map = {};
    for (const r of rows) if (r) map[r.key] = r.value;

    return {
      calories: map.daily_calorie_goal || 2200,
      protein: map.daily_protein_goal || 120,
      fat: map.daily_fat_goal || 80,
      carbs: map.daily_carbs_goal || 250,
      water: map.daily_water_goal || 2000,
      fiber: map.daily_fiber_goal || 25,
      sugar: map.daily_sugar_goal || 50,
      sodium: map.daily_sodium_goal || 2300,
    };

  } catch (e) {
    console.error('[nutrition.getGoals]', e);
    return [];
  }
}

// ─── C1.2: Настраиваемые цели КБЖУ ─────────────────────

export async function setNutritionGoals({ calories, protein, fat, carbs }) {
  try {
    if (calories != null) await setSetting('daily_calorie_goal', calories);
    if (protein != null) await setSetting('daily_protein_goal', protein);
    if (fat != null) await setSetting('daily_fat_goal', fat);
    if (carbs != null) await setSetting('daily_carbs_goal', carbs);
  } catch { /* тихая ошибка */ }
}

// ─── C1.3: Копирование вчерашнего питания ───────────────

export async function copyMealsFromDay(fromDate, toDate) {
  try {
    const meals = await getMealsForDay(fromDate);
    if (!meals.length) return 0;

    let count = 0;
    for (const meal of meals) {
      await db.food_log.add({
        date: toDate,
        meal: meal.meal,
        items: meal.items,
        total_calories: meal.total_calories,
        total_protein: meal.total_protein,
        total_fat: meal.total_fat,
        total_carbs: meal.total_carbs,
        source: 'copy',
        created_at: new Date().toISOString(),
      });
      count++;
    }
    return count;

  } catch (e) {
    console.error('[nutrition.copyMealsFromDay]', e);
    throw e;
  }
}

// ─── C2.1: Недельный отчёт питания ──────────────────────

export async function getWeeklyNutritionReport() {
  try {
    const today = new Date();
    const result = { days: [], avgCalories: 0, avgProtein: 0, avgFat: 0, avgCarbs: 0, bestDay: null, worstDay: null };

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const entries = await db.food_log.where('date').equals(dateStr).toArray();

      const day = {
        date: dateStr,
        label: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
        calories: entries.reduce((s, e) => s + (e.total_calories || 0), 0),
        protein: entries.reduce((s, e) => s + (e.total_protein || 0), 0),
        fat: entries.reduce((s, e) => s + (e.total_fat || 0), 0),
        carbs: entries.reduce((s, e) => s + (e.total_carbs || 0), 0),
        meals: entries.length,
      };
      result.days.push(day);
    }

    const withData = result.days.filter(d => d.meals > 0);
    if (withData.length > 0) {
      result.avgCalories = Math.round(withData.reduce((s, d) => s + d.calories, 0) / withData.length);
      result.avgProtein = Math.round(withData.reduce((s, d) => s + d.protein, 0) / withData.length);
      result.avgFat = Math.round(withData.reduce((s, d) => s + d.fat, 0) / withData.length);
      result.avgCarbs = Math.round(withData.reduce((s, d) => s + d.carbs, 0) / withData.length);
      result.bestDay = withData.reduce((best, d) => d.calories < best.calories && d.calories > 0 ? d : best);
      result.worstDay = withData.reduce((worst, d) => d.calories > worst.calories ? d : worst);
    }

    return result;
  } catch {
    return { days: [], avgCalories: 0, avgProtein: 0, avgFat: 0, avgCarbs: 0, bestDay: null, worstDay: null };
  }
}

// ─── C2.2: График калорий за неделю ─────────────────────

export async function getWeekCalories(endDate) {
  try {
    const result = [];
    const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(endDate + 'T12:00:00');
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const totals = await getDailyTotals(ds);
      result.push({
        day: DAYS[d.getDay()],
        date: ds,
        calories: totals.calories || 0,
      });
    }
    return result;

  } catch (e) {
    console.error('[nutrition.getWeekCalories]', e);
    return [];
  }
}

// ─── C2.3: Streak дней логирования ──────────────────────

export async function getLoggingStreak() {
  try {
    let streak = 0;
    const d = new Date();
    while (true) {
      const ds = d.toISOString().slice(0, 10);
      const count = await db.food_log.where('date').equals(ds).count();
      if (count > 0) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;

  } catch (e) {
    console.error('[nutrition.getLoggingStreak]', e);
    return null;
  }
}

// ─── C2.4: Остаток калорий + рекомендация ───────────────

export async function getRemainingCalories() {
  try {
    const goal = (await getSetting('daily_calorie_goal')) || 2200;
    const today = new Date().toISOString().slice(0, 10);
    const entries = await db.food_log.where('date').equals(today).toArray();
    const consumed = entries.reduce((s, e) => s + (e.total_calories || 0), 0);
    const remaining = goal - consumed;

    let recommendation;
    if (remaining >= 800) recommendation = 'Полноценный приём пищи';
    else if (remaining >= 400) recommendation = 'Лёгкий перекус';
    else if (remaining > 0) recommendation = 'Что-то лёгкое';
    else recommendation = 'Лимит исчерпан';

    return {
      goal,
      consumed: Math.round(consumed),
      remaining: Math.round(remaining),
      recommendation,
    };

  } catch (e) {
    console.error('[nutrition.getRemainingCalories]', e);
    return [];
  }
}

// ─── C1.3 (доп): Копирование одного типа приёма ────────

export async function copyMealFromDay(sourceDate, mealType, targetDate) {
  try {
    const entries = await db.food_log
      .where('date').equals(sourceDate)
      .filter(e => e.meal_type === mealType)
      .toArray();
    if (entries.length === 0) return 0;
    const copies = entries.map(e => ({
      ...e,
      id: undefined,
      date: targetDate,
      ts: Date.now(),
      created_at: new Date().toISOString(),
    }));
    await db.food_log.bulkAdd(copies);
    return copies.length;

  } catch (e) {
    console.error('[nutrition.copyMealFromDay]', e);
    throw e;
  }
}

// ─── C1.3 (доп): Даты с записями (для bottom sheet) ────

export async function getRecentFoodDates(limit = 14) {
  try {
    const all = await db.food_log.orderBy('date').reverse().toArray();
    const dates = [...new Set(all.map(e => e.date))];
    return dates.slice(0, limit);

  } catch (e) {
    console.error('[nutrition.getRecentFoodDates]', e);
    return [];
  }
}

// ─── C2: Meal Presets (избранные блюда) ────

export async function saveMealPreset(name, items) {
  try {
    return db.settings.put({
      key: `meal_preset_${Date.now()}`,
      value: { name, items, created_at: new Date().toISOString() },
    });

  } catch (e) {
    console.error('[nutrition.saveMealPreset]', e);
    throw e;
  }
}

export async function getMealPresets() {
  try {
    const all = await db.settings.toArray();
    return all
      .filter(s => s.key.startsWith('meal_preset_'))
      .map(s => ({ id: s.key, ...s.value }))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  } catch (e) {
    console.error('[nutrition.getMealPresets]', e);
    return [];
  }
}

export async function deleteMealPreset(id) {
  try {
    return db.settings.delete(id);

  } catch (e) {
    console.error('[nutrition.deleteMealPreset]', e);
    throw e;
  }
}

export async function applyMealPreset(presetId, date, mealType) {
  try {
    const preset = await db.settings.get(presetId);
    if (!preset?.value?.items) return 0;
    const copies = preset.value.items.map(item => ({
      ...item,
      id: undefined,
      date,
      meal_type: mealType,
      ts: Date.now(),
      created_at: new Date().toISOString(),
    }));
    await db.food_log.bulkAdd(copies);
    return copies.length;

  } catch (e) {
    console.error('[nutrition.applyMealPreset]', e);
    throw e;
  }
}
