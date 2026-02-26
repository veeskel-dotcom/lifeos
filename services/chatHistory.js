import db from '../db/index';
import { getSetting, setSetting } from '../db/helpers';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 минут

export function generateSessionId() {
  const date = new Date().toISOString().split('T')[0];
  const rand = Math.random().toString(36).slice(2, 5);
  return `sess_${date}_${rand}`;
}

export async function getOrCreateSession(lastMessageTime) {
  try {
    const latest = await db.ai_conversations.orderBy('created_at').reverse().first();

    // Активная сессия в пределах таймаута
    if (lastMessageTime && (Date.now() - lastMessageTime) < SESSION_TIMEOUT_MS) {
      if (latest) return latest;
    }

    // Первый маунт (lastMessageTime === null) — вернуть последнюю сессию если она свежая
    if (!lastMessageTime && latest?.messages?.length > 0) {
      const lastMsg = latest.messages[latest.messages.length - 1];
      const lastTs = lastMsg?.timestamp ? new Date(lastMsg.timestamp).getTime() : 0;
      if (lastTs && (Date.now() - lastTs) < SESSION_TIMEOUT_MS) {
        return latest;
      }
    }

    // Таймаут — сжать предыдущую сессию + merge в running context (фоном)
    // Порог 2: даже "кофе 350" → ответ (2 msg) формирует контекст
    if (latest && latest.messages.length >= 2 && !latest.summary) {
      summarizeAndMerge(latest).catch(() => {});
    }

    const session = {
      session_id: generateSessionId(),
      messages: [],
      summary: null,
      created_at: new Date().toISOString(),
    };
    session.id = await db.ai_conversations.add(session);
    return session;

  } catch (e) {
    console.error('[chatHistory.getOrCreateSession]', e);
    return null;
  }
}

// ═══ Промпты для памяти ═══

const STRUCTURED_SUMMARY_PROMPT = `Создай структурированное резюме разговора.
Формат:
ТЕМЫ: [ключевые темы через запятую]
РЕШЕНИЯ: [что решено/выполнено пользователем]
ОЖИДАЕТ: [что отложено, обещано, нужно сделать]
ФАКТЫ: [ключевые цифры, даты, имена от пользователя]
Максимум 5 строк. Русский. Пустые категории пропусти.
Фокус на действиях и решениях пользователя, не на ответах ассистента.`;

const MERGE_CONTEXT_PROMPT = `Ты — менеджер памяти AI-ассистента. Обнови контекст пользователя.

Формат: Markdown с секциями ## по темам. Внутри — буллеты с фактами.
Пример:
## Ремонт квартиры
- Бюджет: 500к
- Ожидает: выбрать плитку

Правила:
1. Новая тема → новая секция ##
2. Обновлённая тема → обнови существующую секцию (не дублируй)
3. Выполненное → удали из "Ожидает" (или перенеси в историю если важно)
4. При конфликте — новая информация побеждает
5. Повторяющиеся однотипные записи → уплотняй (не "кофе 350, кофе 400, кофе 300" а "Кафе: ~350₸/день, регулярно")
6. Максимум 800 слов
7. Русский. Только факты из входных данных
8. Пустые секции → удали

Верни ТОЛЬКО обновлённый контекст (Markdown). Без пояснений.`;

// ═══ Structured Summary (заменяет старый summarizeSession) ═══

async function summarizeSessionStructured(session) {
  if (!session || session.summary || session.messages.length < 2) return null;

  // Фильтруем welcome-сообщения, берём последние 20
  const msgs = session.messages
    .filter(m => !m.isWelcome)
    .slice(-20);

  // Акцент на user messages + action outcomes (ChatGPT best practice)
  const digest = msgs.map(m => {
    if (m.role === 'user') return `USER: ${m.content}`;
    // Для assistant — только если есть action (результат действия)
    if (m.action) return `ACTION: ${m.action} → ${m.content?.slice(0, 80)}`;
    return `AI: ${m.content?.slice(0, 60)}`;
  }).join('\n');

  try {
    const { callAI } = await import('../ai/client');
    const result = await callAI({
      prompt: `${STRUCTURED_SUMMARY_PROMPT}\n\nРазговор:\n${digest}`,
      model: 'parsing',
      maxTokens: 300,
      temperature: 0.2,
    });

    const summary = result.content?.trim();
    if (summary) {
      await db.ai_conversations.update(session.id, { summary });
    }
    return summary;
  } catch (e) {
    console.error('[summarizeSessionStructured]', e);
    return null;
  }
}

// ═══ Merge Into Running Context ═══

async function mergeIntoRunningContext(sessionSummary) {
  if (!sessionSummary) return;

  try {
    const existing = await getSetting('ai_context_summary').catch(() => null);

    // Первая сессия — summary становится первым контекстом
    if (!existing) {
      // Пробуем конвертировать structured summary в Markdown секции
      const { callAI } = await import('../ai/client');
      const result = await callAI({
        prompt: `Преобразуй это резюме разговора в Markdown с секциями ## по темам (буллеты с фактами). Без пояснений.\n\n${sessionSummary}`,
        model: 'parsing',
        maxTokens: 400,
        temperature: 0.2,
      });
      const ctx = result.content?.trim();
      if (ctx) await setSetting('ai_context_summary', ctx);
      return;
    }

    // Merge: обновить существующий контекст
    const { callAI } = await import('../ai/client');
    const result = await callAI({
      prompt: `${MERGE_CONTEXT_PROMPT}\n\nТекущий контекст:\n${existing}\n\nНовая информация из сессии:\n${sessionSummary}`,
      model: 'parsing',
      maxTokens: 800,
      temperature: 0.2,
    });

    const merged = result.content?.trim();
    if (merged && merged.length > 10) {
      // Hard cap: ~800 слов (~5000 символов), обрезаем по последнему \n чтобы не ломать Markdown
      let capped = merged;
      if (merged.length > 5000) {
        const cut = merged.lastIndexOf('\n', 5000);
        capped = cut > 100 ? merged.slice(0, cut) : merged.slice(0, 5000);
      }
      await setSetting('ai_context_summary', capped);
    }
    // Если merge вернул мусор — старый контекст сохраняется (safe)
  } catch (e) {
    console.error('[mergeIntoRunningContext]', e);
    // Старый контекст не теряется при ошибке
  }
}

// ═══ Orchestrator: summarize + merge ═══

async function summarizeAndMerge(session) {
  if (!navigator.onLine) return;

  try {
    const summary = await summarizeSessionStructured(session);
    await setSetting('last_session_end_ts', Date.now());
    if (summary) {
      await mergeIntoRunningContext(summary);
    }
  } catch (e) {
    console.error('[summarizeAndMerge]', e);
  }
}

// ═══ Public getters ═══

export async function getRunningContext() {
  return getSetting('ai_context_summary').catch(() => null);
}

export async function getLastSessionEndTs() {
  return getSetting('last_session_end_ts').catch(() => null);
}

// ═══ Messages ═══

export async function addMessage(sessionId, role, content, meta) {
  try {
    const session = await db.ai_conversations.where('session_id').equals(sessionId).first();
    if (!session) return null;

    session.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
      ...(meta || {}),
    });
    await db.ai_conversations.update(session.id, { messages: session.messages });
    return session;

  } catch (e) {
    console.error('[chatHistory.addMessage]', e);
    throw e;
  }
}

export async function getRecentMessages(sessionId, limit = 10) {
  try {
    const session = await db.ai_conversations.where('session_id').equals(sessionId).first();
    if (!session) return [];
    // Последние N пар (user+assistant = 2 сообщения на пару)
    return session.messages.slice(-(limit * 2));

  } catch (e) {
    console.error('[chatHistory.getRecentMessages]', e);
    return [];
  }
}

export async function getAllSessionMessages(sessionId) {
  try {
    const session = await db.ai_conversations.where('session_id').equals(sessionId).first();
    return session?.messages || [];

  } catch (e) {
    console.error('[chatHistory.getAllSessionMessages]', e);
    return [];
  }
}

export async function clearHistory() {
  try {
    await db.ai_conversations.clear();
    // Сброс running context и timestamp
    await setSetting('ai_context_summary', null);
    await setSetting('last_session_end_ts', null);
  } catch (e) {
    console.error('[chatHistory.clearHistory]', e);
    throw e;
  }
}

export async function getSessionHistory() {
  try {
    return db.ai_conversations.orderBy('created_at').reverse().limit(20).toArray();

  } catch (e) {
    console.error('[chatHistory.getSessionHistory]', e);
    return [];
  }
}
