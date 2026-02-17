/**
 * categorize.js — A2.3: AI автокатегоризация расходов.
 *
 * Подход:
 * 1. Сначала пробуем локальные правила (0 API-вызовов)
 * 2. Если не уверены — вызываем AI fast (~$0.001)
 * 3. Запоминаем результат для обучения
 */

import { callAI } from '../ai/client';
import db from '../db/index';

// ═══ Локальные правила (L0 — бесплатно) ═══

const KEYWORD_MAP = {
  // Продукты
  'магнит': 'Продукты', 'пятёрочка': 'Продукты', 'пятерочка': 'Продукты',
  'перекрёсток': 'Продукты', 'перекресток': 'Продукты', 'ашан': 'Продукты',
  'лента': 'Продукты', 'дикси': 'Продукты', 'вкусвилл': 'Продукты',
  'small': 'Продукты', 'magnum': 'Продукты', 'рамстор': 'Продукты',
  // Кафе
  'кофе': 'Кафе и рестораны', 'starbucks': 'Кафе и рестораны',
  'кафе': 'Кафе и рестораны', 'ресторан': 'Кафе и рестораны',
  'макдональдс': 'Кафе и рестораны', 'kfc': 'Кафе и рестораны',
  'бургер': 'Кафе и рестораны', 'пицца': 'Кафе и рестораны',
  'додо': 'Кафе и рестораны', 'глово': 'Кафе и рестораны',
  'wolt': 'Кафе и рестораны', 'яндекс еда': 'Кафе и рестораны',
  // Транспорт
  'такси': 'Транспорт', 'яндекс такси': 'Транспорт', 'uber': 'Транспорт',
  'indriver': 'Транспорт', 'метро': 'Транспорт', 'автобус': 'Транспорт',
  'бензин': 'Авто', 'заправка': 'Авто', 'азс': 'Авто',
  // Здоровье
  'аптека': 'Здоровье', 'лекарств': 'Здоровье', 'врач': 'Здоровье',
  'клиника': 'Здоровье', 'стоматолог': 'Здоровье', 'анализ': 'Здоровье',
  // Связь
  'beeline': 'Связь', 'kcell': 'Связь', 'tele2': 'Связь',
  'мтс': 'Связь', 'мегафон': 'Связь', 'билайн': 'Связь',
  // Развлечения
  'кино': 'Развлечения', 'netflix': 'Развлечения', 'spotify': 'Развлечения',
  'steam': 'Развлечения', 'игр': 'Развлечения',
  // Одежда
  'zara': 'Одежда', 'hm': 'Одежда', 'h&m': 'Одежда',
  'uniqlo': 'Одежда', 'одежд': 'Одежда',
  // Образование
  'курс': 'Образование', 'книг': 'Образование', 'обучени': 'Образование',
  // Спорт
  'фитнес': 'Спорт', 'тренажёр': 'Спорт', 'тренажер': 'Спорт',
  'протеин': 'Спорт', 'спортпит': 'Спорт',
};

/**
 * Локальная категоризация по ключевым словам.
 * @returns {string|null} название категории или null
 */
function localCategorize(description) {
  if (!description) return null;
  const lower = description.toLowerCase();

  for (const [keyword, category] of Object.entries(KEYWORD_MAP)) {
    if (lower.includes(keyword)) return category;
  }
  return null;
}

// ═══ Кэш обученных паттернов ═══

const learnedCache = new Map();

async function loadLearnedPatterns() {
  if (learnedCache.size > 0) return;
  try {
    const rules = await db.ai_auto_rules.toArray();
    for (const r of rules) {
      learnedCache.set(r.input_pattern, r.category_name);
    }
  } catch {}
}

/**
 * Запомнить связку описание → категория.
 */
export async function learnCategorization(description, categoryName) {
  const key = description.toLowerCase().trim();
  learnedCache.set(key, categoryName);
  try {
    await db.ai_auto_rules.put({
      input_pattern: key,
      category_name: categoryName,
      action: 'categorize',
      updated_at: Date.now(),
    });
  } catch {}
}

// ═══ AI категоризация (L3 — $0.001) ═══

const CATEGORIES_LIST = [
  'Продукты', 'Кафе и рестораны', 'Транспорт', 'Жильё', 'ЖКХ',
  'Здоровье', 'Одежда', 'Развлечения', 'Образование', 'Связь',
  'Подписки', 'Бытовое', 'Переводы', 'Спорт', 'Красота', 'Авто', 'Прочее',
];

async function aiCategorize(description, amount) {
  try {
    const result = await callAI({
      prompt: `Расход: «${description}» ${amount ? amount + '₸' : ''}.
Определи категорию. Ответ — ОДНО слово из списка: ${CATEGORIES_LIST.join(', ')}.
Только название категории, ничего больше.`,
      model: 'fast',
      maxTokens: 20,
      temperature: 0,
    });

    const category = result.content.trim().replace(/[«»"'.]/g, '');
    if (CATEGORIES_LIST.includes(category)) return category;

    // Fuzzy match
    const lower = category.toLowerCase();
    return CATEGORIES_LIST.find(c => c.toLowerCase() === lower) || null;
  } catch {
    return null;
  }
}

// ═══ Главная функция ═══

/**
 * Определить категорию расхода.
 * Каскад: learned → local keywords → AI.
 *
 * @param {string} description - описание расхода
 * @param {number} [amount] - сумма (для контекста AI)
 * @returns {{ category: string|null, source: 'learned'|'local'|'ai'|null, confidence: number }}
 */
export async function categorizeExpense(description, amount) {
  if (!description) return { category: null, source: null, confidence: 0 };

  // 1. Обученные паттерны (бесплатно, точно)
  await loadLearnedPatterns();
  const learned = learnedCache.get(description.toLowerCase().trim());
  if (learned) return { category: learned, source: 'learned', confidence: 0.95 };

  // 2. Локальные ключевые слова (бесплатно, быстро)
  const local = localCategorize(description);
  if (local) return { category: local, source: 'local', confidence: 0.85 };

  // 3. AI (платно, умно)
  const ai = await aiCategorize(description, amount);
  if (ai) {
    // Запомнить для будущего
    await learnCategorization(description, ai);
    return { category: ai, source: 'ai', confidence: 0.75 };
  }

  return { category: null, source: null, confidence: 0 };
}

/**
 * Найти category_id по названию.
 */
export async function findCategoryId(categoryName) {
  if (!categoryName) return null;
  try {
    const cats = await db.categories.where('module').equals('expense').toArray();
    const match = cats.find(c => c.name === categoryName);
    return match?.id || null;
  } catch {
    return null;
  }
}
