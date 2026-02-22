import { useState, useEffect, useRef, useCallback } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import { getOrCreateSession, addMessage, getRecentMessages, clearHistory, getSessionHistory } from '../../services/chatHistory';
import IOSKeyboardSpacer from '../../components/IOSKeyboardSpacer';
import Ic from '../../components/Icon';

const SUGGESTIONS = [
  { icon: '💸', text: 'кофе 350' },
  { icon: '📋', text: 'задача: купить молоко' },
  { icon: '💧', text: 'вода' },
  { icon: '📊', text: 'Сколько я потратил?' },
  { icon: '🍎', text: 'Что я ел вчера?' },
  { icon: '📋', text: 'Задачи на сегодня' },
];

export default function AIChatScreen({ theme, onBack, onNavigate }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  /* K4: Session history */
  const [showHistory, setShowHistory] = useState(false);
  const [sessionList, setSessionList] = useState([]);
  /* K6: Correction */
  const [correcting, setCorrecting] = useState(null); // {msgIndex, originalInput}
  const [correctionText, setCorrectionText] = useState('');

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastMsgTime = useRef(null);

  // ── Init session ──
  useEffect(() => { initSession(); }, []);

  const initSession = async () => {
    const sess = await getOrCreateSession(lastMsgTime.current);
    setSession(sess);
    if (sess?.messages?.length) setMessages(sess.messages);

    // Derived memories: раз в неделю
    try {
      const { getSetting, setSetting } = await import('../../db/helpers');
      const lastDerived = await getSetting('last_derived_memories');
      if (!lastDerived || Date.now() - lastDerived > 7 * 86400000) {
        const { generateDerivedMemories } = await import('../../services/derivedMemories');
        generateDerivedMemories().catch(() => {});
        await setSetting('last_derived_memories', Date.now());
      }
    } catch { /* derived memories not critical */ }
  };

  // ── Autoscroll ──
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  // ═══ CORE: Отправка сообщения ═══
  const handleSend = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || isLoading) return;

    setInput('');
    lastMsgTime.current = Date.now();

    // User message
    const userMsg = { role: 'user', content: msg, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    if (session) await addMessage(session.session_id, 'user', msg);

    setIsLoading(true);

    try {
      const ai = await loadAI();
      if (!ai) {
        pushAssistantMsg('⚠️ AI-модуль не подключён. Настройте API-ключ в настройках.');
        setIsLoading(false);
        return;
      }

      // ── Шаг 1: Каскад (processInput) ──
      const history = session ? await getRecentMessages(session.session_id, 10) : [];
      const result = await ai.processInput(msg, history);

      // ── Шаг 2a: Multi-action ──
      if (result.actions?.length > 0) {
        const { executeAction } = await import('../../ai/execute');
        let ok = 0, fail = 0;
        for (const act of result.actions) {
          try {
            const exec = await executeAction(act.action, act.params);
            if (exec.executed) ok++; else fail++;
          } catch { fail++; }
        }
        const displayMsg = result.message || `Выполнено ${ok}/${ok + fail}`;
        pushAssistantMsg(displayMsg);
        setIsLoading(false);
        return;
      }

      // ── Шаг 2b: Выполнение действия ──
      if (result.action && result.action !== 'chat_response' && result.action !== 'error') {

        // Подтверждение для крупных сумм
        if (result.needsConfirm) {
          const confirmMsg = {
            role: 'assistant',
            content: `${result.message}\n\n⚠️ Подтвердите действие`,
            timestamp: new Date().toISOString(),
            action: result.action,
            params: result.params,
            pendingConfirm: true,
          };
          setMessages(prev => [...prev, confirmMsg]);
          if (session) await addMessage(session.session_id, 'assistant', confirmMsg.content, { action: result.action, params: result.params });
          setIsLoading(false);
          return;
        }

        // Выполнить
        const { executeAction } = await import('../../ai/execute');
        const exec = await executeAction(result.action, result.params);

        if (exec.executed) {
          // Навигация
          if (result.action === 'navigate' && exec.result?.navigate) {
            onNavigate?.(exec.result.navigate);
          }

          // Запросы → показать результат
          const queryResult = exec.result?.queryResult;
          const displayMsg = queryResult || result.message || '✅ Готово';

          const assistantMsg = {
            role: 'assistant',
            content: displayMsg,
            timestamp: new Date().toISOString(),
            action: result.action,
            params: result.params,
          };
          setMessages(prev => [...prev, assistantMsg]);
          if (session) await addMessage(session.session_id, 'assistant', displayMsg, { action: result.action });
        } else {
          pushAssistantMsg(exec.error ? `❌ ${exec.error}` : (result.message || '⚠️ Не удалось выполнить'));
        }

        setIsLoading(false);
        return;
      }

      // ── Шаг 3: Ошибка каскада ──
      if (result.action === 'error') {
        pushAssistantMsg(result.message || '⚠️ Ошибка');
        setIsLoading(false);
        return;
      }

      // ── Шаг 4: chat_response → streaming ──
      // Если L1/L2 вернул message — показать сразу
      if (result.level <= 2 && result.message) {
        pushAssistantMsg(result.message);
        setIsLoading(false);
        return;
      }

      // Streaming для L3/L4
      let streamingContent = result.message || '';

      const streamPlaceholder = {
        role: 'assistant',
        content: streamingContent + ' ▍',
        timestamp: new Date().toISOString(),
        streaming: true,
      };
      setMessages(prev => [...prev, streamPlaceholder]);

      try {
        const { callAIStream } = await import('../../ai/client');
        // Загружаем контекст + память для персонализации
        let systemPrompt = 'Ты — LifeOS AI-ассистент. Помогай кратко и по делу. Русский язык.';
        try {
          const [{ default: ctxDb }, { getMemories }] = await Promise.all([
            import('../../db/index'),
            import('../../services/aiMemory'),
          ]);
          const { getSetting } = await import('../../db/helpers');
          const { getSessionHistory: getSessHist } = await import('../../services/chatHistory');
          const ctxToday = new Date().toISOString().split('T')[0];
          const ctxMonthStart = ctxToday.slice(0, 8) + '01';
          const [ctxTasks, ctxExpenses, ctxMems, ctxBudget, recentSessions] = await Promise.all([
            ctxDb.tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').limit(10).toArray().catch(() => []),
            ctxDb.expenses.where('date').between(ctxMonthStart, ctxToday + '\uffff', true, true).toArray().catch(() => []),
            getMemories(20),
            getSetting('monthly_budget').catch(() => null),
            getSessHist().catch(() => []),
          ]);
          const monthSpent = ctxExpenses.reduce((s, e) => s + (e.amount_base || e.amount || 0), 0);
          const ctxData = {
            today: ctxToday,
            tasks: ctxTasks.slice(0, 5).map(t => t.title),
            overdue: ctxTasks.filter(t => t.deadline && t.deadline < ctxToday).length,
            month_spent: monthSpent,
            budget_remaining: ctxBudget ? ctxBudget - monthSpent : null,
          };
          const memLines = ctxMems.map(m => `[${m.category}] ${m.fact}`);
          const summaries = recentSessions.filter(s => s.summary).slice(0, 3).map(s => s.summary);
          systemPrompt = `Ты — LifeOS AI-ассистент. Ты знаешь всё о пользователе.

Данные: ${JSON.stringify(ctxData)}
${memLines.length ? `\nПамять:\n${memLines.join('\n')}` : ''}
${summaries.length ? `\nПредыдущие разговоры:\n${summaries.join('\n')}` : ''}

Отвечай кратко, конкретно, с цифрами. Русский язык. Используй данные в ответах.`;
        } catch { /* fallback to basic prompt */ }
        const userPrompt = history.length
          ? history.map(m => `${m.role}: ${m.content}`).join('\n') + `\nuser: ${msg}`
          : msg;

        streamingContent = '';
        await callAIStream({
          prompt: userPrompt,
          systemPrompt,
          model: 'fast',
          onChunk: (text) => {
            streamingContent = text;
            setMessages(prev => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.streaming) last.content = text + ' ▍';
              return copy;
            });
          },
        });
      } catch {
        if (!streamingContent) streamingContent = result.message || 'Готово';
      }

      // Finalize streaming
      const finalMsg = {
        role: 'assistant',
        content: streamingContent || 'Готово',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = finalMsg;
        return copy;
      });
      if (session) await addMessage(session.session_id, 'assistant', finalMsg.content);

    } catch (err) {
      const msg = err.message === 'OFFLINE' ? '📡 Нет подключения к интернету'
        : err.message?.startsWith('LIMIT_REACHED') ? '⚠️ Достигнут лимит AI вызовов'
        : `❌ ${err.message || 'Ошибка'}`;
      pushAssistantMsg(msg);
    }

    setIsLoading(false);
  }, [input, isLoading, session]);

  // ── Helper: push assistant message ──
  const pushAssistantMsg = async (content) => {
    const msg = { role: 'assistant', content, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, msg]);
    if (session) await addMessage(session.session_id, 'assistant', content);
  };

  // ═══ K6: Исправление ═══
  const handleStartCorrection = (msgIndex) => {
    const userMsgIdx = msgIndex - 1;
    const userContent = messages[userMsgIdx]?.content || '';
    setCorrecting({ msgIndex, originalInput: userContent });
    setCorrectionText('');
  };

  const handleSubmitCorrection = async () => {
    if (!correcting || !correctionText.trim()) return;
    const { msgIndex, originalInput } = correcting;
    const msg = messages[msgIndex];

    try {
      const { saveCorrection } = await import('../../ai/corrections');
      // Сохранить: «для такого ввода — правильное действие другое»
      await saveCorrection(
        originalInput,
        { action: msg.action, params: msg.params },
        'user_correction',
        { userNote: correctionText.trim() }
      );

      // Пометить сообщение как исправленное
      setMessages(prev => prev.map((m, i) =>
        i === msgIndex
          ? { ...m, content: m.content + `\n\n✏️ Исправлено: ${correctionText.trim()}`, corrected: true }
          : m
      ));

      // Переотправить исправленный текст
      setCorrecting(null);
      setCorrectionText('');
      await handleSend(correctionText.trim());
    } catch {
      setCorrecting(null);
    }
  };

  // ═══ K7: Голосовой ввод ═══
  const handleVoice = useCallback(async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setInterimText('');
      return;
    }
    try {
      const voice = await import('../../ai/voice');
      if (!voice.isVoiceSupported()) return;

      setIsListening(true);
      recognitionRef.current = voice.startListening(
        ({ interim, isFinal }) => { if (!isFinal) setInterimText(interim || ''); else setInterimText(''); },
        () => { setIsListening(false); setInterimText(''); },
        (transcript) => {
          setIsListening(false);
          setInterimText('');
          if (transcript) handleSend(transcript);
        }
      );
    } catch {
      setIsListening(false);
      return;
    }
  }, [isListening, handleSend]);

  // ═══ K4: История сессий ═══
  const handleShowHistory = async () => {
    setShowMenu(false);
    const sessions = await getSessionHistory();
    setSessionList(sessions || []);
    setShowHistory(true);
  };

  const handleSwitchSession = async (sess) => {
    setSession(sess);
    setMessages(sess.messages || []);
    setShowHistory(false);
    lastMsgTime.current = Date.now();
  };

  const handleNewChat = async () => {
    setShowMenu(false);
    setShowHistory(false);
    lastMsgTime.current = null;
    const sess = await getOrCreateSession(null);
    setSession(sess);
    setMessages([]);
  };

  const handleClearHistory = async () => {
    setShowMenu(false);
    await clearHistory();
    lastMsgTime.current = null;
    const sess = await getOrCreateSession(null);
    setSession(sess);
    setMessages([]);
  };

  // ═══ Подтверждение действия ═══
  const handleConfirm = async (msgIndex, confirmed) => {
    const msg = messages[msgIndex];
    if (!msg?.pendingConfirm) return;

    if (confirmed) {
      const { executeAction } = await import('../../ai/execute');
      const exec = await executeAction(msg.action, msg.params);
      setMessages(prev => prev.map((m, i) =>
        i === msgIndex
          ? { ...m, content: m.content.replace('⚠️ Подтвердите действие', exec.executed ? '✅ Выполнено' : '❌ Ошибка'), pendingConfirm: false }
          : m
      ));
    } else {
      setMessages(prev => prev.map((m, i) =>
        i === msgIndex ? { ...m, content: m.content.replace('⚠️ Подтвердите действие', '🚫 Отменено'), pendingConfirm: false } : m
      ));
    }
  };

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className="flex flex-col h-screen" style={{ background: theme.bg }}>
      {/* Header */}
      <NavHeader
        title="AI-ассистент"
        onBack={onBack}
        right={
          <button onClick={() => setShowMenu(!showMenu)} className="text-base" style={{ color: theme.gray1 }}>
            ···
          </button>
        }
        theme={theme}
      />

      {/* Menu */}
      {showMenu && (
        <div className="absolute top-14 right-4 z-50 rounded-xl py-1 shadow-lg"
          style={{ background: theme.card, border: `0.5px solid ${theme.gray4}` }}>
          <button onClick={handleNewChat} className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm" style={{ color: theme.text }}>
            <Ic name="edit" color={theme.accent} size={16} r={4} raw /> Новый разговор
          </button>
          <button onClick={handleShowHistory} className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm" style={{ color: theme.text }}>
            <Ic name="archive" color={theme.accent} size={16} r={4} raw /> История разговоров
          </button>
          <button onClick={handleClearHistory} className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm" style={{ color: theme.red }}>
            <Ic name="trash" color={theme.red} size={16} r={4} raw /> Очистить всё
          </button>
        </div>
      )}

      {/* K4: Session history overlay */}
      {showHistory && (
        <div className="absolute inset-0 z-40 flex flex-col" style={{ background: theme.bg }}>
          <NavHeader title="История" onBack={() => setShowHistory(false)} theme={theme} />
          <div className="flex-1 overflow-auto px-4 py-3">
            {sessionList.length === 0 ? (
              <p className="text-sm text-center pt-12" style={{ color: theme.gray2 }}>Нет сохранённых разговоров</p>
            ) : sessionList.map((s, i) => (
              <button key={s.session_id || i} onClick={() => handleSwitchSession(s)}
                className="w-full text-left p-3 rounded-xl mb-2" style={{ background: theme.card, border: `0.5px solid ${theme.gray5}` }}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium" style={{ color: theme.text }}>
                    💬 {s.messages?.[0]?.content?.slice(0, 40) || 'Разговор'}
                  </span>
                  <span className="text-[10px]" style={{ color: theme.gray2 }}>
                    {s.messages?.length || 0} сообщ.
                  </span>
                </div>
                <span className="text-[11px]" style={{ color: theme.gray2 }}>
                  {formatDate(s.created_at)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3" onClick={() => showMenu && setShowMenu(false)}>
        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center pt-12">
            <div className="mb-4"><Ic name="bot" color={theme.accent} size={56} r={16} /></div>
            <p className="text-base font-semibold mb-1" style={{ color: theme.text }}>AI-ассистент LifeOS</p>
            <p className="text-xs mb-6 text-center" style={{ color: theme.gray2 }}>
              Голосом или текстом: «кофе 350», «задача: купить молоко», «вода»
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => handleSend(s.text)}
                  className="px-3 py-2 rounded-xl text-xs font-medium"
                  style={{ background: theme.accent + '12', color: theme.accent }}>
                  {s.icon} {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat bubbles */}
        {messages.map((msg, i) => (
          <ChatBubble
            key={i}
            msg={msg}
            theme={theme}
            onCorrect={msg.action && !msg.corrected && !msg.pendingConfirm ? () => handleStartCorrection(i) : null}
            onConfirm={msg.pendingConfirm ? (yes) => handleConfirm(i, yes) : null}
            onAction={(act) => handleSend(act.prompt || act.label)}
          />
        ))}

        {/* Typing */}
        {isLoading && <TypingIndicator theme={theme} />}

        {/* K5: Context suggestions */}
        {!isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
          <ContextSuggestions messages={messages} theme={theme} onTap={handleSend} />
        )}

        {/* Interim voice */}
        {interimText && (
          <div className="text-xs italic text-center py-2" style={{ color: theme.gray2 }}>
            🎤 {interimText}
          </div>
        )}
      </div>

      {/* K6: Correction input bar */}
      {correcting && (
        <div className="px-3 py-2 border-t flex items-center gap-2"
          style={{ background: theme.accent + '08', borderColor: theme.accent + '30' }}>
          <span className="text-xs shrink-0" style={{ color: theme.accent }}>✏️ Исправить:</span>
          <input
            value={correctionText}
            onChange={e => setCorrectionText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmitCorrection()}
            className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: theme.gray6, color: theme.text }}
            placeholder="Введите правильную команду..."
            autoFocus
          />
          <button onClick={handleSubmitCorrection} className="text-sm font-medium px-2" style={{ color: theme.accent }}>→</button>
          <button onClick={() => setCorrecting(null)} className="text-sm px-1" style={{ color: theme.gray2 }}>✕</button>
        </div>
      )}

      {/* Input bar */}
      {!correcting && (
        <div className="flex items-center gap-2 px-3 py-2 border-t" style={{ background: theme.card, borderColor: theme.gray5 }}>
          <button onClick={handleVoice}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: isListening ? theme.red + '20' : theme.gray6, color: isListening ? theme.red : theme.gray1 }}>
            {isListening ? '⏹' : <Ic name="mic" color={theme.gray1} size={18} r={5} raw />}
          </button>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: theme.gray6, color: theme.text }}
            placeholder="Сообщение..."
            disabled={isLoading || isListening}
          />
          <button onClick={() => handleSend()} disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: input.trim() ? theme.accent : theme.gray5, color: '#fff' }}>
            ↑
          </button>
        </div>
      )}
      <IOSKeyboardSpacer />
    </div>
  );
}

// ═══ Chat Bubble ═══
function ChatBubble({ msg, theme, onCorrect, onConfirm, onAction }) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex mb-3 ${isUser ? 'justify-end' : 'justify-start'}`} style={{ gap: 8 }}>
      {!isUser && (
        <div className="shrink-0 mt-1">
          <Ic name="bot" color={theme.accent} size={28} r={8} />
        </div>
      )}
      <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
        style={{
          background: isUser ? theme.accent : (theme.isDark ? `${theme.accent}10` : theme.gray6),
          color: isUser ? '#fff' : theme.text,
          borderBottomRightRadius: isUser ? 6 : 16,
          borderBottomLeftRadius: isUser ? 16 : 6,
          border: isUser ? 'none' : `0.5px solid ${theme.gray5}`,
        }}>

        {/* Action badge */}
        {msg.action && !msg.corrected && (
          <div className="text-[10px] font-medium mb-1 px-1.5 py-0.5 rounded inline-block"
            style={{ background: theme.green + '20', color: theme.green }}>
            ✅ {actionLabel(msg.action)}
          </div>
        )}

        {/* Content */}
        <div className="whitespace-pre-wrap">{msg.content}</div>

        {/* Confirm buttons */}
        {onConfirm && (
          <div className="flex gap-2 mt-2 pt-2" style={{ borderTop: `0.5px solid ${theme.gray5}` }}>
            <button onClick={() => onConfirm(true)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: theme.green + '15', color: theme.green }}>
              ✅ Да
            </button>
            <button onClick={() => onConfirm(false)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: theme.red + '15', color: theme.red }}>
              🚫 Нет
            </button>
          </div>
        )}

        {/* Correction button */}
        {onCorrect && (
          <button onClick={onCorrect} className="mt-1.5 text-[11px] font-medium" style={{ color: theme.accent }}>
            ✏️ Исправить
          </button>
        )}

        {/* K5: Inline action buttons */}
        {!isUser && msg.suggestedActions?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 pt-2" style={{ borderTop: `0.5px solid ${theme.gray5}` }}>
            {msg.suggestedActions.map((act, i) => (
              <button key={i} onClick={() => onAction?.(act)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium"
                style={{ background: theme.accent + '12', color: theme.accent, border: `0.5px solid ${theme.accent}25`, cursor: 'pointer' }}>
                {act.icon || '⚡'} {act.label}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className="text-[10px] mt-1 opacity-50 text-right">{formatTime(msg.timestamp)}</div>
      </div>
    </div>
  );
}

// ═══ K5: Context Suggestions ═══
function ContextSuggestions({ messages, theme, onTap }) {
  const last = messages[messages.length - 1];
  const content = (last?.content || '').toLowerCase();
  const suggestions = [];

  if (content.includes('расход') || content.includes('потрат') || content.includes('₸')) {
    suggestions.push('📊 Статистика за месяц', '📉 Сравни с прошлым месяцем', '💡 Где сэкономить?');
  } else if (content.includes('задач') || content.includes('создана')) {
    suggestions.push('📋 Что ещё на сегодня?', '⏰ Просроченные', '📅 Задачи на завтра');
  } else if (content.includes('еда') || content.includes('калор') || content.includes('ккал')) {
    suggestions.push('🥗 Что поесть?', '📊 Макросы за неделю', '💧 Сколько воды?');
  } else if (content.includes('тренир') || content.includes('спорт')) {
    suggestions.push('💪 Запланируй тренировку', '📈 Прогресс', '🏆 PR');
  } else if (content.includes('сон') || content.includes('sleep')) {
    suggestions.push('📊 Сон за неделю', '💡 Как улучшить сон?', '⏰ Оптимальное время');
  } else {
    suggestions.push('📊 Итоги дня', '📋 Что запланировано?', '💡 Совет');
  }

  return (
    <div className="flex gap-1.5 flex-wrap px-2 py-1">
      {suggestions.slice(0, 3).map((s, i) => (
        <button key={i} onClick={() => onTap(s.replace(/^.{2}\s/, ''))}
          className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium active:scale-95"
          style={{ background: theme.accent + '10', color: theme.accent, border: `0.5px solid ${theme.accent}30` }}>
          {s}
        </button>
      ))}
    </div>
  );
}

// ═══ Typing Indicator ═══
function TypingIndicator({ theme }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="px-4 py-3 rounded-2xl flex gap-1"
        style={{ background: theme.card, border: `0.5px solid ${theme.gray5}`, borderBottomLeftRadius: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: theme.gray2, animationDelay: `${i * 200}ms` }} />
        ))}
      </div>
    </div>
  );
}

// ═══ Helpers ═══
async function loadAI() {
  try { return await import('../../ai/index'); }
  catch { return null; }
}

function actionLabel(action) {
  const map = {
    add_expense: 'Расход записан', add_income: 'Доход записан',
    add_task: 'Задача создана', complete_task: 'Задача выполнена',
    add_event: 'Событие создано', log_food: 'Еда записана', add_food: 'Еда записана',
    log_water: 'Вода записана', log_workout: 'Тренировка',
    log_weight: 'Вес записан', log_sleep: 'Сон записан',
    add_to_shopping_list: 'В список покупок', add_routine: 'Рутина создана',
    add_note: 'Заметка сохранена', navigate: 'Навигация', undo_last: 'Отмена',
    save_memory: 'Запомнил', forget_memory: 'Забыл', web_search: 'Поиск',
    query_expenses: 'Расходы', query_tasks: 'Задачи', query_nutrition: 'Питание',
  };
  return map[action] || action;
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
