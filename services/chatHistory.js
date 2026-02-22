import db from '../db/index';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 минут

export function generateSessionId() {
  const date = new Date().toISOString().split('T')[0];
  const rand = Math.random().toString(36).slice(2, 5);
  return `sess_${date}_${rand}`;
}

export async function getOrCreateSession(lastMessageTime) {
  try {
    if (lastMessageTime && (Date.now() - lastMessageTime) < SESSION_TIMEOUT_MS) {
      const latest = await db.ai_conversations.orderBy('created_at').reverse().first();
      if (latest) return latest;
    }

    // Таймаут — сжать предыдущую сессию (фоном)
    const existing = await db.ai_conversations.orderBy('created_at').reverse().first();
    if (existing && existing.messages.length >= 4 && !existing.summary) {
      summarizeSession(existing).catch(() => {});
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

/**
 * Сжать сессию в 1-2 предложения через AI (Flash, ~$0.0001)
 */
async function summarizeSession(session) {
  if (!session || session.summary || session.messages.length < 4) return;

  const userMsgs = session.messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .slice(-10)
    .join('; ');

  try {
    const { callAI } = await import('../ai/client');
    const result = await callAI({
      prompt: `Резюмируй в 1-2 предложениях что делал пользователь: ${userMsgs}`,
      model: 'parsing',
      maxTokens: 100,
    });
    await db.ai_conversations.update(session.id, { summary: result.content });
  } catch (e) {
    console.error('[summarizeSession]', e);
  }
}

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
