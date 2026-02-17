/**
 * ocr.js — OCR чеков, выписок и кредитных документов через AI Vision.
 * Использует callAIVision из ai/client.js (Gemini Flash vision).
 */

import { callAIVision } from '../ai/client';

// ─── Утилиты ────────────────────────────────────────────

/**
 * Безопасный парсинг JSON из ответа модели.
 * Модель может вернуть ```json...``` обёртку.
 */
function parseJSON(text) {
  let cleaned = text.trim();
  // Убираем markdown code block
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Не удалось разобрать ответ AI: ${err.message}`);
  }
}

function imageToBase64(base64) {
  // Strip data URL prefix if present
  return base64.replace(/^data:image\/\w+;base64,/, '');
}

// ─── Парсинг чека ───────────────────────────────────────

/**
 * Фото чека → структурированные данные.
 * @param {string} imageBase64 - base64 изображения
 * @returns {{ store, date, items: [{name, qty, price}], total }}
 */
export async function parseReceipt(imageBase64) {
  const result = await callAIVision({
    imageBase64: imageToBase64(imageBase64),
    prompt: `Извлеки данные из чека. Верни JSON:
{
  "store": "название магазина",
  "date": "YYYY-MM-DD",
  "items": [{"name": "...", "qty": 1, "price": 350}],
  "total": 1250
}
Только JSON, ничего больше.`,
    maxTokens: 1000,
  });

  return parseJSON(result.content);
}

// ─── Парсинг банковской выписки ─────────────────────────

/**
 * Фото банковской выписки → список операций.
 * @param {string} imageBase64
 * @returns {Array<{date, description, amount, type: 'expense'|'income'}>}
 */
export async function parseBankStatement(imageBase64) {
  const result = await callAIVision({
    imageBase64: imageToBase64(imageBase64),
    prompt: `Извлеки операции из банковской выписки. Верни JSON массив:
[
  {"date": "YYYY-MM-DD", "description": "...", "amount": 1500, "type": "expense"},
  {"date": "YYYY-MM-DD", "description": "...", "amount": 50000, "type": "income"}
]
type = "expense" для списаний, "income" для зачислений.
Только JSON, ничего больше.`,
    maxTokens: 2000,
  });

  return parseJSON(result.content);
}

// ─── Авто-определение и парсинг ────────────────────────

/**
 * Авто-определение типа изображения + парсинг.
 * Определяет: чек, банковская выписка/скрин, кредитный документ.
 * @param {string} imageBase64
 * @returns {{ type: 'receipt'|'bank_statement'|'credit_doc'|'unknown', data, raw }}
 */
export async function autoParseImage(imageBase64) {
  const clean = imageToBase64(imageBase64);

  // 1. Определяем тип
  const detect = await callAIVision({
    imageBase64: clean,
    prompt: `Определи тип финансового документа на фото. Ответь одним словом:
- receipt (кассовый чек, товарный чек)
- bank_statement (скриншот банковского приложения, выписка, список операций, остаток)
- credit_doc (кредитный договор, график платежей)
- unknown (не финансовый документ)
Только одно слово, ничего больше.`,
    maxTokens: 10,
  });

  const type = detect.content.trim().toLowerCase().replace(/[^a-z_]/g, '');

  // 2. Парсим по типу
  try {
    switch (type) {
      case 'receipt':
        return { type: 'receipt', data: await parseReceipt(imageBase64) };
      case 'bank_statement':
        return { type: 'bank_statement', data: await parseBankStatement(imageBase64) };
      case 'credit_doc':
        return { type: 'credit_doc', data: await parseCreditDoc(imageBase64) };
      default:
        return { type: 'unknown', data: null };
    }
  } catch (err) {
    return { type, data: null, error: err.message };
  }
}

/**
 * Фото кредитного договора → данные кредита.
 * @param {string} imageBase64
 * @returns {{ name, bank, type, original_amount, interest_rate, monthly_payment, start_date, end_date }}
 */
export async function parseCreditDoc(imageBase64) {
  const result = await callAIVision({
    imageBase64: imageToBase64(imageBase64),
    prompt: `Извлеки данные кредитного договора. Верни JSON:
{
  "name": "краткое название кредита",
  "bank": "название банка",
  "type": "mortgage|consumer|credit_card|auto",
  "original_amount": 5000000,
  "interest_rate": 12.5,
  "monthly_payment": 52000,
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD"
}
Только JSON, ничего больше.`,
    maxTokens: 1000,
  });

  return parseJSON(result.content);
}
