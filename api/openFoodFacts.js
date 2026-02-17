/**
 * openFoodFacts.js — Fallback поиск продуктов (без ключа).
 * Поиск + штрих-код. Русский язык, Казахстан.
 */
import { fetchWithRetry, requireOnline } from './_shared';

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';

/* ─── Normalization ─── */

function normalizeOFFProduct(product) {
  const n = product.nutriments || {};
  return {
    id: product._id || product.code || '',
    name: product.product_name_ru || product.product_name || 'Без названия',
    brand: product.brands || null,
    calories: Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0),
    protein: Math.round((n.proteins_100g || 0) * 10) / 10,
    fat: Math.round((n.fat_100g || 0) * 10) / 10,
    carbs: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
    barcode: product.code || null,
    image_url: product.image_small_url || null,
    source: 'openfoodfacts',
  };
}

/* ─── Search ─── */

export async function searchFoodOFF(query, page = 1) {
  requireOnline();

  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '20',
    page: String(page),
    lc: 'ru',
    cc: 'kz',
  });

  const data = await fetchWithRetry(`${SEARCH_URL}?${params}`, {}, { retries: 1 });

  const products = data.products || [];
  return {
    results: products
      .filter(p => p.product_name || p.product_name_ru) // отсеять пустые
      .map(normalizeOFFProduct),
    total: data.count || 0,
  };
}

/* ─── Barcode ─── */

export async function getByBarcode(barcode) {
  requireOnline();

  const data = await fetchWithRetry(`${PRODUCT_URL}/${barcode}.json`, {}, { retries: 1 });

  if (data.status !== 1 || !data.product) return null;

  return normalizeOFFProduct(data.product);
}
