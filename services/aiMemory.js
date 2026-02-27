import db from '../db/index';
import { embed, cosineSim, getEmbeddingCache, cacheAdd, cacheUpdate, cacheDelete, cacheReset } from './embeddings';

// ═══ AI Memory v2 — долгосрочная память ассистента ═══
// Two-phase addMemory (A1): Phase A sync (word overlap, 50ms) → Phase B async (vector + LLM)

let addLock = false;

// ═══ Read ═══

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

// ═══ Phase A: Sync addMemory (~50ms) ═══

export async function addMemory(category, fact, source = 'user_said') {
  if (addLock) {
    await new Promise(r => setTimeout(r, 100));
    if (addLock) return { id: null, updated: false, skipped: true };
  }
  addLock = true;

  try {
    // Word overlap dedup (Phase A) — catches exact duplicates
    const existing = await findSimilar(fact);
    if (existing) {
      await db.ai_memory.update(existing.id, {
        fact,
        category,
        updated_at: new Date().toISOString(),
      });
      cacheUpdate(existing.id, { fact, category });
      return { id: existing.id, updated: true };
    }

    const now = new Date().toISOString();
    const record = {
      category,
      fact,
      source,
      importance: 2,
      created_at: now,
      updated_at: now,
      embedding: null,
    };
    const id = await db.ai_memory.add(record);

    // Update cache
    cacheAdd({ id, fact, category, embedding: null, created_at: now });

    // Soft cap 2000: category-based expiry
    const total = await db.ai_memory.count();
    if (total > 2000) {
      await evictExpiredFacts();
    }

    // Phase B: async vector dedup (fire-and-forget)
    if (navigator.onLine) {
      enqueueReconcile(id, fact, category);
    }

    return { id, updated: false };
  } catch (e) {
    console.error('[aiMemory.addMemory]', e);
    throw e;
  } finally {
    addLock = false;
  }
}

// ═══ Phase B: Async Reconcile Queue (A1) ═══

const reconcileQueue = [];
let isReconciling = false;

function enqueueReconcile(factId, fact, category) {
  reconcileQueue.push({ factId, fact, category });
  if (!isReconciling) processQueue();
}

async function processQueue() {
  isReconciling = true;
  while (reconcileQueue.length > 0) {
    const task = reconcileQueue.shift();
    try {
      await reconcileFact(task.factId, task.fact, task.category);
    } catch (e) {
      console.error('[reconcileQueue]', e);
    }
  }
  isReconciling = false;
}

// ═══ reconcileFact — embed + cosine + LLM decision ═══

export async function reconcileFact(factId, factText, category) {
  // 1. Embed the new fact
  const vector = await embed(factText);
  if (!vector) return; // offline or API error

  // 2. Save embedding to DB + update cache
  await db.ai_memory.update(factId, { embedding: vector });
  cacheUpdate(factId, { embedding: vector });

  // 3. Cosine search, EXCLUDING self
  const cache = await getEmbeddingCache();
  const candidates = cache
    .filter(e => e.id !== factId && e.embedding)
    .map(e => ({ ...e, score: cosineSim(vector, e.embedding) }))
    .filter(e => e.score > 0.85)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (!candidates.length) return; // no similar facts → ADD (keep as is)

  // 4. LLM decision
  try {
    const { callAI } = await import('../ai/client');
    const result = await callAI({
      prompt: `Сравни два факта о пользователе. Новый: "${factText}". Существующий: "${candidates[0].fact}".
Ответь ОДНИМ словом:
- UPDATE — если новый факт обновляет/уточняет существующий (merge)
- DELETE — если новый факт устарел или противоречит существующему
- NOOP — если это один и тот же факт (дубликат)
- ADD — если это разные факты (оба нужны)`,
      model: 'parsing',
      maxTokens: 10,
      temperature: 0,
    });

    const decision = (result.content || '').trim().toUpperCase();
    console.log(`[reconcile] "${factText}" vs "${candidates[0].fact}" → ${decision} (score: ${candidates[0].score.toFixed(3)})`);

    if (decision === 'UPDATE') {
      // Merge: update existing fact with new text, delete new fact
      await db.ai_memory.update(candidates[0].id, {
        fact: factText,
        embedding: vector,
        updated_at: new Date().toISOString(),
      });
      await db.ai_memory.delete(factId);
      cacheUpdate(candidates[0].id, { fact: factText, embedding: vector });
      cacheDelete(factId);
    } else if (decision === 'DELETE' || decision === 'NOOP') {
      // Remove the new duplicate/outdated fact
      await db.ai_memory.delete(factId);
      cacheDelete(factId);
    }
    // ADD → keep both, do nothing
  } catch (e) {
    console.error('[reconcileFact] LLM decision failed, keeping fact (safe default):', e.message);
    // Safe default: keep the fact (ADD)
  }
}

// ═══ Update / Delete / Search ═══

export async function updateMemory(id, fact) {
  try {
    await db.ai_memory.update(id, {
      fact,
      updated_at: new Date().toISOString(),
      embedding: null, // will be re-embedded on next reconcile
    });
    cacheUpdate(id, { fact, embedding: null });
  } catch (e) {
    console.error('[aiMemory.updateMemory]', e);
    throw e;
  }
}

export async function deleteMemory(id) {
  try {
    await db.ai_memory.delete(id);
    cacheDelete(id);
  } catch (e) {
    console.error('[aiMemory.deleteMemory]', e);
    throw e;
  }
}

export async function searchMemory(query) {
  try {
    const cache = await getEmbeddingCache();

    // Try vector search first
    if (navigator.onLine && cache.some(f => f.embedding)) {
      const queryVector = await embed(query);
      if (queryVector) {
        return cache
          .filter(f => f.embedding)
          .map(f => ({ ...f, score: cosineSim(queryVector, f.embedding) }))
          .filter(f => f.score > 0.3)
          .sort((a, b) => b.score - a.score)
          .slice(0, 20);
      }
    }

    // Fallback: substring match
    const lower = query.toLowerCase();
    return cache.filter(m => m.fact.toLowerCase().includes(lower));
  } catch (e) {
    console.error('[aiMemory.searchMemory]', e);
    return [];
  }
}

// ═══ Word overlap dedup (Phase A fast path) ═══

async function findSimilar(newFact) {
  const cache = await getEmbeddingCache();
  const newWords = extractWords(newFact);
  if (newWords.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const m of cache) {
    const oldWords = extractWords(m.fact);
    if (oldWords.length === 0) continue;
    const common = newWords.filter(w => oldWords.includes(w)).length;
    const similarity = common / Math.max(newWords.length, oldWords.length);
    if (similarity > 0.6 && similarity > bestScore) {
      bestMatch = m;
      bestScore = similarity;
    }
  }
  return bestMatch;
}

function extractWords(text) {
  return text.toLowerCase().replace(/[^a-zа-яё0-9]/gi, ' ').split(/\s+/).filter(w => w.length > 2);
}

// ═══ Category-based expiry (Kai pattern) ═══
const EXPIRY_DAYS = { event: 90, decision: 90, goal: 180, habit: 120 };

async function evictExpiredFacts() {
  try {
    const all = await db.ai_memory.toArray();
    const now = Date.now();
    const toDelete = [];

    for (const fact of all) {
      const maxDays = EXPIRY_DAYS[fact.category];
      if (!maxDays) continue; // permanent categories
      const refDate = fact.updated_at || fact.created_at;
      if (!refDate) continue;
      const ageDays = (now - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > maxDays) toDelete.push(fact.id);
    }

    if (toDelete.length > 0) {
      await db.ai_memory.bulkDelete(toDelete);
      toDelete.forEach(id => cacheDelete(id));
      console.log(`[aiMemory] Evicted ${toDelete.length} expired facts`);
    }

    // If still over 2000 after expiry — remove oldest low-importance facts
    const remaining = await db.ai_memory.count();
    if (remaining > 2000) {
      const excess = remaining - 2000;
      const lowImportance = await db.ai_memory
        .orderBy('created_at')
        .filter(f => (f.importance || 0) < 3)
        .limit(excess)
        .toArray();
      if (lowImportance.length > 0) {
        await db.ai_memory.bulkDelete(lowImportance.map(f => f.id));
        lowImportance.forEach(f => cacheDelete(f.id));
        console.log(`[aiMemory] Evicted ${lowImportance.length} low-importance facts (over 2000 cap)`);
      }
    }
  } catch (e) {
    console.error('[aiMemory.evictExpiredFacts]', e);
  }
}

// ═══ Clear all memory (resets cache too) ═══

export async function clearAllMemory() {
  try {
    await db.ai_memory.clear();
    cacheReset();
  } catch (e) {
    console.error('[aiMemory.clearAllMemory]', e);
  }
}

// ═══ Авто-извлечение фактов из текста ($0, regex) ═══

const FACT_PATTERNS = [
  { re: /я (?:люблю|обожаю)\s+(.+)/i,              cat: 'preference', tpl: 'Любит: $1' },
  { re: /я не (?:люблю|ем|пью|ношу)\s+(.+)/i,      cat: 'preference', tpl: 'Не ест/не пьёт: $1' },
  { re: /мне нравится\s+(.+)/i,                     cat: 'preference', tpl: 'Нравится: $1' },
  { re: /я предпочитаю\s+(.+)/i,                    cat: 'preference', tpl: 'Предпочитает: $1' },
  { re: /(?:у меня )?аллергия на\s+(.+)/i,          cat: 'health',     tpl: 'Аллергия на $1' },
  { re: /мне (\d+)\s+(?:лет|год)/i,                 cat: 'lifestyle',  tpl: 'Возраст: $1' },
  { re: /я (?:работаю|занимаюсь)\s+(.+)/i,          cat: 'lifestyle',  tpl: 'Работа: $1' },
  { re: /(?:моя )?цель[\s:]+(.+)/i,                 cat: 'goal',       tpl: 'Цель: $1' },
  { re: /я (веган|вегетарианец|вегетарианка)/i,      cat: 'health',     tpl: '$1' },
  { re: /я (на диете|худею|набираю массу)/i,         cat: 'health',     tpl: '$1' },
  { re: /я (?:обычно|каждый день|всегда)\s+(.+)/i,  cat: 'habit',      tpl: 'Привычка: $1' },
  { re: /я (?:живу в|из)\s+(.+)/i,                  cat: 'lifestyle',  tpl: 'Живёт в $1' },
  { re: /мой рост\s+(\d+)/i,                        cat: 'health',     tpl: 'Рост: $1 см' },
  { re: /(?:не|никогда не) (?:пью|употребляю) (?:алкоголь|спиртное)/i, cat: 'health', tpl: 'Не пьёт алкоголь' },
  { re: /я (?:не )?курю/i,                          cat: 'health',     tpl: '$0' },
];

export async function extractAndSaveFromText(text) {
  if (!text || text.length < 5 || text.length > 300) return;
  let saved = 0;
  for (const { re, cat, tpl } of FACT_PATTERNS) {
    if (saved >= 2) break;
    const m = text.match(re);
    if (!m) continue;
    const fact = tpl.includes('$1') ? tpl.replace('$1', m[1]?.trim() || '')
      : tpl === '$0' ? m[0].trim()
      : tpl;
    try {
      await addMemory(cat, fact, 'auto_extracted');
      saved++;
    } catch { /* not critical */ }
  }
}
