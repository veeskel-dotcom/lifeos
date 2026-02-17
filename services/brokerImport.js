/**
 * brokerImport.js — E9: Импорт позиций брокера из скрина или текста.
 *
 * Поддерживает:
 * - Скриншот приложения брокера (Тинькофф, БКС, Freedom, Interactive Brokers)
 * - Копипаста текста из брокерского отчёта
 * - Текстовое описание «у меня 10 акций Сбера по 260»
 *
 * Результат: массив позиций для portfolio таблицы.
 */

import { callAIVision, callAI } from '../ai/client';
import db from '../db/index';

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

const POSITION_PROMPT = `Извлеки позиции инвестиционного портфеля. Верни JSON массив:
[
  {
    "ticker": "SBER",
    "name": "Сбербанк",
    "quantity": 10,
    "avg_price": 260.50,
    "current_price": 275.30,
    "currency": "RUB",
    "broker": "Тинькофф",
    "type": "stock|bond|etf|fund|currency"
  }
]

Правила:
- ticker: MOEX тикер если российский (SBER, GAZP, LKOH, YNDX), иначе NYSE/NASDAQ
- Если тикер неизвестен — используй название латиницей
- currency: RUB для российских, USD для американских, KZT для казахстанских
- type: stock для акций, bond для облигаций, etf для ETF/БПИФ, fund для фондов
- Если avg_price неизвестна — поставь null
- Если quantity дробное (для фондов) — используй float
- broker: определи по интерфейсу (Тинькофф/БКС/Freedom/IB/другой)
- Только JSON, ничего больше`;

// ═══ Импорт из скриншота ═══

/**
 * Скриншот приложения брокера → массив позиций.
 * @param {string} imageBase64
 * @returns {{ positions: Array, broker: string, source: 'screenshot' }}
 */
export async function importFromScreenshot(imageBase64) {
  const result = await callAIVision({
    imageBase64: stripBase64Prefix(imageBase64),
    prompt: POSITION_PROMPT,
    maxTokens: 2000,
  });

  const positions = parseJSON(result.content);
  if (!Array.isArray(positions)) {
    throw new Error('AI вернул не массив');
  }

  const normalized = positions.map(normalizePosition);
  const broker = normalized[0]?.broker || 'Неизвестный';

  return { positions: normalized, broker, source: 'screenshot' };
}

// ═══ Импорт из текста ═══

/**
 * Текст (копипаста из отчёта или описание) → массив позиций.
 * @param {string} text - текст отчёта или описание
 * @returns {{ positions: Array, broker: string, source: 'text' }}
 */
export async function importFromText(text) {
  if (!text?.trim()) throw new Error('Пустой текст');

  const result = await callAI({
    prompt: `${text}\n\n${POSITION_PROMPT}`,
    model: 'fast',
    maxTokens: 2000,
    temperature: 0.1,
  });

  const positions = parseJSON(result.content);
  if (!Array.isArray(positions)) {
    throw new Error('AI вернул не массив');
  }

  const normalized = positions.map(normalizePosition);
  const broker = normalized[0]?.broker || 'Неизвестный';

  return { positions: normalized, broker, source: 'text' };
}

// ═══ Нормализация ═══

function normalizePosition(p) {
  return {
    ticker: (p.ticker || '').toUpperCase().trim(),
    name: p.name || p.ticker || '',
    quantity: typeof p.quantity === 'number' ? p.quantity : parseFloat(p.quantity) || 0,
    avg_price: p.avg_price != null ? parseFloat(p.avg_price) : null,
    current_price: p.current_price != null ? parseFloat(p.current_price) : null,
    currency: (p.currency || 'RUB').toUpperCase(),
    broker: p.broker || null,
    type: ['stock', 'bond', 'etf', 'fund', 'currency'].includes(p.type) ? p.type : 'stock',
  };
}

// ═══ Сохранение в БД ═══

/**
 * Сохранить импортированные позиции в portfolio.
 * Если позиция с таким тикером+брокером уже есть — обновить.
 * @param {Array} positions
 * @param {string} broker
 * @returns {{ added: number, updated: number, skipped: number }}
 */
export async function saveImportedPositions(positions, broker) {
  const stats = { added: 0, updated: 0, skipped: 0 };

  for (const pos of positions) {
    if (!pos.ticker || pos.quantity <= 0) {
      stats.skipped++;
      continue;
    }

    try {
      // Проверяем есть ли уже
      const existing = await db.portfolio
        .where('ticker').equals(pos.ticker)
        .filter(p => p.broker === (pos.broker || broker))
        .first();

      const record = {
        ticker: pos.ticker,
        name: pos.name,
        quantity: pos.quantity,
        avg_price: pos.avg_price,
        current_price: pos.current_price,
        currency: pos.currency,
        broker: pos.broker || broker,
        type: pos.type,
        imported_at: new Date().toISOString(),
        source: 'import',
      };

      if (existing) {
        await db.portfolio.update(existing.id, record);
        stats.updated++;
      } else {
        await db.portfolio.add(record);
        stats.added++;
      }
    } catch {
      stats.skipped++;
    }
  }

  return stats;
}
