/**
 * openrouter.js — AI-ассистент через OpenRouter.
 * Каскад: Claude Sonnet → Gemini Flash.
 * Rate limiting + cost tracking в IndexedDB.
 */
import { fetchWithRetry, requireOnline } from './_shared';

const MODELS = {
  primary: 'anthropic/claude-sonnet-4-20250514',
  fallback: 'google/gemini-2.5-flash-preview',
};

const COST_RATES = {
  'anthropic/claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'google/gemini-2.5-flash-preview': { input: 0.15, output: 0.60 },
};

const LIMITS = {
  cooldown_ms: 1000,
  daily_calls: 60,
  daily_cost_usd: 0.50,
  monthly_cost_usd: 10.00,
};

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

let lastCallTime = 0;

/* ─── Helpers ─── */

function getHeaders() {
  const key = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!key) throw new Error('VITE_OPENROUTER_API_KEY не задан');
  return {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': window.location.origin,
    'X-Title': 'LifeOS',
  };
}

function estimateCost(model, usage) {
  const r = COST_RATES[model] || COST_RATES[MODELS.primary];
  return (usage.prompt_tokens * r.input + usage.completion_tokens * r.output) / 1_000_000;
}

/* ─── Rate Limiting ─── */

async function getRateLimitState() {
  try {
    const { default: db } = await import('../db/index');
    const today = new Date().toISOString().split('T')[0];
    const month = today.slice(0, 7);

    const callsToday = (await db.settings.get('ai_calls_today'))?.value || 0;
    const callsDate = (await db.settings.get('ai_calls_date'))?.value || '';
    const costToday = (await db.settings.get('ai_cost_today'))?.value || 0;
    const costMonth = (await db.settings.get('ai_cost_month'))?.value || 0;
    const costMonthKey = (await db.settings.get('ai_cost_month_key'))?.value || '';

    // Сброс daily
    const dailyCalls = callsDate === today ? callsToday : 0;
    const dailyCost = callsDate === today ? costToday : 0;
    // Сброс monthly
    const monthlyCost = costMonthKey === month ? costMonth : 0;

    return { dailyCalls, dailyCost, monthlyCost, today, month };
  } catch {
    return { dailyCalls: 0, dailyCost: 0, monthlyCost: 0, today: '', month: '' };
  }
}

async function checkRateLimit() {
  // Cooldown
  const now = Date.now();
  if (now - lastCallTime < LIMITS.cooldown_ms) {
    const wait = LIMITS.cooldown_ms - (now - lastCallTime);
    await new Promise(r => setTimeout(r, wait));
  }
  lastCallTime = Date.now();

  const state = await getRateLimitState();
  if (state.dailyCalls >= LIMITS.daily_calls) {
    throw new Error('Достигнут дневной лимит AI-вызовов');
  }
  if (state.dailyCost >= LIMITS.daily_cost_usd) {
    throw new Error('Достигнут дневной лимит расходов на AI');
  }
  if (state.monthlyCost >= LIMITS.monthly_cost_usd) {
    throw new Error('Достигнут месячный лимит расходов на AI');
  }
}

async function trackUsage(costUsd) {
  try {
    const { default: db } = await import('../db/index');
    const today = new Date().toISOString().split('T')[0];
    const month = today.slice(0, 7);

    const state = await getRateLimitState();
    await db.settings.bulkPut([
      { key: 'ai_calls_today', value: state.dailyCalls + 1 },
      { key: 'ai_calls_date', value: today },
      { key: 'ai_cost_today', value: +(state.dailyCost + costUsd).toFixed(6) },
      { key: 'ai_cost_month', value: +(state.monthlyCost + costUsd).toFixed(6) },
      { key: 'ai_cost_month_key', value: month },
    ]);
  } catch {}
}

/* ─── Chat Completion ─── */

export async function chatCompletion({
  messages,
  model = MODELS.primary,
  maxTokens = 1000,
  temperature = 0.3,
}) {
  requireOnline();
  await checkRateLimit();

  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  try {
    const data = await fetchWithRetry(API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    }, { retries: 0, timeoutMs: 10000 });

    const content = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
    const costUsd = estimateCost(model, usage);

    await trackUsage(costUsd);

    return { content, model: data.model || model, usage, cost_usd: costUsd };
  } catch (e) {
    // Fallback к другой модели
    if (model === MODELS.primary) {
      console.warn('[AI] Primary failed, trying fallback:', e.message);
      return chatCompletion({ messages, model: MODELS.fallback, maxTokens, temperature });
    }
    throw new Error('AI недоступен: ' + e.message);
  }
}

/* ─── Stream Completion ─── */

export async function streamCompletion({
  messages,
  model = MODELS.primary,
  maxTokens = 1000,
  temperature = 0.3,
  onChunk,
}) {
  requireOnline();
  await checkRateLimit();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  const body = {
    model,
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

    // Примерный подсчёт токенов для стриминга
    const approxUsage = {
      prompt_tokens: Math.ceil(messages.reduce((s, m) => s + (m.content?.length || 0), 0) / 4),
      completion_tokens: Math.ceil(fullContent.length / 4),
    };
    const costUsd = estimateCost(model, approxUsage);
    await trackUsage(costUsd);

    return { content: fullContent, model, usage: approxUsage, cost_usd: costUsd };
  } catch (e) {
    if (model === MODELS.primary) {
      console.warn('[AI] Stream primary failed, trying fallback:', e.message);
      return streamCompletion({ messages, model: MODELS.fallback, maxTokens, temperature, onChunk });
    }
    throw new Error('AI недоступен: ' + e.message);
  } finally {
    clearTimeout(timer);
  }
}

export { MODELS, LIMITS };
