/**
 * fatSecret.js — Поиск продуктов через FatSecret API.
 * OAuth 2.0 client_credentials, токен кэш 24ч.
 */
import { fetchWithRetry, requireOnline } from './_shared';

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const API_URL = 'https://platform.fatsecret.com/rest/server.api';

let tokenCache = { token: null, expiresAt: 0 };

/* ─── OAuth Token ─── */

async function getToken() {
  // Проверить memory cache
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  // Проверить IndexedDB cache
  try {
    const { default: db } = await import('../db/index');
    const cached = await db.settings.get('fatsecret_token');
    if (cached?.value?.token && Date.now() < cached.value.expiresAt) {
      tokenCache = cached.value;
      return tokenCache.token;
    }
  } catch {}

  // Получить новый токен
  const clientId = import.meta.env.VITE_FATSECRET_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_FATSECRET_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('FatSecret API ключи не настроены');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'basic',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`FatSecret OAuth failed: HTTP ${res.status}`);

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000, // 60с запас
  };

  // Сохранить в IndexedDB
  try {
    const { default: db } = await import('../db/index');
    await db.settings.put({ key: 'fatsecret_token', value: tokenCache });
  } catch {}

  return tokenCache.token;
}

/* ─── Normalization ─── */

function normalizeFoodResult(item) {
  const desc = item.food_description || '';
  // "Per 100g - Calories: 52kcal | Fat: 0.17g | Carbs: 13.81g | Protein: 0.26g"
  const cal = parseFloat(desc.match(/Calories:\s*([\d.]+)/i)?.[1] || '0');
  const fat = parseFloat(desc.match(/Fat:\s*([\d.]+)/i)?.[1] || '0');
  const carbs = parseFloat(desc.match(/Carbs:\s*([\d.]+)/i)?.[1] || '0');
  const protein = parseFloat(desc.match(/Protein:\s*([\d.]+)/i)?.[1] || '0');

  return {
    id: item.food_id,
    name: item.food_name || 'Без названия',
    brand: item.brand_name || null,
    calories: Math.round(cal),
    protein: Math.round(protein * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    serving_size: '100g',
    source: 'fatsecret',
  };
}

/* ─── Search ─── */

export async function searchFood(query, page = 0) {
  requireOnline();
  const token = await getToken();

  const params = new URLSearchParams({
    method: 'foods.search.v3',
    search_expression: query,
    format: 'json',
    max_results: '20',
    page_number: String(page),
    region: 'RU',
    language: 'ru',
  });

  const data = await fetchWithRetry(`${API_URL}?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const foods = data.foods_search?.results?.food || [];
  const arr = Array.isArray(foods) ? foods : [foods];
  const total = parseInt(data.foods_search?.total_results || '0', 10);

  return {
    results: arr.map(normalizeFoodResult),
    total,
  };
}

/* ─── Food Detail ─── */

export async function getFoodDetail(foodId) {
  requireOnline();
  const token = await getToken();

  const params = new URLSearchParams({
    method: 'food.get.v4',
    food_id: String(foodId),
    format: 'json',
    region: 'RU',
    language: 'ru',
  });

  const data = await fetchWithRetry(`${API_URL}?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const food = data.food;
  if (!food) return null;

  const servingsRaw = food.servings?.serving || [];
  const servings = (Array.isArray(servingsRaw) ? servingsRaw : [servingsRaw]).map(s => ({
    size: s.serving_description || s.measurement_description || '1 порция',
    calories: Math.round(parseFloat(s.calories || '0')),
    protein: Math.round(parseFloat(s.protein || '0') * 10) / 10,
    fat: Math.round(parseFloat(s.fat || '0') * 10) / 10,
    carbs: Math.round(parseFloat(s.carbohydrate || '0') * 10) / 10,
    amount_g: parseFloat(s.metric_serving_amount || '100'),
  }));

  return {
    id: food.food_id,
    name: food.food_name || 'Без названия',
    brand: food.brand_name || null,
    servings,
  };
}
