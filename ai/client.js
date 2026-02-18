import { chatCompletion } from '../api/openrouter';
import { trackUsage, checkLimits, getLimitsStatus } from './cost';
import { getSetting } from '../db/helpers';
import { AI_LIMITS, MODEL_REGISTRY, LEGACY_MODEL_MAP, COST_RATES } from '../utils/constants';

const COOLDOWN_MS = AI_LIMITS.cooldown_ms;

/**
 * Резолвер модели: taskKey → полный slug.
 * 1. Если содержит '/' — это прямой slug, пропускаем
 * 2. Legacy маппинг: fast→parsing, smart→analysis
 * 3. Пользовательский override из IndexedDB
 * 4. Дефолт из MODEL_REGISTRY
 * 5. Fallback на Flash
 */
async function resolveModel(taskKey) {
  if (!taskKey) return MODEL_REGISTRY.parsing;
  // Прямой slug (содержит '/')
  if (taskKey.includes('/')) return taskKey;
  // Legacy
  const mapped = LEGACY_MODEL_MAP[taskKey] || taskKey;
  // Пользовательский override
  try {
    const overrides = await getSetting('ai_model_overrides');
    if (overrides?.[mapped]) return overrides[mapped];
  } catch {}
  // Дефолт из реестра
  return MODEL_REGISTRY[mapped] || MODEL_REGISTRY.parsing;
}

// ═══ Вызвать AI ═══
export async function callAI({
  prompt,
  systemPrompt,
  model = 'parsing',
  maxTokens = 500,
  temperature = 0.3,
}) {
  const isDev = import.meta.env.DEV;
  if (isDev && !import.meta.env.VITE_OPENROUTER_API_KEY) {
    throw new Error('API_KEY_MISSING');
  }

  const limits = await checkLimits();
  if (limits.blocked) {
    throw new Error(`LIMIT_REACHED:${limits.reason}`);
  }

  const lastCall = await getSetting('ai_last_call_ts');
  if (lastCall && Date.now() - lastCall < COOLDOWN_MS) {
    await new Promise(r => setTimeout(r, COOLDOWN_MS - (Date.now() - lastCall)));
  }

  const resolvedModel = await resolveModel(model);

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  try {
    const result = await chatCompletion({
      messages,
      model: resolvedModel,
      maxTokens,
      temperature,
    });

    await trackUsage({
      model: result.model,
      prompt_tokens: result.usage?.prompt_tokens || 0,
      completion_tokens: result.usage?.completion_tokens || 0,
      cost_usd: result.cost_usd || 0,
    });

    return {
      content: result.content,
      model: result.model,
      cost: result.cost_usd || 0,
    };
  } catch (err) {
    // Fallback: любая модель кроме parsing → retry с parsing (Flash)
    if (model !== 'parsing' && !err.message?.startsWith('LIMIT_REACHED') && err.message !== 'API_KEY_MISSING') {
      console.warn(`[AI] ${resolvedModel} failed, falling back to parsing:`, err.message);
      return callAI({ prompt, systemPrompt, model: 'parsing', maxTokens, temperature });
    }
    throw err;
  }
}

// ═══ K3: Streaming AI вызов ═══
export async function callAIStream({
  prompt,
  systemPrompt,
  model = 'parsing',
  maxTokens = 800,
  temperature = 0.3,
  onChunk, // (text: string) => void
}) {
  const isDev = import.meta.env.DEV;
  if (isDev && !import.meta.env.VITE_OPENROUTER_API_KEY) throw new Error('API_KEY_MISSING');

  const limits = await checkLimits();
  if (limits.blocked) throw new Error(`LIMIT_REACHED:${limits.reason}`);

  const resolvedModel = await resolveModel(model);

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const useDirectApi = isDev && import.meta.env.VITE_OPENROUTER_API_KEY;
  const streamUrl = useDirectApi
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : '/api/proxy/openrouter';

  const headers = { 'Content-Type': 'application/json' };
  if (useDirectApi) {
    headers['Authorization'] = `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`;
    headers['HTTP-Referer'] = window.location.origin;
  }

  const res = await fetch(streamUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: resolvedModel,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    }),
  });

  if (!res.ok) throw new Error(`AI_ERROR:${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      try {
        const json = JSON.parse(line.slice(6));
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) { full += delta; onChunk?.(full); }
      } catch { /* skip */ }
    }
  }

  // Оценка токенов из длины текста (1 токен ≈ 4 символа)
  const estPromptTokens = Math.ceil(messages.reduce((s, m) => s + (typeof m.content === 'string' ? m.content.length : 0), 0) / 4);
  const estCompletionTokens = Math.ceil(full.length / 4);
  const rates = COST_RATES[resolvedModel] || { input: 0.15, output: 0.60 };
  const estCost = (estPromptTokens * rates.input + estCompletionTokens * rates.output) / 1_000_000;
  await trackUsage({ model: resolvedModel, prompt_tokens: estPromptTokens, completion_tokens: estCompletionTokens, cost_usd: estCost });
  return full;
}

// ═══ Vision AI ═══

export async function callAIVision({
  imageBase64,
  prompt,
  model = 'parsing',
  maxTokens = 1000,
  temperature = 0.2,
  mimeType = 'image/jpeg',
}) {
  const isDev = import.meta.env.DEV;
  if (isDev && !import.meta.env.VITE_OPENROUTER_API_KEY) throw new Error('API_KEY_MISSING');

  const limits = await checkLimits();
  if (limits.blocked) throw new Error(`LIMIT_REACHED:${limits.reason}`);

  const resolvedModel = await resolveModel(model);

  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${imageBase64}` },
        },
        { type: 'text', text: prompt },
      ],
    },
  ];

  try {
    const result = await chatCompletion({
      messages,
      model: resolvedModel,
      maxTokens,
      temperature,
    });

    await trackUsage({
      model: result.model,
      prompt_tokens: result.usage?.prompt_tokens || 0,
      completion_tokens: result.usage?.completion_tokens || 0,
      cost_usd: result.cost_usd || 0,
    });

    return {
      content: result.content,
      model: result.model,
      cost: result.cost_usd || 0,
    };
  } catch (err) {
    if (model === 'parsing' && !err.message?.startsWith('LIMIT_REACHED') && err.message !== 'API_KEY_MISSING') {
      throw err;
    }
    if (!err.message?.startsWith('LIMIT_REACHED') && err.message !== 'API_KEY_MISSING') {
      console.warn(`[AI Vision] ${resolvedModel} failed, falling back to parsing:`, err.message);
      return callAIVision({ imageBase64, prompt, model: 'parsing', maxTokens, temperature, mimeType });
    }
    throw err;
  }
}

// ═══ Доступность AI ═══
export async function isAIAvailable() {
  // In production, the proxy handles the key; in dev, check for VITE_ key
  const isDev = import.meta.env.DEV;
  if (isDev && !import.meta.env.VITE_OPENROUTER_API_KEY) {
    return { available: false, reason: 'no_key' };
  }

  const limits = await checkLimits();
  if (limits.blocked) return { available: false, reason: limits.reason };

  if (!navigator.onLine) return { available: false, reason: 'offline' };

  return { available: true };
}

// ═══ Статус для UI (Settings → AI) ═══
export async function getAIStatus() {
  const isDev = import.meta.env.DEV;
  const limits = await getLimitsStatus();
  return {
    // In production the key is on the server, so always true; in dev check env var
    hasKey: isDev ? !!import.meta.env.VITE_OPENROUTER_API_KEY : true,
    online: navigator.onLine,
    ...limits,
  };
}
