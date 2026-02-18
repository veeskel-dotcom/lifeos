/**
 * openrouter.js — AI-ассистент через OpenRouter.
 * Модели и тарифы — из utils/constants.js (единый источник правды).
 */
import { fetchWithRetry, requireOnline } from './_shared';
import { MODEL_REGISTRY, COST_RATES } from '../utils/constants';

const FALLBACK_MODEL = MODEL_REGISTRY.parsing;

// In production, calls go through Vercel serverless proxy (no API key in client bundle).
// In dev, falls back to direct OpenRouter calls if VITE_OPENROUTER_API_KEY is set.
const PROXY_URL = '/api/proxy/openrouter';
const DIRECT_URL = 'https://openrouter.ai/api/v1/chat/completions';

const isDev = import.meta.env.DEV;
const API_URL = isDev && import.meta.env.VITE_OPENROUTER_API_KEY ? DIRECT_URL : PROXY_URL;

/* ─── Helpers ─── */

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };

  // In dev mode with direct API calls, include the API key
  if (isDev && import.meta.env.VITE_OPENROUTER_API_KEY) {
    headers['Authorization'] = `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`;
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'LifeOS';
  }

  return headers;
}

function estimateCost(model, usage) {
  const r = COST_RATES[model] || COST_RATES[FALLBACK_MODEL] || { input: 0.15, output: 0.60 };
  return (usage.prompt_tokens * r.input + usage.completion_tokens * r.output) / 1_000_000;
}

/* ─── Chat Completion ─── */

export async function chatCompletion({
  messages,
  model,
  maxTokens = 1000,
  temperature = 0.3,
}) {
  requireOnline();

  const actualModel = model || FALLBACK_MODEL;

  const body = {
    model: actualModel,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  try {
    const data = await fetchWithRetry(API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    }, { retries: 0, timeoutMs: 30000 });

    const content = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
    const costUsd = estimateCost(actualModel, usage);

    return { content, model: data.model || actualModel, usage, cost_usd: costUsd };
  } catch (e) {
    // Fallback к Flash если основная модель упала
    if (actualModel !== FALLBACK_MODEL) {
      console.warn(`[AI] ${actualModel} failed, trying fallback:`, e.message);
      return chatCompletion({ messages, model: FALLBACK_MODEL, maxTokens, temperature });
    }
    throw new Error('AI недоступен: ' + e.message);
  }
}

/* ─── Stream Completion ─── */

export async function streamCompletion({
  messages,
  model,
  maxTokens = 1000,
  temperature = 0.3,
  onChunk,
}) {
  requireOnline();

  const actualModel = model || FALLBACK_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  const body = {
    model: actualModel,
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: true,
  };

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            onChunk?.(delta);
          }
        } catch {}
      }
    }

    const approxUsage = {
      prompt_tokens: Math.ceil(messages.reduce((s, m) => s + (m.content?.length || 0), 0) / 4),
      completion_tokens: Math.ceil(fullContent.length / 4),
    };
    const costUsd = estimateCost(actualModel, approxUsage);

    return { content: fullContent, model: actualModel, usage: approxUsage, cost_usd: costUsd };
  } catch (e) {
    if (actualModel !== FALLBACK_MODEL) {
      console.warn(`[AI] Stream ${actualModel} failed, trying fallback:`, e.message);
      return streamCompletion({ messages, model: FALLBACK_MODEL, maxTokens, temperature, onChunk });
    }
    throw new Error('AI недоступен: ' + e.message);
  } finally {
    clearTimeout(timer);
  }
}
