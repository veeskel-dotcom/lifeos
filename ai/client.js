import { chatCompletion } from '../api/openrouter';
import { trackUsage, checkLimits, getLimitsStatus } from './cost';
import { getSetting } from '../db/helpers';
import { AI_LIMITS } from '../utils/constants';

const COOLDOWN_MS = AI_LIMITS.cooldown_ms;

const MODELS = {
  fast: 'google/gemini-2.5-flash-preview',      // Уровень 3: парсинг (~$0.001)
  smart: 'anthropic/claude-sonnet-4-20250514',   // Уровень 4: анализ (~$0.005)
};

// ═══ Вызвать AI ═══
export async function callAI({
  prompt,
  systemPrompt,
  model = 'fast',
  maxTokens = 500,
  temperature = 0.3,
}) {
  // 1. API ключ — in production the proxy handles it server-side;
  //    in dev we still check for VITE_OPENROUTER_API_KEY
  const isDev = import.meta.env.DEV;
  if (isDev && !import.meta.env.VITE_OPENROUTER_API_KEY) {
    throw new Error('API_KEY_MISSING');
  }

  // 2. Лимиты
  const limits = await checkLimits();
  if (limits.blocked) {
    throw new Error(`LIMIT_REACHED:${limits.reason}`);
  }

  // 3. Cooldown (1с между вызовами)
  const lastCall = await getSetting('ai_last_call_ts');
  if (lastCall && Date.now() - lastCall < COOLDOWN_MS) {
    await new Promise(r => setTimeout(r, COOLDOWN_MS - (Date.now() - lastCall)));
  }

  // 4. Сообщения
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  // 5. Вызов
  try {
    const result = await chatCompletion({
      messages,
      model: MODELS[model] || MODELS.fast,
      maxTokens,
      temperature,
    });

    // 6. Трекинг
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
    // 7. Fallback: smart → fast
    if (model === 'smart' && !err.message?.startsWith('LIMIT_REACHED') && err.message !== 'API_KEY_MISSING') {
      console.warn('Primary model failed, trying fallback:', err.message);
      return callAI({ prompt, systemPrompt, model: 'fast', maxTokens, temperature });
    }
    throw err;
  }
}

// ═══ K3: Streaming AI вызов ═══
export async function callAIStream({
  prompt,
  systemPrompt,
  model = 'fast',
  maxTokens = 800,
  temperature = 0.3,
  onChunk, // (text: string) => void
}) {
  const isDev = import.meta.env.DEV;
  if (isDev && !import.meta.env.VITE_OPENROUTER_API_KEY) throw new Error('API_KEY_MISSING');

  const limits = await checkLimits();
  if (limits.blocked) throw new Error(`LIMIT_REACHED:${limits.reason}`);

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  // In production, use the serverless proxy; in dev, call OpenRouter directly
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
      model: MODELS[model] || MODELS.fast,
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

  await trackUsage({ model: MODELS[model], prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 });
  return full;
}

// ═══ Vision AI (разблокирует A2.2, C1.7, E9, C1.6) ═══

export async function callAIVision({
  imageBase64,
  prompt,
  model = 'fast',
  maxTokens = 1000,
  temperature = 0.2,
  mimeType = 'image/jpeg',
}) {
  const isDev = import.meta.env.DEV;
  if (isDev && !import.meta.env.VITE_OPENROUTER_API_KEY) throw new Error('API_KEY_MISSING');

  const limits = await checkLimits();
  if (limits.blocked) throw new Error(`LIMIT_REACHED:${limits.reason}`);

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
      model: MODELS[model] || MODELS.fast,
      maxTokens,
      temperature,
    });

    return {
      content: result.content,
      model: result.model,
      cost: result.cost_usd || 0,
    };
  } catch (err) {
    if (model === 'fast') {
      // Gemini Flash поддерживает vision, fallback не нужен
      throw err;
    }
    return callAIVision({ imageBase64, prompt, model: 'fast', maxTokens, temperature, mimeType });
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
