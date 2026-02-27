import { callAI } from './client';
import { PARSE_COMMAND_PROMPT, ANALYSIS_PROMPT } from './prompts';
import { findCorrection } from './corrections';
import { validateAction, needsConfirmation } from './policy';

/**
 * processInput — главная точка входа AI-каскада.
 * 4 уровня: regex → шаблоны → API fast → API smart.
 * Возвращает: { action, params, message, level, needsConfirm? }
 */
export async function processInput(input, chatHistory) {
  const text = (input || '').trim();
  if (!text) {
    return { action: null, params: null, message: 'Пустой ввод', level: 0 };
  }

  // Проверить коррекции (пользователь ранее исправлял такой ввод)
  try {
    const correction = await findCorrection(text);
    if (correction) {
      return applyPolicy({
        action: correction.corrected_action,
        params: correction.corrected_params,
        message: `✏️ Применена коррекция: ${correction.corrected_action}`,
        level: 0,
      });
    }
  } catch { /* corrections not critical */ }

  // ═══ Уровень 1: Regex (мгновенно, $0) ═══
  const level1 = level1_regex(text);
  if (level1) return applyPolicy({ ...level1, level: 1 });

  // ═══ Уровень 2: Шаблоны (мгновенно, $0) ═══
  const level2 = level2_patterns(text);
  if (level2) return applyPolicy({ ...level2, level: 2 });

  // ═══ Уровень 3-4: API ═══
  const { level: targetLevel, topics } = routeToLevel(text);

  try {
    if (targetLevel === 'level4') {
      return applyPolicy({ ...(await level4_analysis(text, chatHistory, topics)), level: 4 });
    }
    return applyPolicy({ ...(await level3_parseCommand(text, chatHistory, topics)), level: 3 });
  } catch (err) {
    return handleAIError(err);
  }
}

/**
 * Валидация и подтверждение действия через policy.js
 */
async function applyPolicy(result) {
  // Multi-action: валидация каждого действия в массиве
  if (result.actions?.length > 0) {
    const validated = [];
    for (const act of result.actions) {
      try {
        const v = await validateAction(act.action, act.params || {});
        if (v.valid) validated.push(act);
      } catch { /* skip invalid */ }
    }
    if (validated.length === 0) {
      return { ...result, actions: undefined, action: 'error', message: '⚠️ Ни одно действие не прошло валидацию' };
    }
    return { ...result, actions: validated };
  }

  // Single action
  if (!result.action || result.action === 'chat_response' || result.action === 'error') {
    return result;
  }

  try {
    const validation = await validateAction(result.action, result.params || {});
    if (!validation.valid) {
      return { ...result, action: 'error', message: `⚠️ ${validation.reason}` };
    }
    if (validation.warning) {
      result.message = `${result.message || ''} (${validation.warning})`.trim();
    }

    const confirm = needsConfirmation(result.action, result.params || {});
    if (confirm) {
      result.needsConfirm = confirm;
    }
  } catch { /* policy check not critical */ }

  return result;
}

// ═══════════════════════════════════════════
// УРОВЕНЬ 1: Regex — мгновенный парсинг ($0)
// ═══════════════════════════════════════════

function level1_regex(text) {
  const lower = text.toLowerCase().trim();

  // Расход: "кофе 350", "такси 1200", "1500 обед"
  const expenseMatch = text.match(/^(.+?)\s+(\d+[\d\s]*(?:[.,]\d+)?)\s*₸?\s*$/i)
    || text.match(/^(\d+[\d\s]*(?:[.,]\d+)?)\s*₸?\s+(.+)$/i);
  if (expenseMatch) {
    const isNumFirst = /^\d/.test(expenseMatch[1]);
    const amount = parseFloat((isNumFirst ? expenseMatch[1] : expenseMatch[2]).replace(/\s/g, '').replace(',', '.'));
    const desc = (isNumFirst ? expenseMatch[2] : expenseMatch[1]).trim();
    if (amount > 0 && amount < 10000000 && desc.length > 0 && desc.length < 100) {
      const category = guessCategory(desc);
      return {
        action: 'add_expense',
        params: { amount, description: desc, category },
        message: `💸 ${desc} ${amount}₸ → ${category}`,
      };
    }
  }

  // Вес: "78.5", "78,5 кг", "вес 80"
  const weightMatch = text.match(/^(?:вес\s+)?(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:кг|kg)?$/i);
  if (weightMatch) {
    const w = parseFloat(weightMatch[1].replace(',', '.'));
    if (w >= 30 && w <= 300) {
      return { action: 'log_weight', params: { weight_kg: w }, message: `⚖️ Вес ${w} кг записан` };
    }
  }

  // Вода: "вода", "вода 500", "💧 300"
  const waterMatch = text.match(/^(?:вода|💧|water)\s*(\d+)?\s*(?:мл|ml)?$/i);
  if (waterMatch) {
    const ml = parseInt(waterMatch[1]) || 250;
    return { action: 'log_water', params: { amount_ml: ml }, message: `💧 ${ml} мл воды записано` };
  }

  // Undo: "отмени", "назад", "undo"
  if (/^(?:отмени|отменить|undo|назад|верни|откатить|откати)$/i.test(lower)) {
    return { action: 'undo_last', params: {}, message: null };
  }

  return null;
}

// ═══════════════════════════════════════════
// УРОВЕНЬ 2: Шаблоны — частые паттерны ($0)
// ═══════════════════════════════════════════

function level2_patterns(text) {
  const lower = text.toLowerCase().trim();

  // ═══ R1.1: SMS банков ═══
  // Kaspi: «Kaspi Gold: покупка 3500₸ Магнит»
  const kaspiMatch = text.match(/Kaspi\s*(?:Gold)?[:\s]+(?:покупка|оплата|списание)\s+([\d\s.,]+)\s*[₸тТ]/i);
  if (kaspiMatch) {
    const amount = parseFloat(kaspiMatch[1].replace(/\s/g, '').replace(',', '.'));
    const descMatch = text.match(/[₸тТ]\s+(.+?)(?:\s+\d{2}[./]\d{2}|$)/);
    const desc = descMatch?.[1]?.trim() || 'Kaspi покупка';
    return {
      action: 'add_expense', params: { amount, description: desc },
      message: `💳 ${desc} ${amount}₸ (Kaspi)`,
    };
  }

  // Halyk: «Halyk Bank: spisanie 5000 KZT MAGNUM»
  const halykMatch = text.match(/Halyk\s*(?:Bank)?[:\s]+(?:spisanie|покупка|оплата)\s+([\d\s.,]+)\s*(?:KZT|₸)/i);
  if (halykMatch) {
    const amount = parseFloat(halykMatch[1].replace(/\s/g, '').replace(',', '.'));
    const descMatch = text.match(/(?:KZT|₸)\s+(.+?)(?:\s+\d{2}[./]\d{2}|$)/);
    const desc = descMatch?.[1]?.trim() || 'Halyk покупка';
    return {
      action: 'add_expense', params: { amount, description: desc },
      message: `💳 ${desc} ${amount}₸ (Halyk)`,
    };
  }

  // Сбер/Тинькофф: «Покупка 1200.50₽ Яндекс.Такси»
  const ruBankMatch = text.match(/(?:Сбер|Тинькофф|ВТБ|Альфа)[:\s]+(?:покупка|оплата|списание)\s+([\d\s.,]+)\s*[₽рР]/i);
  if (ruBankMatch) {
    const amount = parseFloat(ruBankMatch[1].replace(/\s/g, '').replace(',', '.'));
    const descMatch = text.match(/[₽рР]\s+(.+?)(?:\s+\d{2}[./]\d{2}|$)/);
    const desc = descMatch?.[1]?.trim() || 'Покупка';
    const bank = text.match(/(Сбер|Тинькофф|ВТБ|Альфа)/i)?.[1] || '';
    return {
      action: 'add_expense', params: { amount, description: desc },
      message: `💳 ${desc} ${amount}₽ (${bank})`,
    };
  }

  // ═══ R1.3: Переводы ═══
  const transferMatch = text.match(/(?:перевод|p2p|на карту|перевёл|перевел)\s+(?:на\s+)?(?:карту\s+)?(?:\*?\d{4}\s*)?(\d[\d\s.,]*)\s*[₸₽тТрР]?/i);
  if (transferMatch) {
    const amount = parseFloat(transferMatch[1].replace(/\s/g, '').replace(',', '.'));
    if (amount > 0) {
      return {
        action: 'add_transfer',
        params: { amount, description: text.trim().slice(0, 80) },
        message: `💸 Перевод ${amount}`,
      };
    }
  }

  // ═══ Зачисление ═══
  const incomeMatch = text.match(/(?:зачисление|зачислено|поступление|получено)\s+([\d\s.,]+)\s*[₸₽тТрР]/i);
  if (incomeMatch) {
    const amount = parseFloat(incomeMatch[1].replace(/\s/g, '').replace(',', '.'));
    const sourceMatch = text.match(/[₸₽тТрР]\s+(.+?)$/i);
    return {
      action: 'add_income', params: { amount, source: sourceMatch?.[1]?.trim() || 'Зачисление' },
      message: `💰 +${amount} (${sourceMatch?.[1]?.trim() || 'зачисление'})`,
    };
  }

  // Задача: "задача: ...", "напомни ...", "todo ..."
  const taskMatch = text.match(/^(?:задача|напомни|todo|сделать|надо)[:\s]+(.+)$/i);
  if (taskMatch) {
    return {
      action: 'add_task',
      params: { title: taskMatch[1].trim(), priority: 'normal' },
      message: `📋 Задача: ${taskMatch[1].trim()}`,
    };
  }

  // Сон: "лёг в 23:30 встал в 7:00", "сон 7.5ч"
  const sleepMatch = text.match(/^(?:лёг|лег|спал|сон)\s+(?:в\s+)?(\d{1,2}[:.]\d{2})\s+(?:встал|проснулся)\s+(?:в\s+)?(\d{1,2}[:.]\d{2})$/i);
  if (sleepMatch) {
    const bed = sleepMatch[1].replace('.', ':');
    const wake = sleepMatch[2].replace('.', ':');
    return {
      action: 'log_sleep',
      params: { bed_time: bed, wake_time: wake },
      message: `💤 Сон: ${bed} → ${wake}`,
    };
  }

  const sleepHoursMatch = text.match(/^(?:сон|спал)\s+(\d+(?:[.,]\d+)?)\s*(?:ч|час)/i);
  if (sleepHoursMatch) {
    const hours = parseFloat(sleepHoursMatch[1].replace(',', '.'));
    return {
      action: 'log_sleep',
      params: { duration_hours: hours },
      message: `💤 Сон: ${hours}ч`,
    };
  }

  // Быстрые запросы
  if (/^(?:задачи|мои задачи|что делать|что сделать)\s*(?:сегодня|на сегодня)?$/i.test(lower)) {
    return { action: 'query_tasks', params: { filter: 'today' }, message: null };
  }

  if (/^(?:сколько|расходы|траты)\s*(?:сегодня|за сегодня)?$/i.test(lower)) {
    return { action: 'query_expenses', params: { period: 'today' }, message: null };
  }

  if (/^(?:что\s+(?:я\s+)?ел|еда|калории)\s*(?:сегодня|вчера)?$/i.test(lower)) {
    const period = lower.includes('вчера') ? 'yesterday' : 'today';
    return { action: 'query_nutrition', params: { period }, message: null };
  }

  // Рутина: "рутина чистить зубы", "привычка медитация"
  const routineMatch = text.match(/^(?:рутина|привычка|habit)[:\s]+(.+)$/i);
  if (routineMatch) {
    const name = routineMatch[1].trim();
    return {
      action: 'add_routine',
      params: { name, type: 'morning', frequency: 'daily' },
      message: `🔄 Рутина: ${name}`,
    };
  }

  // Заметка: "заметка: ...", "запиши ...", "note ..."
  const noteMatch = text.match(/^(?:заметка|запиши|запомни|note|memo)[:\s]+(.+)$/i);
  if (noteMatch) {
    const content = noteMatch[1].trim();
    return {
      action: 'add_note',
      params: { content },
      message: `📝 Заметка сохранена`,
    };
  }

  // Еда: "ел пасту 400 ккал", "завтрак овсянка 350", "обед 600 ккал"
  const foodMatch = text.match(/^(?:ел|съел|завтрак|обед|ужин|перекус|еда)[:\s]+(.+?)(?:\s+(\d+)\s*(?:ккал|kcal|кал))?$/i);
  if (foodMatch) {
    const mealMap = { завтрак: 'breakfast', обед: 'lunch', ужин: 'dinner', перекус: 'snack' };
    const firstWord = text.split(/[\s:]+/)[0].toLowerCase();
    const meal = mealMap[firstWord] || 'lunch';
    const desc = foodMatch[1].trim();
    const cal = foodMatch[2] ? parseInt(foodMatch[2]) : null;
    return {
      action: 'add_food',
      params: { description: desc, meal, calories: cal },
      message: `🍽 ${desc}${cal ? ` ~${cal} ккал` : ''}`,
    };
  }

  // Навигация: "открой финансы", "покажи задачи", "перейди в настройки"
  const navMatch = text.match(/^(?:открой|покажи|перейди в|перейди на|go to|open)\s+(.+)$/i);
  if (navMatch) {
    const target = navMatch[1].toLowerCase().trim();
    const navMap = {
      финансы: 'finances', деньги: 'finances', расходы: 'finances',
      задачи: 'tasks', задач: 'tasks',
      питание: 'nutrition', еда: 'nutrition', еду: 'nutrition',
      спорт: 'sport', тренировки: 'sport',
      инвестиции: 'invest', портфель: 'invest',
      рутины: 'routines', привычки: 'routines',
      заметки: 'notes', записи: 'notes',
      настройки: 'settings',
      сон: 'sleep',
      документы: 'documents',
      подписки: 'subscriptions',
      календарь: 'calendar',
    };
    const screen = navMap[target];
    if (screen) {
      return { action: 'navigate', params: { screen }, message: null };
    }
  }

  // Баланс: "сколько на счетах", "баланс", "сколько денег"
  if (/^(?:баланс|сколько (?:на счетах|денег|осталось)|мои счета)$/i.test(lower)) {
    return { action: 'navigate', params: { screen: 'finances' }, message: null };
  }

  // ═══ Аналитика (строгие паттерны — только целевые запросы) ═══
  if (/^(?:аномалии|покажи аномалии|есть аномалии|отклонения)\s*\??$/i.test(lower)) {
    return { action: 'query_anomalies', params: {}, message: null };
  }
  if (/^(?:корреляции|покажи корреляции|связи между модулями|зависимости|что связано)\s*\??$/i.test(lower)) {
    return { action: 'query_correlations', params: {}, message: null };
  }
  if (/^(?:сводка|брифинг|что важно|что нужно знать)\s*(?:сегодня)?\s*\??$/i.test(lower)) {
    return { action: 'query_briefing', params: {}, message: null };
  }
  if (/^(?:полный анализ|кросс-анализ|все инсайты|глубокий анализ)\s*\??$/i.test(lower)) {
    return { action: 'query_cross_analysis', params: {}, message: null };
  }
  if (/^(?:что (?:ты )?(?:обо мне )?(?:знаешь|помнишь)|моя память|что в памяти)\s*\??$/i.test(lower)) {
    return { action: 'query_memory', params: {}, message: null };
  }

  // Проактивные инсайты → L4 с полным контекстом
  if (/^(?:как дела|что нового|подведи итог|итоги|отчёт|отчет|как у меня|обзор|статус|дай сводку)$/i.test(lower)) {
    return null; // пропускаем L2, routeToLevel отправит в L4
  }

  // L2 web search: курс, погода → сразу web_search без API
  const searchMatch = text.match(/^(?:курс|цена|котировка|стоимость)\s+(.+)$/i);
  if (searchMatch) {
    return { action: 'web_search', params: { query: text }, message: '🔍 Ищу...' };
  }
  if (/^(?:погода|температура)\s*/i.test(lower)) {
    return { action: 'web_search', params: { query: text }, message: '🔍 Ищу...' };
  }

  // Настроение: "настроение 7", "mood 8"
  const moodMatch = text.match(/^(?:настроение|mood)\s+(\d{1,2})(?:\s+(.+))?$/i);
  if (moodMatch) {
    const score = parseInt(moodMatch[1]);
    if (score >= 1 && score <= 10) {
      return { action: 'log_mood', params: { score, note: moodMatch[2] || '' }, message: `${score >= 7 ? '😊' : score >= 4 ? '😐' : '😔'} Настроение ${score}/10` };
    }
  }

  return null;
}

// ═══════════════════════════════════════════
// УРОВЕНЬ 3: API Fast — парсинг команд (~$0.001)
// ═══════════════════════════════════════════

async function level3_parseCommand(input, chatHistory, topics) {
  const context = await collectContext('L3', topics, input);

  const result = await callAI({
    prompt: input,
    systemPrompt: PARSE_COMMAND_PROMPT(context),
    model: 'parsing',
    maxTokens: 400,
    temperature: 0.1,
  });

  try {
    const parsed = JSON.parse(result.content);
    // Multi-action support
    if (parsed.actions && Array.isArray(parsed.actions)) {
      return {
        actions: parsed.actions,
        message: parsed.response || result.content,
      };
    }
    return {
      action: parsed.action || 'chat_response',
      params: parsed.params || null,
      message: parsed.response || result.content,
    };
  } catch {
    // AI не вернул JSON — вернуть как текстовый ответ
    return { action: 'chat_response', params: null, message: result.content };
  }
}

// ═══════════════════════════════════════════
// УРОВЕНЬ 4: API Smart — анализ (~$0.005)
// ═══════════════════════════════════════════

async function level4_analysis(input, chatHistory, topics) {
  const context = await collectContext('L4', topics, input);

  const result = await callAI({
    prompt: input,
    systemPrompt: ANALYSIS_PROMPT(context),
    model: 'analysis',
    maxTokens: 1000,
    temperature: 0.3,
  });

  return { action: 'chat_response', params: null, message: result.content };
}

// ═══════════════════════════════════════════
// Роутинг: какой уровень использовать
// ═══════════════════════════════════════════

function routeToLevel(input) {
  const lower = input.toLowerCase();
  const analysisKeywords = [
    'анализ', 'почему', 'корреляц', 'сравни', 'отчёт', 'отчет',
    'тренд', 'паттерн', 'инсайт', 'рекоменд', 'совет',
    'как улучшить', 'что изменить', 'зависимость',
    'как дела', 'что нового', 'подведи итог', 'итоги',
    'как у меня', 'обзор', 'статус', 'дай сводку',
  ];

  // Определяем тему запроса для умного контекста
  const topics = new Set();
  const TOPIC_KW = {
    finance:   ['расход', 'доход', 'бюджет', 'трат', 'деньг', 'счёт', 'зарплат', '₸', '₽', 'экономи', 'перевод'],
    tasks:     ['задач', 'дело', 'планир', 'сделать', 'дедлайн'],
    health:    ['сон', 'спал', 'вес ', 'здоров', 'настроен', 'mood'],
    nutrition: ['еда', 'калори', 'ккал', 'белок', 'питани', 'ел ', 'пил ', 'вода', 'диет'],
    sport:     ['тренир', 'спорт', 'зал', 'бег', 'упражнен'],
    invest:    ['акци', 'портфель', 'дивиденд', 'инвестиц', 'биржа'],
  };
  for (const [topic, keywords] of Object.entries(TOPIC_KW)) {
    if (keywords.some(kw => lower.includes(kw))) topics.add(topic);
  }
  if (topics.size === 0) topics.add('all');
  topics.add('memory');

  const level = analysisKeywords.some(kw => lower.includes(kw)) ? 'level4' : 'level3';
  return { level, topics: [...topics] };
}

// ═══════════════════════════════════════════
// Graceful degradation
// ═══════════════════════════════════════════

function handleAIError(err) {
  const msg = err.message || '';

  if (msg === 'API_KEY_MISSING') {
    return { action: 'error', params: null, message: '🔑 API ключ не настроен. Настройте в Настройки → AI.', level: 0 };
  }
  if (msg.startsWith('LIMIT_REACHED')) {
    const reason = msg.split(':')[1];
    const reasonText = {
      daily_calls: 'Дневной лимит вызовов',
      daily_cost: 'Дневной лимит расходов',
      monthly_cost: 'Месячный лимит расходов',
    }[reason] || 'Лимит';
    return { action: 'error', params: null, message: `⚠️ ${reasonText} исчерпан. Используйте ручной ввод.`, level: 0 };
  }
  if (!navigator.onLine || msg.includes('fetch') || msg.includes('network') || msg.includes('internet')) {
    return { action: 'error', params: null, message: '📡 Нет интернета. AI недоступен, но ручной ввод работает.', level: 0 };
  }

  console.error('AI cascade error:', err);
  return { action: 'error', params: null, message: '⚠️ AI временно недоступен. Попробуйте позже.', level: 0 };
}

// ═══════════════════════════════════════════
// Контекст для промптов
// ═══════════════════════════════════════════

async function collectContext(tier = 'L4', topics = ['all'], userMessage = null) {
  try {
    const db = (await import('../db/index')).default;
    const { getRelevantMemories } = await import('../services/embeddings');
    const today = new Date().toISOString().split('T')[0];

    // L3: минимальный контекст для парсинга (~200 токенов)
    if (tier === 'L3') {
      const { getSetting } = await import('../db/helpers');
      // Parallel: vector embed (with timeout) + DB reads
      const [memories, tasks, runningContext] = await Promise.all([
        getRelevantMemories(userMessage, 15).catch(() => []),
        db.tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').limit(5).toArray().catch(() => []),
        getSetting('ai_context_summary').catch(() => null),
      ]);
      return {
        today,
        active_tasks: tasks.map(t => t.title),
        user_memory: memories.map(m => `[${m.category}] ${m.fact}`),
        ...(runningContext ? { running_context: runningContext } : {}),
      };
    }

    // L4: умный контекст — грузим только по темам
    const { getSetting } = await import('../db/helpers');
    const monthStart = today.slice(0, 8) + '01';
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const loadAll = topics.includes('all');
    const has = (t) => loadAll || topics.includes(t);

    // Всегда: tasks + memory (vector search for relevant memories)
    const baseQueries = [
      db.tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').limit(20).toArray().catch(() => []),
      getRelevantMemories(userMessage, 30).catch(() => []),
    ];
    // Условные запросы
    const conditionalQueries = {
      todayExpenses: has('finance') ? db.expenses.where('date').equals(today).toArray().catch(() => []) : [],
      monthExpenses: has('finance') ? db.expenses.where('date').between(monthStart, today + '\uffff', true, true).toArray().catch(() => []) : [],
      monthIncomes: has('finance') ? db.incomes.where('date').between(monthStart, today + '\uffff', true, true).toArray().catch(() => []) : [],
      accounts: has('finance') ? db.accounts.toArray().catch(() => []) : [],
      budget: has('finance') ? getSetting('monthly_budget').catch(() => null) : null,
      lastSleep: has('health') ? db.sleep_log.where('date').equals(yesterday).first().catch(() => null) : null,
      lastWeight: has('health') ? db.body_weight.orderBy('date').reverse().first().catch(() => null) : null,
      lastWorkout: has('sport') ? db.workouts.orderBy('date').reverse().first().catch(() => null) : null,
      todayMeals: has('nutrition') ? db.food_log.where('date').equals(today).toArray().catch(() => []) : [],
      todayWater: has('nutrition') ? db.water_log.where('date').equals(today).toArray().catch(() => []) : [],
      goals: loadAll ? db.goals.filter(g => g.status === 'active').toArray().catch(() => []) : [],
      routines: loadAll ? db.routines.toArray().catch(() => []) : [],
      routineLog: loadAll ? db.routine_log.where('date').equals(today).toArray().catch(() => []) : [],
      portfolio: has('invest') ? db.portfolio.toArray().catch(() => []) : [],
    };

    // Параллельное выполнение
    const [tasks, memories] = await Promise.all(baseQueries);
    const cq = {};
    const entries = Object.entries(conditionalQueries);
    const values = await Promise.all(entries.map(([, v]) => Promise.resolve(v)));
    entries.forEach(([k], i) => { cq[k] = values[i]; });

    const todayExpenses = cq.todayExpenses || [];
    const monthExpenses = cq.monthExpenses || [];
    const monthIncomes = cq.monthIncomes || [];
    const todaySpent = todayExpenses.reduce((s, e) => s + (e.amount_base || e.amount || 0), 0);
    const monthSpent = monthExpenses.reduce((s, e) => s + (e.amount_base || e.amount || 0), 0);
    const monthIncome = monthIncomes.reduce((s, i) => s + (i.amount || 0), 0);

    let daysSinceWorkout = null;
    if (cq.lastWorkout?.date) {
      daysSinceWorkout = Math.floor((Date.now() - new Date(cq.lastWorkout.date + 'T00:00:00').getTime()) / 86400000);
    }

    // Running context (deep memory)
    const runningContext = await getSetting('ai_context_summary').catch(() => null);

    const ctx = {
      today,
      active_tasks: tasks.slice(0, 5).map(t => t.title),
      overdue_tasks_count: tasks.filter(t => t.deadline && t.deadline < today).length,
      user_memory: memories.map(m => `[${m.category}] ${m.fact}`),
      ...(runningContext ? { running_context: runningContext } : {}),
    };

    // Финансы
    if (has('finance')) {
      ctx.today_expenses_total = todaySpent;
      ctx.recent_expenses = todayExpenses.slice(-3).map(e => ({ amount: e.amount_base || e.amount, desc: e.description }));
      ctx.month_expenses_total = monthSpent;
      ctx.month_income_total = monthIncome;
      ctx.budget_remaining = cq.budget ? cq.budget - monthSpent : null;
      ctx.account_balances = (cq.accounts || []).slice(0, 5).map(a => ({ name: a.name, balance: a.balance }));
    }
    // Здоровье
    if (has('health')) {
      ctx.last_sleep = cq.lastSleep ? { duration: cq.lastSleep.duration_hours, bed_time: cq.lastSleep.bed_time } : null;
      ctx.current_weight = cq.lastWeight?.weight || cq.lastWeight?.value || null;
    }
    // Спорт
    if (has('sport')) {
      ctx.last_workout = cq.lastWorkout ? { type: cq.lastWorkout.type, days_ago: daysSinceWorkout } : null;
    }
    // Питание
    if (has('nutrition')) {
      ctx.today_calories = (cq.todayMeals || []).reduce((s, m) => s + (m.calories || m.total_calories || 0), 0);
      ctx.today_water_ml = (cq.todayWater || []).reduce((s, w) => s + (w.amount_ml || 0), 0);
    }
    // Цели и рутины (только при all)
    if (loadAll) {
      ctx.active_goals = (cq.goals || []).slice(0, 5).map(g => ({ name: g.name || g.title, progress: g.progress || 0 }));
      ctx.routines_today = { done: (cq.routineLog || []).length, total: (cq.routines || []).length };
    }
    // Портфель
    if (has('invest')) {
      ctx.portfolio_total_value = (cq.portfolio || []).reduce((s, p) => s + ((p.quantity || 0) * (p.current_price || p.avg_price || 0)), 0) || null;
    }

    return ctx;
  } catch (err) {
    console.error('[collectContext]', err);
    return { today: new Date().toISOString().split('T')[0] };
  }
}

// ═══════════════════════════════════════════
// Хелперы
// ═══════════════════════════════════════════

function guessCategory(desc) {
  const lower = desc.toLowerCase();
  const map = [
    [['кофе', 'обед', 'ужин', 'завтрак', 'еда', 'продукт', 'магазин', 'супермаркет', 'хлеб', 'молоко'], 'Еда'],
    [['такси', 'uber', 'яндекс', 'бензин', 'метро', 'автобус', 'парковка'], 'Транспорт'],
    [['кафе', 'ресторан', 'бар', 'доставка', 'glovo', 'wolt'], 'Кафе и рестораны'],
    [['аптека', 'лекарств', 'врач', 'клиника', 'анализ'], 'Здоровье'],
    [['одежда', 'обувь', 'шмотки', 'zara', 'hm'], 'Одежда'],
    [['связь', 'интернет', 'телефон', 'мобильн'], 'Связь'],
    [['подписка', 'netflix', 'spotify', 'youtube', 'apple'], 'Подписки'],
    [['квартира', 'аренда', 'коммуналк', 'ком.услуги', 'электрич'], 'Жильё'],
  ];

  for (const [keywords, category] of map) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'Прочее';
}
