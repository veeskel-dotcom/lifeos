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
  const targetLevel = routeToLevel(text);

  try {
    if (targetLevel === 'level4') {
      return applyPolicy({ ...(await level4_analysis(text, chatHistory)), level: 4 });
    }
    return applyPolicy({ ...(await level3_parseCommand(text, chatHistory)), level: 3 });
  } catch (err) {
    return handleAIError(err);
  }
}

/**
 * Валидация и подтверждение действия через policy.js
 */
async function applyPolicy(result) {
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

  return null;
}

// ═══════════════════════════════════════════
// УРОВЕНЬ 3: API Fast — парсинг команд (~$0.001)
// ═══════════════════════════════════════════

async function level3_parseCommand(input, chatHistory) {
  const context = await collectContext();

  const result = await callAI({
    prompt: input,
    systemPrompt: PARSE_COMMAND_PROMPT(context),
    model: 'fast',
    maxTokens: 300,
    temperature: 0.1,
  });

  try {
    const parsed = JSON.parse(result.content);
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

async function level4_analysis(input, chatHistory) {
  const context = await collectContext();

  const result = await callAI({
    prompt: input,
    systemPrompt: ANALYSIS_PROMPT(context),
    model: 'smart',
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
  ];

  if (analysisKeywords.some(kw => lower.includes(kw))) {
    return 'level4';
  }

  return 'level3';
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

async function collectContext() {
  try {
    const db = (await import('../db/index')).default;
    const today = new Date().toISOString().split('T')[0];

    const [tasks, recentExpenses] = await Promise.all([
      db.tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').limit(10).toArray().catch(() => []),
      db.expenses.where('date').equals(today).toArray().catch(() => []),
    ]);

    const todaySpent = recentExpenses.reduce((s, e) => s + (e.amount_base || e.amount || 0), 0);

    return {
      today,
      active_tasks: tasks.slice(0, 5).map(t => t.title),
      today_expenses_total: todaySpent,
      recent_expenses: recentExpenses.slice(-3).map(e => ({
        amount: e.amount_base || e.amount,
        desc: e.description,
      })),
    };
  } catch {
    return null;
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
