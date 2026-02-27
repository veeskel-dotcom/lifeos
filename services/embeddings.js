/**
 * embeddings.js — Vector embedding service for AI Memory v2.
 * Handles: embed, embedBatch, cosine similarity, embedding cache, relevant memory retrieval.
 */
import db from '../db/index';

// ═══ Config ═══
const EMBEDDING_MODEL = 'baai/bge-m3'; // 1024 dims, multilingual
const EMBEDDING_DIMS = 1024;
const BATCH_SIZE = 100; // max texts per API call
const EMBED_TIMEOUT_MS = 5000;

// ═══ API URL ═══
const isDev = import.meta.env.DEV;
const PROXY_URL = '/api/proxy/openrouter';
const DIRECT_URL = 'https://openrouter.ai/api/v1/embeddings';
const API_URL = isDev && import.meta.env.VITE_OPENROUTER_API_KEY ? DIRECT_URL : PROXY_URL;

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (isDev && import.meta.env.VITE_OPENROUTER_API_KEY) {
    headers['Authorization'] = `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`;
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'LifeOS';
  }
  return headers;
}

// ═══ Embed single text ═══
export async function embed(text) {
  if (!text || !navigator.onLine) return null;
  const trimmed = text.slice(0, 500); // cap input length

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: trimmed }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error('[embed] API error:', res.status);
      return null;
    }

    const data = await res.json();
    return data?.data?.[0]?.embedding || null;
  } catch (e) {
    if (e.name === 'AbortError') console.warn('[embed] timeout');
    else console.error('[embed]', e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ═══ Embed batch of texts (chunks of BATCH_SIZE) ═══
export async function embedBatch(texts) {
  if (!Array.isArray(texts) || !texts.length) return [];
  if (!navigator.onLine) return texts.map(() => null);

  const results = new Array(texts.length).fill(null);

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const chunk = texts.slice(i, i + BATCH_SIZE).map(t => (t || '').slice(0, 500).trim() || 'empty');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS * 3); // 15s for batch

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: chunk }),
        signal: controller.signal,
      });

      if (!res.ok) {
        console.error('[embedBatch] API error:', res.status);
        continue;
      }

      const data = await res.json();
      const embeddings = data?.data || [];
      for (const item of embeddings) {
        if (item?.embedding && item.index !== undefined) {
          results[i + item.index] = item.embedding;
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') console.warn('[embedBatch] chunk timeout');
      else console.error('[embedBatch] chunk error:', e.message);
    } finally {
      clearTimeout(timer);
    }
  }

  return results;
}

// ═══ Cosine Similarity ═══
export function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

// ═══ Embedding Cache (A2) — in-memory, loaded once ═══
let embeddingCache = null;
let cacheLoadPromise = null;

export async function getEmbeddingCache() {
  if (embeddingCache) return embeddingCache;
  if (cacheLoadPromise) return cacheLoadPromise;
  cacheLoadPromise = db.ai_memory.toArray().then(all => {
    embeddingCache = all.map(f => ({
      id: f.id,
      fact: f.fact,
      category: f.category,
      embedding: f.embedding || null,
      created_at: f.created_at,
    }));
    cacheLoadPromise = null;
    return embeddingCache;
  }).catch(e => {
    cacheLoadPromise = null;
    throw e;
  });
  return cacheLoadPromise;
}

export function cacheAdd(entry) {
  embeddingCache?.push(entry);
}

export function cacheUpdate(id, fields) {
  if (!embeddingCache) return;
  const idx = embeddingCache.findIndex(e => e.id === id);
  if (idx >= 0) Object.assign(embeddingCache[idx], fields);
}

export function cacheDelete(id) {
  if (!embeddingCache) return;
  const idx = embeddingCache.findIndex(e => e.id === id);
  if (idx >= 0) embeddingCache.splice(idx, 1);
}

// Reset cache (for clearHistory)
export function cacheReset() {
  embeddingCache = null;
  cacheLoadPromise = null;
}

// ═══ Relevant Memory Retrieval (A4) ═══
export async function getRelevantMemories(query, limit = 15) {
  const cache = await getEmbeddingCache();
  if (!cache.length) return [];

  const withEmbeddings = cache.filter(f => f.embedding);

  // Try vector search if we have a query and embeddings exist
  if (query && withEmbeddings.length > 0) {
    // Embed query with 1s timeout (parallel with other DB reads in collectContext)
    const queryVector = await Promise.race([
      embed(query),
      new Promise(resolve => setTimeout(() => resolve(null), 1000)),
    ]);

    if (queryVector) {
      // Score all embedded facts
      const scored = withEmbeddings.map(f => ({
        ...f,
        score: cosineSim(queryVector, f.embedding),
      }));
      scored.sort((a, b) => b.score - a.score);

      // Include unembedded facts (fresh, not yet reconciled)
      const unembedded = cache.filter(f => !f.embedding).slice(0, 5);
      const topScored = scored.slice(0, Math.max(1, limit - unembedded.length));

      return [...topScored, ...unembedded].slice(0, limit);
    }
  }

  // Fallback: date-based (embed failed, timeout, offline, or no embeddings)
  const sorted = [...cache].sort((a, b) =>
    (b.created_at || '').localeCompare(a.created_at || '')
  );
  return sorted.slice(0, limit);
}

// ═══ Offline Reconciliation (A7) ═══
let isReconciling = false;

export async function reconcileOfflineFacts() {
  if (!navigator.onLine || isReconciling) return;

  const cache = await getEmbeddingCache();
  const unembedded = cache.filter(f => !f.embedding);
  if (!unembedded.length) return;

  console.log(`[embeddings] Reconciling ${unembedded.length} unembedded facts...`);
  isReconciling = true;

  try {
  // 1. Batch embed in chunks
  const texts = unembedded.map(f => f.fact);
  const embeddings = await embedBatch(texts);

  // 2. Save embeddings to DB + update cache
  for (let i = 0; i < unembedded.length; i++) {
    if (!embeddings[i]) continue;
    await db.ai_memory.update(unembedded[i].id, { embedding: embeddings[i] });
    cacheUpdate(unembedded[i].id, { embedding: embeddings[i] });
  }

  // 3. Sequential dedup — each sees result of previous, throttled 1 sec
  // Pass skipEmbed=true since we already batch-embedded above
  const { reconcileFact } = await import('./aiMemory');
  for (const fact of unembedded) {
    const cached = cache.find(e => e.id === fact.id);
    if (!cached?.embedding) continue;
    await reconcileFact(fact.id, fact.fact, fact.category, cached.embedding);
    await new Promise(r => setTimeout(r, 1000)); // throttle: don't saturate rate limit
  }

  console.log(`[embeddings] Reconciliation done`);
  } finally {
    isReconciling = false;
  }
}

// ═══ Migration: embed existing facts on first launch (A8) ═══
export async function migrateExistingFacts() {
  if (!navigator.onLine) return;

  const cache = await getEmbeddingCache();
  const unembedded = cache.filter(f => !f.embedding);

  if (unembedded.length === 0) return;

  console.log(`[migration] Embedding ${unembedded.length} existing facts...`);
  const start = Date.now();

  await reconcileOfflineFacts();

  console.log(`[migration] Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

export { EMBEDDING_DIMS };
