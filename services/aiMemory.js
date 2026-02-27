import db from '../db/index';
import { embed, cosineSim, getEmbeddingCache, cacheAdd, cacheUpdate, cacheDelete, cacheReset } from './embeddings';

// ═══ AI Memory v2 — долгосрочная память ассистента ═══
// Two-phase addMemory (A1): Phase A sync (word overlap, 50ms) → Phase B async (vector + LLM)

// Async mutex for addMemory — queues callers instead of dropping them
let addLockPromise = Promise.resolve();

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

export function addMemory(category, fact, source = 'user_said') {
  // Chain on the mutex — each call waits for the previous to finish (no drops)
  const result = addLockPromise.then(() => _addMemoryImpl(category, fact, source));
  addLockPromise = result.catch(() => {}); // keep chain alive on error
  return result;
}

async function _addMemoryImpl(category, fact, source) {
  try {
    // Guard: empty or too long facts
    if (!fact || fact.trim().length < 3) return { id: null, updated: false, skipped: true };
    fact = fact.slice(0, 200).trim(); // truncate to 200 chars

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

export async function reconcileFact(factId, factText, category, precomputedVector = null) {
  // 0. Re-read from DB to get fresh text (Phase A may have updated it since enqueue)
  const fresh = await db.ai_memory.get(factId);
  if (!fresh) return; // record was deleted while queued
  factText = fresh.fact;
  category = fresh.category;

  // 1. Embed the new fact (skip if pre-computed, e.g. from batch reconciliation)
  const vector = precomputedVector || await embed(factText);
  if (!vector) return; // offline or API error

  // 2. Save embedding to DB + update cache (skip if pre-computed — already saved)
  if (!precomputedVector) {
    await db.ai_memory.update(factId, { embedding: vector });
    cacheUpdate(factId, { embedding: vector });
  }

  // 3. Cosine search, EXCLUDING self
  const cache = await getEmbeddingCache();
  const candidates = cache
    .filter(e => e.id !== factId && e.embedding)
    .map(e => ({ ...e, score: cosineSim(vector, e.embedding) }))
    .filter(e => e.score > 0.65)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (!candidates.length) return; // no similar facts → ADD (keep as is)

  // 4. LLM decision
  try {
    const sanitize = (s) => s.replace(/"/g, "'").replace(/\n/g, ' ');
    const { callAI } = await import('../ai/client');
    const result = await callAI({
      prompt: `Сравни два факта о пользователе. Новый: "${sanitize(factText)}". Существующий: "${sanitize(candidates[0].fact)}".
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
    const maxLen = Math.max(newWords.length, oldWords.length);
    const similarity = common / maxLen;
    // Require 0.75 overlap AND at least 3 common words to avoid false merges on short facts
    if (similarity > 0.75 && common >= 3 && similarity > bestScore) {
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
    // Use cache (lightweight, no embeddings in iteration) instead of full DB load
    const cache = await getEmbeddingCache();
    const now = Date.now();
    const toDelete = [];

    for (const fact of cache) {
      const maxDays = EXPIRY_DAYS[fact.category];
      if (!maxDays) continue; // permanent categories
      const refDate = fact.created_at; // cache has created_at
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

// ═══ LLM Fact Extraction (Phase 2) — для L3+ сообщений ═══

const EXTRACT_FACTS_PROMPT = `Извлеки ДОЛГОСРОЧНЫЕ факты о пользователе из сообщения.
Игнорируй транзиентное (настроение момента, разовые жалобы, погода, конкретные суммы разовых покупок).
Категории: preference, habit, health, finance, lifestyle, goal, event, decision
JSON массив: [{"cat":"...","fact":"..."}]. Пустой [] если нет фактов.
Максимум 5 фактов. Формулируй кратко (до 100 символов на факт). Русский.`;

export async function extractFactsLLM(text) {
  if (!text || text.length < 10 || !navigator.onLine) return;

  try {
    const { callAI } = await import('../ai/client');
    const result = await callAI({
      prompt: `${EXTRACT_FACTS_PROMPT}\n\nСообщение: "${text.slice(0, 500)}"`,
      model: 'parsing',
      maxTokens: 300,
      temperature: 0.1,
    });

    const content = (result.content || '').trim();
    // Parse JSON array — handle markdown code blocks + extract array from any wrapping
    let jsonStr = content.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    // Extract first JSON array if wrapped in text
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) jsonStr = arrayMatch[0];
    let facts;
    try {
      facts = JSON.parse(jsonStr);
    } catch {
      return; // AI didn't return valid JSON
    }

    if (!Array.isArray(facts) || facts.length === 0) return;

    for (const { cat, fact } of facts.slice(0, 5)) {
      if (!fact || fact.length < 3 || fact.length > 200) continue;
      const category = cat || 'lifestyle';
      try {
        await addMemory(category, fact, 'llm_extracted');
      } catch { /* dedup will handle conflicts */ }
    }
  } catch (e) {
    console.error('[extractFactsLLM]', e.message);
  }
}
