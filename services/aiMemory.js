import db from '../db/index';

// ═══ AI Memory — долгосрочная память ассистента ═══

export async function getMemories(limit = 30) {
  try {
    return await db.ai_memory
      .orderBy('created_at')
      .reverse()
      .limit(limit)
      .toArray();
  } catch (e) {
    console.error('[aiMemory.getMemories]', e);
    return [];
  }
}

export async function addMemory(category, fact, source = 'user_said') {
  try {
    // Дедупликация: ищем похожий факт
    const existing = await findSimilar(fact);
    if (existing) {
      await db.ai_memory.update(existing.id, {
        fact,
        updated_at: new Date().toISOString(),
      });
      return { id: existing.id, updated: true };
    }

    const now = new Date().toISOString();
    const id = await db.ai_memory.add({
      category,
      fact,
      source,
      importance: 2,
      created_at: now,
      updated_at: now,
    });
    return { id, updated: false };
  } catch (e) {
    console.error('[aiMemory.addMemory]', e);
    throw e;
  }
}

export async function updateMemory(id, fact) {
  try {
    await db.ai_memory.update(id, {
      fact,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[aiMemory.updateMemory]', e);
    throw e;
  }
}

export async function deleteMemory(id) {
  try {
    await db.ai_memory.delete(id);
  } catch (e) {
    console.error('[aiMemory.deleteMemory]', e);
    throw e;
  }
}

export async function searchMemory(query) {
  try {
    const lower = query.toLowerCase();
    const all = await db.ai_memory.toArray();
    return all.filter(m => m.fact.toLowerCase().includes(lower));
  } catch (e) {
    console.error('[aiMemory.searchMemory]', e);
    return [];
  }
}

// Дедупликация: совпадение >60% слов → это тот же факт
async function findSimilar(newFact) {
  const all = await db.ai_memory.toArray();
  const newWords = extractWords(newFact);
  if (newWords.length === 0) return null;

  for (const m of all) {
    const oldWords = extractWords(m.fact);
    if (oldWords.length === 0) continue;
    const common = newWords.filter(w => oldWords.includes(w)).length;
    const similarity = common / Math.max(newWords.length, oldWords.length);
    if (similarity > 0.6) return m;
  }
  return null;
}

function extractWords(text) {
  return text.toLowerCase().replace(/[^\wа-яё]/gi, ' ').split(/\s+/).filter(w => w.length > 2);
}
