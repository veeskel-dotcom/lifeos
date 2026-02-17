/**
 * R4.1: База продуктов RU/KZ.
 * Предустановленные продукты + пользовательские.
 * КБЖУ на 100г.
 */
import db from '../db/index';

const PRESET_PRODUCTS = [
  // Молочные
  { name: 'Молоко 2.5%', cal: 52, p: 2.8, f: 2.5, c: 4.7, group: 'dairy' },
  { name: 'Кефир 1%', cal: 40, p: 3.0, f: 1.0, c: 4.0, group: 'dairy' },
  { name: 'Творог 5%', cal: 121, p: 17.2, f: 5.0, c: 1.8, group: 'dairy' },
  { name: 'Творог 9%', cal: 159, p: 16.7, f: 9.0, c: 2.0, group: 'dairy' },
  { name: 'Сметана 15%', cal: 158, p: 2.6, f: 15.0, c: 3.0, group: 'dairy' },
  { name: 'Сыр Российский', cal: 363, p: 24.1, f: 29.5, c: 0, group: 'dairy' },
  { name: 'Йогурт натуральный', cal: 60, p: 4.3, f: 2.0, c: 6.2, group: 'dairy' },

  // Мясо
  { name: 'Куриная грудка', cal: 113, p: 23.6, f: 1.9, c: 0.4, group: 'meat' },
  { name: 'Куриное бедро', cal: 185, p: 16.0, f: 13.0, c: 0, group: 'meat' },
  { name: 'Говядина', cal: 187, p: 18.9, f: 12.4, c: 0, group: 'meat' },
  { name: 'Свинина', cal: 242, p: 16.0, f: 21.6, c: 0, group: 'meat' },
  { name: 'Фарш куриный', cal: 143, p: 17.4, f: 8.1, c: 0, group: 'meat' },
  { name: 'Фарш говяжий', cal: 254, p: 17.2, f: 20.0, c: 0, group: 'meat' },
  { name: 'Индейка', cal: 104, p: 21.6, f: 1.2, c: 0, group: 'meat' },

  // Рыба
  { name: 'Лосось / сёмга', cal: 208, p: 20.0, f: 13.6, c: 0, group: 'fish' },
  { name: 'Минтай', cal: 72, p: 15.9, f: 0.9, c: 0, group: 'fish' },
  { name: 'Тунец консерв.', cal: 96, p: 21.0, f: 1.0, c: 0, group: 'fish' },

  // Крупы и гарниры
  { name: 'Рис белый (варёный)', cal: 130, p: 2.7, f: 0.3, c: 28.2, group: 'grains' },
  { name: 'Гречка (варёная)', cal: 110, p: 4.2, f: 1.1, c: 21.3, group: 'grains' },
  { name: 'Овсянка (варёная)', cal: 88, p: 3.0, f: 1.7, c: 15.0, group: 'grains' },
  { name: 'Макароны (варёные)', cal: 131, p: 5.0, f: 1.1, c: 27.0, group: 'grains' },
  { name: 'Картофель варёный', cal: 82, p: 2.0, f: 0.4, c: 16.7, group: 'grains' },
  { name: 'Хлеб белый', cal: 265, p: 9.2, f: 3.2, c: 49.0, group: 'grains' },
  { name: 'Хлеб чёрный', cal: 201, p: 6.6, f: 1.2, c: 40.7, group: 'grains' },

  // Яйца
  { name: 'Яйцо куриное (1 шт ≈ 60г)', cal: 155, p: 12.7, f: 10.9, c: 0.7, group: 'eggs' },

  // Фрукты
  { name: 'Банан', cal: 96, p: 1.5, f: 0.5, c: 21.0, group: 'fruit' },
  { name: 'Яблоко', cal: 47, p: 0.4, f: 0.4, c: 9.8, group: 'fruit' },
  { name: 'Апельсин', cal: 43, p: 0.9, f: 0.2, c: 8.1, group: 'fruit' },

  // Овощи
  { name: 'Огурец', cal: 15, p: 0.8, f: 0.1, c: 2.8, group: 'veg' },
  { name: 'Помидор', cal: 20, p: 0.6, f: 0.2, c: 4.2, group: 'veg' },
  { name: 'Капуста белокочанная', cal: 28, p: 1.8, f: 0.1, c: 4.7, group: 'veg' },
  { name: 'Морковь', cal: 35, p: 1.3, f: 0.1, c: 6.9, group: 'veg' },

  // Орехи
  { name: 'Миндаль', cal: 575, p: 18.6, f: 49.4, c: 13.0, group: 'nuts' },
  { name: 'Грецкий орех', cal: 654, p: 15.2, f: 65.2, c: 7.0, group: 'nuts' },
  { name: 'Арахис', cal: 567, p: 25.8, f: 49.2, c: 9.9, group: 'nuts' },

  // Популярные блюда
  { name: 'Плов', cal: 150, p: 5.0, f: 6.0, c: 20.0, group: 'dish' },
  { name: 'Бешбармак', cal: 193, p: 14.0, f: 10.0, c: 14.0, group: 'dish' },
  { name: 'Борщ', cal: 49, p: 1.8, f: 2.2, c: 5.4, group: 'dish' },
  { name: 'Оливье', cal: 198, p: 5.0, f: 16.0, c: 9.0, group: 'dish' },
  { name: 'Шаурма', cal: 215, p: 10.0, f: 12.0, c: 18.0, group: 'dish' },
  { name: 'Манты', cal: 208, p: 10.5, f: 12.5, c: 13.0, group: 'dish' },
  { name: 'Лагман', cal: 105, p: 5.0, f: 4.0, c: 12.0, group: 'dish' },
  { name: 'Самса', cal: 264, p: 8.0, f: 14.0, c: 26.0, group: 'dish' },

  // Напитки
  { name: 'Кумыс', cal: 50, p: 2.1, f: 1.9, c: 5.0, group: 'drink' },
  { name: 'Айран', cal: 27, p: 1.1, f: 1.5, c: 1.4, group: 'drink' },
];

const GROUP_LABELS = {
  dairy: '🥛 Молочные',
  meat: '🥩 Мясо',
  fish: '🐟 Рыба',
  grains: '🌾 Крупы / Гарниры',
  eggs: '🥚 Яйца',
  fruit: '🍎 Фрукты',
  veg: '🥗 Овощи',
  nuts: '🥜 Орехи',
  dish: '🍲 Готовые блюда',
  drink: '🥤 Напитки',
};

export { PRESET_PRODUCTS, GROUP_LABELS };

/**
 * Поиск продуктов: сначала preset, потом пользовательские.
 */
export async function searchProducts(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  // Preset
  const presetResults = PRESET_PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(q)
  ).map(p => ({
    ...p,
    source: 'preset',
    calories: p.cal,
    protein: p.p,
    fat: p.f,
    carbs: p.c,
  }));

  // Пользовательские
  let userResults = [];
  try {
    const all = await db.food_products.toArray();
    userResults = all.filter(p =>
      (p.name || '').toLowerCase().includes(q)
    ).map(p => ({ ...p, source: 'user' }));
  } catch {}

  return [...userResults, ...presetResults].slice(0, 20);
}

/**
 * Добавить пользовательский продукт.
 */
export async function addUserProduct(product) {
  return db.food_products.add({
    name: product.name,
    calories: product.calories || 0,
    protein: product.protein || 0,
    fat: product.fat || 0,
    carbs: product.carbs || 0,
    barcode: product.barcode || null,
    name_tokens: product.name.toLowerCase().split(/\s+/),
    usage_count: 0,
    created_at: new Date().toISOString(),
  });
}

/**
 * Сгруппированный каталог для просмотра.
 */
export function getGroupedProducts() {
  const groups = {};
  for (const p of PRESET_PRODUCTS) {
    if (!groups[p.group]) groups[p.group] = [];
    groups[p.group].push(p);
  }
  return Object.entries(groups).map(([key, items]) => ({
    key,
    label: GROUP_LABELS[key] || key,
    items,
  }));
}
