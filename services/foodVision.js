/**
 * foodVision.js — C1.7: Фото еды → КБЖУ через AI Vision.
 *
 * Фотографирует тарелку → Gemini Flash Vision определяет:
 * - Что на фото (название блюда)
 * - Примерный вес порции
 * - Калории, белки, жиры, углеводы
 */

import { callAIVision } from '../ai/client';

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

// ═══ Распознавание еды ═══

/**
 * Фото еды → структурированные данные.
 * @param {string} imageBase64 - base64 изображения
 * @returns {{ items: Array<{name, amount_g, calories, protein, fat, carbs}>, meal_type: string }}
 */
export async function recognizeFood(imageBase64) {
  const result = await callAIVision({
    imageBase64: stripBase64Prefix(imageBase64),
    prompt: `Определи еду на фото. Верни JSON:
{
  "items": [
    {
      "name": "название блюда на русском",
      "amount_g": 250,
      "calories": 350,
      "protein": 15,
      "fat": 12,
      "carbs": 40
    }
  ],
  "meal_type": "breakfast|lunch|dinner|snack",
  "description": "краткое описание одним предложением"
}

Правила:
- Если несколько блюд на фото — перечисли все в items
- amount_g — примерный вес порции в граммах
- КБЖУ указывай на порцию, не на 100г
- meal_type определи по времени (если непонятно — "lunch")
- Если не можешь определить еду — верни items: [] и description: "Не удалось определить"
- Только JSON, ничего больше`,
    maxTokens: 800,
  });

  const data = parseJSON(result.content);

  // Валидация
  if (!data.items || !Array.isArray(data.items)) {
    return { items: [], meal_type: 'lunch', description: 'Не удалось определить', confidence: 0 };
  }

  // Нормализация
  const items = data.items.map(item => ({
    name: item.name || 'Неизвестное блюдо',
    amount_g: Math.round(item.amount_g || 100),
    calories: Math.round(item.calories || 0),
    protein: Math.round((item.protein || 0) * 10) / 10,
    fat: Math.round((item.fat || 0) * 10) / 10,
    carbs: Math.round((item.carbs || 0) * 10) / 10,
    source: 'vision',
  }));

  return {
    items,
    meal_type: data.meal_type || 'lunch',
    description: data.description || items.map(i => i.name).join(', '),
    confidence: items.length > 0 ? 0.7 : 0,
  };
}

/**
 * Быстрый подсчёт калорий из фото (без деталей).
 * Дешевле — один ответ одним числом.
 */
export async function quickCaloriesFromPhoto(imageBase64) {
  const result = await callAIVision({
    imageBase64: stripBase64Prefix(imageBase64),
    prompt: `Сколько примерно калорий на этой тарелке?
Ответь ОДНИМ числом (целое число ккал). Ничего кроме числа.`,
    maxTokens: 20,
  });

  const num = parseInt(result.content.trim().replace(/\D/g, ''));
  return isNaN(num) ? null : num;
}
