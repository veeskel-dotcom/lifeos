import db from '../db/index';

/**
 * corrections.js — хранение коррекций AI.
 * Когда пользователь нажимает «Исправить» → запись сохраняется.
 * При следующем похожем вводе — применяется коррекция вместо AI.
 * Таблица: ai_corrections '++id, original_input, created_at'
 */

// ═══ Сохранить коррекцию ═══
export async function saveCorrection(originalInput, originalResult, correctedAction, correctedParams) {
  await db.ai_corrections.add({
    original_input: originalInput.toLowerCase().trim(),
    original_action: originalResult?.action || null,
    original_params: originalResult?.params || null,
    corrected_action: correctedAction,
    corrected_params: correctedParams,
    created_at: new Date().toISOString(),
  });
}

// ═══ Найти коррекцию для ввода ═══
export async function findCorrection(input) {
  const normalized = input.toLowerCase().trim();

  // Загружаем все коррекции (обычно < 50 штук)
  const all = await db.ai_corrections
    .orderBy('created_at')
    .reverse()
    .limit(100)
    .toArray();

  if (all.length === 0) return null;

  // Точное совпадение (самая свежая)
  const exact = all.find(c => c.original_input === normalized);
  if (exact) return exact;

  // Нечёткое: сходство > 80%
  const firstWord = normalized.split(/\s+/)[0];
  if (firstWord.length < 3) return null;

  const similar = all.find(c => {
    if (!c.original_input?.startsWith(firstWord)) return false;
    return similarity(normalized, c.original_input) > 0.8;
  });

  return similar || null;
}

// ═══ Получить все коррекции (для Settings → AI) ═══
export async function getAllCorrections() {
  return db.ai_corrections
    .orderBy('created_at')
    .reverse()
    .limit(50)
    .toArray();
}

// ═══ Удалить коррекцию ═══
export async function deleteCorrection(id) {
  await db.ai_corrections.delete(id);
}

// ═══ Очистить все коррекции ═══
export async function clearCorrections() {
  await db.ai_corrections.clear();
}

// ═══ Простое сходство строк (Dice coefficient) ═══
function similarity(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const bi = a.slice(i, i + 2);
    bigrams.set(bi, (bigrams.get(bi) || 0) + 1);
  }

  let matches = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bi = b.slice(i, i + 2);
    const count = bigrams.get(bi) || 0;
    if (count > 0) {
      bigrams.set(bi, count - 1);
      matches++;
    }
  }

  return (2 * matches) / (a.length + b.length - 2);
}
