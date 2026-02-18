/**
 * foodVision.js — Двухшаговое распознавание еды.
 *
 * Пайплайн:
 * 1. Sonnet 4.5 (food_vision): фото → список ингредиентов + примерный вес
 * 2. FatSecret API: поиск точных КБЖУ на 100г
 * 3. Flash (food_disambig): если неоднозначно — выбрать лучшее совпадение
 * 4. Масштабирование КБЖУ на реальный вес порции
 */

import { callAI, callAIVision } from '../ai/client';

// ═══ Утилиты ═══

function parseJSON(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Не удалось разобрать ответ AI: ${err.message}`);
  }
}

function stripBase64Prefix(base64) {
  return base64.replace(/^data:image\/\w+;base64,/, '');
}

// ═══ Шаг 1: Идентификация ингредиентов (Sonnet 4.5) ═══

async function identifyIngredients(imageBase64) {
  const result = await callAIVision({
    imageBase64: stripBase64Prefix(imageBase64),
    model: 'food_vision',
    prompt: `Определи все ингредиенты/блюда на фото. Верни JSON:
{
  "items": [
    {"name": "куриная грудка", "amount_g": 150},
    {"name": "рис", "amount_g": 200}
  ],
  "meal_type": "breakfast|lunch|dinner|snack",
  "description": "краткое описание одним предложением"
}

Правила:
- name — конкретное название продукта для поиска в базе (не "мясо", а "куриная грудка")
- amount_g — примерный вес порции в граммах (оценка визуально)
- Если несколько блюд — перечисли все
- meal_type определи по содержимому
- Если не можешь определить еду — верни items: []
- Только JSON`,
    maxTokens: 600,
    temperature: 0.2,
  });

  return parseJSON(result.content);
}

// ═══ Шаг 2: Обогащение из FatSecret ═══

async function enrichWithFatSecret(item) {
  try {
    const { searchFood } = await import('../api/fatSecret');
    const { results } = await searchFood(item.name, 0);

    if (!results || results.length === 0) {
      return null; // Нет совпадений — fallback на LLM-оценку
    }

    // Одно точное совпадение — берём
    if (results.length === 1) {
      return scalePortion(results[0], item.amount_g);
    }

    // Несколько кандидатов — шаг 3: Flash для выбора
    const best = await disambiguateMatch(item.name, results.slice(0, 5));
    return scalePortion(best, item.amount_g);
  } catch {
    // FatSecret недоступен — пробуем OpenFoodFacts
    try {
      const { searchFoodOFF } = await import('../api/openFoodFacts');
      const { results } = await searchFoodOFF(item.name);
      if (results?.[0]) return scalePortion(results[0], item.amount_g);
    } catch {}
    return null;
  }
}

// ═══ Шаг 3: Уточнение совпадения (Flash) ═══

async function disambiguateMatch(query, candidates) {
  try {
    const candidateList = candidates.map((c, i) =>
      `${i + 1}. ${c.name}${c.brand ? ` (${c.brand})` : ''} — ${c.calories} ккал, Б${c.protein} Ж${c.fat} У${c.carbs} на 100г`
    ).join('\n');

    const result = await callAI({
      prompt: `Пользователь ищет: «${query}»
Кандидаты из базы:
${candidateList}

Какой номер лучше всего подходит? Ответь ОДНИМ числом (1-${candidates.length}).`,
      model: 'food_disambig',
      maxTokens: 5,
      temperature: 0,
    });

    const idx = parseInt(result.content.trim()) - 1;
    if (idx >= 0 && idx < candidates.length) return candidates[idx];
  } catch {}

  // Fallback — первый кандидат
  return candidates[0];
}

// ═══ Масштабирование КБЖУ на порцию ═══

function scalePortion(foodData, amountG) {
  const factor = amountG / 100;
  return {
    name: foodData.name,
    brand: foodData.brand || null,
    amount_g: amountG,
    calories: Math.round(foodData.calories * factor),
    protein: Math.round(foodData.protein * factor * 10) / 10,
    fat: Math.round(foodData.fat * factor * 10) / 10,
    carbs: Math.round(foodData.carbs * factor * 10) / 10,
    source: 'fatsecret',
  };
}

// ═══ Fallback: LLM-оценка КБЖУ (если FatSecret не дал результатов) ═══

async function llmEstimateNutrition(item) {
  try {
    const result = await callAI({
      prompt: `Продукт: ${item.name}, порция ${item.amount_g}г.
Оцени КБЖУ. Верни JSON: {"calories":X,"protein":X,"fat":X,"carbs":X}
Только JSON.`,
      model: 'food_disambig',
      maxTokens: 50,
      temperature: 0,
    });
    const data = parseJSON(result.content);
    return {
      name: item.name,
      amount_g: item.amount_g,
      calories: Math.round(data.calories || 0),
      protein: Math.round((data.protein || 0) * 10) / 10,
      fat: Math.round((data.fat || 0) * 10) / 10,
      carbs: Math.round((data.carbs || 0) * 10) / 10,
      source: 'ai_estimate',
    };
  } catch {
    return {
      name: item.name,
      amount_g: item.amount_g,
      calories: 0, protein: 0, fat: 0, carbs: 0,
      source: 'unknown',
    };
  }
}

// ═══ Главная функция: фото → КБЖУ ═══

/**
 * Двухшаговое распознавание еды.
 * @param {string} imageBase64 - base64 изображения
 * @returns {{ items: Array<{name, amount_g, calories, protein, fat, carbs, source}>, meal_type, description, confidence }}
 */
export async function recognizeFood(imageBase64) {
  // Шаг 1: Идентификация ингредиентов
  const identified = await identifyIngredients(imageBase64);

  if (!identified.items || identified.items.length === 0) {
    return {
      items: [],
      meal_type: 'lunch',
      description: 'Не удалось определить',
      confidence: 0,
    };
  }

  // Шаг 2+3: Обогащение из FatSecret (параллельно для всех ингредиентов)
  const enrichedResults = await Promise.all(
    identified.items.map(async (item) => {
      const enriched = await enrichWithFatSecret(item);
      if (enriched) return enriched;
      // Fallback: LLM-оценка
      return llmEstimateNutrition(item);
    })
  );

  return {
    items: enrichedResults,
    meal_type: identified.meal_type || 'lunch',
    description: identified.description || enrichedResults.map(i => i.name).join(', '),
    confidence: enrichedResults.some(i => i.source === 'fatsecret') ? 0.85 : 0.7,
  };
}

/**
 * Быстрый подсчёт калорий из фото (без деталей).
 */
export async function quickCaloriesFromPhoto(imageBase64) {
  const result = await callAIVision({
    imageBase64: stripBase64Prefix(imageBase64),
    model: 'food_vision',
    prompt: `Сколько примерно калорий на этой тарелке?
Ответь ОДНИМ числом (целое число ккал). Ничего кроме числа.`,
    maxTokens: 20,
  });

  const num = parseInt(result.content.trim().replace(/\D/g, ''));
  return isNaN(num) ? null : num;
}
