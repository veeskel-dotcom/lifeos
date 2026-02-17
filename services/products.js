/**
 * products.js — Каскадный поиск продуктов: кэш → FatSecret → OpenFoodFacts → AI
 * Таблица: food_products '++id, barcode, *name_tokens, usage_count'
 *
 * API-клиенты: ../api/fatSecret, ../api/openFoodFacts (создаёт B)
 */
import db from '../db/index';
import { searchFood, getFoodDetail } from '../api/fatSecret';
import { searchFoodOFF, getByBarcode } from '../api/openFoodFacts';
import { PRESET_PRODUCTS } from './foodDatabase';

// ─── Каскадный поиск ───────────────────────────────────

/**
 * Поиск продуктов: локальный кэш → FatSecret → Open Food Facts.
 * @param {string} query
 * @param {object} options
 * @param {boolean} options.onlineSearch — искать в API (default: true)
 * @returns {{ results: Array, source: string }}
 */
export async function searchProducts(query, { onlineSearch = true } = {}) {
  if (!query || query.trim().length < 2) return { results: [], source: 'local' };

  // 1. Локальный поиск (IndexedDB food_products)
  const local = await db.food_products
    .filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    .limit(10)
    .toArray();

  // Сортировать по usage_count (чаще используемые выше)
  local.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));

  // 1.5 R4.1: Preset products (offline-safe)
  const q = query.toLowerCase();
  const presetResults = PRESET_PRODUCTS
    .filter(p => p.name.toLowerCase().includes(q))
    .slice(0, 5)
    .map(p => ({
      name: p.name,
      calories: p.cal,
      protein: p.p,
      fat: p.f,
      carbs: p.c,
      source: 'preset',
    }));

  if (!onlineSearch || !navigator.onLine) {
    return { results: [...local, ...presetResults], source: 'local' };
  }

  // 2. Онлайн: FatSecret (приоритет) → OpenFoodFacts (fallback)
  let online = [];
  let source = 'local';

  try {
    const fs = await searchFood(query);
    online = fs.results;
    source = 'fatsecret';
  } catch {
    try {
      const off = await searchFoodOFF(query);
      online = off.results;
      source = 'openfoodfacts';
    } catch {
      // Оба API недоступны — только локальные
    }
  }

  // 3. Дедупликация: если локальный продукт совпадает с онлайн — оставить локальный
  const localNames = new Set(local.map(l => l.name.toLowerCase()));
  const uniqueOnline = online.filter(o => !localNames.has(o.name.toLowerCase()));
  // R4.1: Add presets not already covered
  const allNames = new Set([...localNames, ...uniqueOnline.map(o => o.name.toLowerCase())]);
  const uniquePresets = presetResults.filter(p => !allNames.has(p.name.toLowerCase()));

  return {
    results: [...local, ...uniqueOnline, ...uniquePresets],
    source,
  };
}

// ─── Штрих-код ──────────────────────────────────────────

/**
 * Поиск по штрих-коду: кэш → OpenFoodFacts API.
 */
export async function findByBarcode(barcode) {
  if (!barcode) return { product: null, source: 'invalid' };

  // 1. Локально
  const local = await db.food_products.where('barcode').equals(barcode).first();
  if (local) return { product: local, source: 'local' };

  // 2. OpenFoodFacts (бесплатный, хорошая база штрих-кодов)
  if (!navigator.onLine) return { product: null, source: 'offline' };

  try {
    const product = await getByBarcode(barcode);
    if (product) {
      // Сохранить в локальную базу
      await saveToLocal(product, barcode);
      return { product, source: 'openfoodfacts' };
    }
  } catch {}

  return { product: null, source: 'not_found' };
}

// ─── Сохранение и кэш ──────────────────────────────────

/**
 * Сохранить онлайн-продукт в локальную базу (для кэша + usage_count).
 */
export async function saveToLocal(product, barcode = null) {
  try {
    const bc = barcode || product.barcode;
    const existing = bc
      ? await db.food_products.where('barcode').equals(bc).first()
      : await db.food_products.filter(p => p.name === product.name).first();

    if (existing) {
      await db.food_products.update(existing.id, {
        usage_count: (existing.usage_count || 0) + 1,
      });
      return existing.id;
    }

    return db.food_products.add({
      name: product.name,
      brand: product.brand || null,
      barcode: bc || null,
      calories_100g: product.calories,
      protein_100g: product.protein,
      fat_100g: product.fat,
      carbs_100g: product.carbs,
      usage_count: 1,
      source: product.source || 'online',
      created_at: new Date().toISOString(),
    });

  } catch (e) {
    console.error('[products.saveToLocal]', e);
    throw e;
  }
}

/**
 * Увеличить usage_count при логировании еды.
 */
export async function incrementUsage(productId) {
  try {
    const p = await db.food_products.get(productId);
    if (p) await db.food_products.update(productId, { usage_count: (p.usage_count || 0) + 1 });

  } catch (e) {
    console.error('[products.incrementUsage]', e);
    throw e;
  }
}

// ─── Алиасы для совместимости с nutrition экранами ──────

/** Алиас findByBarcode для FoodSearch */
export const searchByBarcode = findByBarcode;

/** C1.6: Штрих-код: BarcodeDetector API → AI vision fallback */
export async function scanBarcode(imageBase64) {
  try {
    // Попытка 1: BarcodeDetector API (Chrome 83+, не iOS Safari)
    if (typeof BarcodeDetector !== 'undefined') {
      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      // Создать Image из base64
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
      });
      const barcodes = await detector.detect(img);
      if (barcodes.length > 0) return barcodes[0].rawValue;
    }

    // Попытка 2: AI Vision — распознать штрих-код на фото
    const { callAIVision } = await import('../ai/client');
    const stripped = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const result = await callAIVision({
      imageBase64: stripped,
      prompt: 'Найди штрих-код на фото. Верни ТОЛЬКО числовой код (EAN-13 или EAN-8). Если нет штрих-кода — верни слово "none".',
      maxTokens: 30,
    });
    const code = result.content.trim().replace(/\D/g, '');
    if (code.length >= 8 && code.length <= 13) return code;

    return null;
  } catch (e) {
    console.error('[products.scanBarcode]', e);
    return null;
  }
}

/** Недавно использованные продукты */
export async function getRecentProducts(limit = 20) {
  try {
    return db.food_products
      .orderBy('usage_count')
      .reverse()
      .filter(p => (p.usage_count || 0) > 0)
      .limit(limit)
      .toArray();

  } catch (e) {
    console.error('[products.getRecentProducts]', e);
    return [];
  }
}

/** Избранные продукты */
export async function getFavoriteProducts() {
  try {
    return db.food_products.filter(p => p.is_favorite).toArray();

  } catch (e) {
    console.error('[products.getFavoriteProducts]', e);
    return [];
  }
}

/** Добавить продукт вручную (обёртка saveToLocal) */
export async function addManualProduct(data) {
  try {
    return saveToLocal({
      name: data.name,
      brand: data.brand || null,
      calories: data.calories_100g || data.calories || 0,
      protein: data.protein_100g || data.protein || 0,
      fat: data.fat_100g || data.fat || 0,
      carbs: data.carbs_100g || data.carbs || 0,
      barcode: data.barcode || null,
    });

  } catch (e) {
    console.error('[products.addManualProduct]', e);
    throw e;
  }
}

/** C1.7: AI-распознавание фото еды через Vision */
export async function recognizeFoodPhoto(imageBase64) {
  try {
    const { recognizeFood } = await import('./foodVision');
    const result = await recognizeFood(imageBase64);
    if (!result.items?.length) throw new Error('Не удалось определить еду');
    // Возвращаем первый item в формате, совместимом с FoodSearch
    const item = result.items[0];
    return {
      name: item.name,
      amount_g: item.amount_g || 250,
      calories: item.calories,
      protein: item.protein,
      fat: item.fat,
      carbs: item.carbs,
      source: 'vision',
    };
  } catch (e) {
    console.error('[products.recognizeFoodPhoto]', e);
    throw e;
  }
}
