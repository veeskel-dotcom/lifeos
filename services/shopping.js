/**
 * shopping.js — CRUD shopping_list + автогруппировка по категориям
 * Таблица: shopping_list '++id, checked'
 */
import db from '../db/index';

// ─── Авто-категоризация ─────────────────────────────────

const GROCERY_CATEGORIES = [
  { pattern: /молоко|сметан|творог|кефир|йогурт|сыр|масло\s?слив/i, label: '🥛 Молочное' },
  { pattern: /курица|мясо|фарш|свинин|говядин|рыба|лосось|минтай|индейк/i, label: '🥩 Мясо и рыба' },
  { pattern: /помидор|огурц|картофел|картошк|лук|морков|капуст|банан|яблок|авокадо|лимон|апельсин|ягод|клубник/i, label: '🥬 Овощи и фрукты' },
  { pattern: /хлеб|мука|макарон|рис|гречк|овсян|крупа|вермишел/i, label: '🌾 Крупы и хлеб' },
  { pattern: /мыло|шампун|порошок|губк|бумага|салфетк|зубн|гель|средство/i, label: '🧴 Бытовое' },
  { pattern: /яйц/i, label: '🥚 Яйца' },
  { pattern: /вода|сок|чай|кофе|напит/i, label: '🥤 Напитки' },
];

function autoCategory(name) {
  const n = name.toLowerCase();
  for (const { pattern, label } of GROCERY_CATEGORIES) {
    if (pattern.test(n)) return label;
  }
  return '📦 Прочее';
}

// ─── CRUD ───────────────────────────────────────────────

export async function addItem(name, category, quantity) {
  try {
    const maxOrder = await db.shopping_list.orderBy('sort_order').last();
    const record = {
      name: name.trim(),
      category: category || autoCategory(name),
      quantity: quantity || null,
      checked: false,
      sort_order: (maxOrder?.sort_order || 0) + 1,
      created_at: new Date().toISOString(),
    };
    const id = await db.shopping_list.add(record);
    return { ...record, id };

  } catch (e) {
    console.error('[shopping.addItem]', e);
    throw e;
  }
}

export async function toggleItem(id) {
  try {
    const item = await db.shopping_list.get(id);
    if (!item) return;
    await db.shopping_list.update(id, { checked: !item.checked });
    return db.shopping_list.get(id);

  } catch (e) {
    console.error('[shopping.toggleItem]', e);
    throw e;
  }
}

export async function deleteItem(id) {
  try {
    await db.shopping_list.delete(id);

  } catch (e) {
    console.error('[shopping.deleteItem]', e);
    throw e;
  }
}

export async function updateItem(id, data) {
  try {
    await db.shopping_list.update(id, data);
    return db.shopping_list.get(id);

  } catch (e) {
    console.error('[shopping.updateItem]', e);
    throw e;
  }
}

/**
 * Все элементы, сгруппированные по категории. Некупленные первые.
 * @returns {{ unchecked: Map<category, items[]>, checked: items[] }}
 */
export async function getItems() {
  try {
    const all = await db.shopping_list.toArray();
    all.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const unchecked = new Map();
    const checked = [];

    for (const item of all) {
      if (item.checked) {
        checked.push(item);
      } else {
        const cat = item.category || '📦 Прочее';
        if (!unchecked.has(cat)) unchecked.set(cat, []);
        unchecked.get(cat).push(item);
      }
    }

    return { unchecked, checked };

  } catch (e) {
    console.error('[shopping.getItems]', e);
    return [];
  }
}

export async function clearChecked() {
  try {
    const checked = await db.shopping_list.where('checked').equals(1).toArray();
    // Dexie boolean index: checked=true может быть 1 или true
    const allChecked = await db.shopping_list.filter(i => i.checked === true).toArray();
    const ids = allChecked.map(i => i.id);
    await db.shopping_list.bulkDelete(ids);
    return ids.length;

  } catch (e) {
    console.error('[shopping.clearChecked]', e);
    throw e;
  }
}

export async function reorderItem(id, newOrder) {
  try {
    await db.shopping_list.update(id, { sort_order: newOrder });

  } catch (e) {
    console.error('[shopping.reorderItem]', e);
    throw e;
  }
}
