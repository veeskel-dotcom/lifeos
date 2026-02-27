/**
 * execute.js — выполнение AI-действий: запись в БД через сервисы.
 * Каскад возвращает {action, params} → executeAction записывает данные.
 */

// Действия, для которых НЕ сохраняем undo
const NO_UNDO_ACTIONS = [
  'query_expenses', 'query_tasks', 'query_nutrition', 'query_anomalies', 'query_correlations',
  'query_briefing', 'query_cross_analysis', 'query_memory', 'query_accounts', 'query_budget',
  'query_subscriptions', 'query_credits', 'query_portfolio', 'query_dividends', 'query_projects',
  'query_productivity', 'query_events', 'query_weight', 'query_sleep', 'query_mood',
  'query_measurements', 'query_routines', 'query_notes', 'query_documents', 'query_goals',
  'query_shopping_list',
  'navigate', 'web_search', 'chat_response', 'undo_last', 'forget_memory',
  'complete_task', 'log_workout', 'add_to_shopping_list',
  'toggle_routine', 'toggle_shopping_item', 'clear_shopping_list',
  'update_task', 'delete_task', 'update_event', 'delete_event', 'delete_note',
  'cancel_subscription', 'transfer_money',
];

// ═══ Follow-up подсказки после действий ($0) ═══
export async function getFollowUpSuggestions(action, params) {
  const suggestions = [];
  try {
    switch (action) {
      case 'add_expense':
      case 'add_expense_quick': {
        const desc = (params?.description || '').toLowerCase();
        if (['кафе', 'ресторан', 'обед', 'кофе', 'завтрак', 'ужин'].some(k => desc.includes(k))) {
          suggestions.push({ icon: '🍽', label: 'Записать еду', prompt: `ел ${params.description || ''}` });
        }
        suggestions.push({ icon: '📊', label: 'Траты сегодня', prompt: 'сколько сегодня' });
        suggestions.push({ icon: '💸', label: 'Ещё расход', prompt: '' });
        break;
      }
      case 'add_income':
        suggestions.push({ icon: '📊', label: 'Баланс', prompt: 'сколько на счетах' });
        break;
      case 'add_transfer':
        suggestions.push({ icon: '📊', label: 'Траты сегодня', prompt: 'сколько сегодня' });
        break;
      case 'add_task':
        suggestions.push({ icon: '⏰', label: 'Напомнить', prompt: `напомни ${params?.title || ''} через 2 часа` });
        suggestions.push({ icon: '📋', label: 'Все задачи', prompt: 'задачи на сегодня' });
        break;
      case 'complete_task':
        suggestions.push({ icon: '📋', label: 'Ещё задачи', prompt: 'задачи на сегодня' });
        break;
      case 'log_food':
      case 'add_food':
        suggestions.push({ icon: '💧', label: 'Записать воду', prompt: 'вода' });
        suggestions.push({ icon: '📊', label: 'Калории сегодня', prompt: 'что я ел сегодня' });
        break;
      case 'log_water':
        suggestions.push({ icon: '💧', label: 'Ещё воду', prompt: 'вода' });
        break;
      case 'log_weight':
        suggestions.push({ icon: '📈', label: 'Тренд веса', prompt: 'как мой вес' });
        break;
      case 'log_sleep':
        suggestions.push({ icon: '📊', label: 'Анализ сна', prompt: 'как мой сон за неделю' });
        suggestions.push({ icon: '🍽', label: 'Завтрак', prompt: 'завтрак' });
        break;
      case 'log_mood':
        suggestions.push({ icon: '📊', label: 'Тренд настроения', prompt: 'как моё настроение' });
        break;
      case 'log_workout':
        suggestions.push({ icon: '⚖️', label: 'Записать вес', prompt: 'вес' });
        break;
      case 'add_event':
        suggestions.push({ icon: '⏰', label: 'Напоминание', prompt: `напомни ${params?.title || ''} за час` });
        suggestions.push({ icon: '📅', label: 'Открой календарь', prompt: 'открой календарь' });
        break;
      case 'add_reminder':
        suggestions.push({ icon: '📋', label: 'Мои задачи', prompt: 'задачи на сегодня' });
        break;
      case 'add_to_shopping_list':
        suggestions.push({ icon: '🛒', label: 'Ещё в список', prompt: 'открой покупки' });
        break;
      case 'add_routine':
        suggestions.push({ icon: '🔄', label: 'Мои рутины', prompt: 'открой рутины' });
        break;
      case 'add_note':
        suggestions.push({ icon: '📝', label: 'Мои заметки', prompt: 'открой заметки' });
        break;
      case 'save_memory':
        suggestions.push({ icon: '🧠', label: 'Что помнишь?', prompt: 'что ты обо мне знаешь' });
        break;
      case 'query_expenses':
        suggestions.push({ icon: '📉', label: 'Сравнить', prompt: 'сравни с прошлой неделей' });
        suggestions.push({ icon: '💡', label: 'Где сэкономить?', prompt: 'на чём сэкономить' });
        break;
      case 'query_anomalies':
        suggestions.push({ icon: '📊', label: 'Корреляции', prompt: 'корреляции' });
        suggestions.push({ icon: '📋', label: 'Полный анализ', prompt: 'полный анализ' });
        break;
      case 'query_correlations':
        suggestions.push({ icon: '🔍', label: 'Аномалии', prompt: 'аномалии' });
        break;
    }
  } catch { /* not critical */ }
  return suggestions.slice(0, 3);
}

export async function executeAction(action, params) {
  if (!action || action === 'chat_response' || action === 'error') {
    return { executed: false };
  }

  try {
    const result = await dispatch(action, params);

    // Сохранить для undo (только записывающие действия с ID)
    // Некоторые сервисы возвращают число (id), другие — объект {id, ...}
    const resultId = typeof result === 'number' ? result : result?.id;
    if (resultId && !NO_UNDO_ACTIONS.includes(action)) {
      try {
        const { setSetting } = await import('../db/helpers');
        await setSetting('last_ai_action', JSON.stringify({
          action,
          resultId,
          description: result?.description || params.description || params.title || params.name || '',
          ts: Date.now(),
        }));
      } catch { /* undo tracking not critical */ }
    }

    return { executed: true, action, result };
  } catch (err) {
    console.error(`[execute] ${action}:`, err);
    return { executed: false, error: err.message };
  }
}

async function dispatch(action, params) {
  const today = new Date().toISOString().split('T')[0];

  switch (action) {
    // ── Финансы ──
    case 'add_expense':
    case 'add_expense_quick': {
      const { addExpense } = await import('../services/expenses');
      return addExpense({
        amount: params.amount,
        description: params.description || '',
        category: params.category || 'Прочее',
        date: params.date || today,
        source: 'ai',
      });
    }

    case 'add_income': {
      const { addIncome } = await import('../services/incomes');
      return addIncome({
        amount: params.amount,
        source: params.source || 'Прочее',
        date: params.date || today,
      });
    }

    // R1.3: Переводы — записываем как расход с категорией «Переводы»
    case 'add_transfer': {
      const { addExpense } = await import('../services/expenses');
      return addExpense({
        amount: params.amount,
        description: params.description || 'Перевод',
        category_name: 'Переводы',
        date: params.date || today,
        is_transfer: true,
      });
    }

    // ── Задачи ──
    case 'add_task': {
      const { addTask } = await import('../services/tasks');
      const taskData = {
        title: params.title,
        deadline: params.deadline || null,
        priority: params.priority || 'normal',
        tags: params.tags || [],
      };
      if (params.description) taskData.description = params.description;
      if (params.area) taskData.area = params.area;
      if (params.project_name) {
        const { getActiveProjects } = await import('../services/projects');
        const projects = await getActiveProjects();
        const proj = projects.find(p => p.name.toLowerCase().includes(params.project_name.toLowerCase()));
        if (proj) taskData.project_id = proj.id;
      }
      return addTask(taskData);
    }

    case 'complete_task': {
      const db = (await import('../db/index')).default;
      const { toggleTask } = await import('../services/tasks');
      const fragment = (params.task_title_fragment || params.title || '').toLowerCase();
      const tasks = await db.tasks.filter(t =>
        t.status !== 'done' && t.title.toLowerCase().includes(fragment)
      ).first();
      if (tasks) {
        await toggleTask(tasks.id);
        return { completed: tasks.title };
      }
      return { error: `Задача «${fragment}» не найдена` };
    }

    // ── Питание ──
    case 'log_food':
    case 'add_food': {
      const { addMeal } = await import('../services/nutrition');
      const mealType = params.meal || params.meal_type || 'lunch';
      const items = params.items || [{
        name: params.description || 'Еда',
        calories: params.calories || 0,
        protein: params.protein || 0,
        fat: params.fat || 0,
        carbs: params.carbs || 0,
        amount_g: params.amount_g || 100,
      }];
      return addMeal(today, mealType, items);
    }

    case 'log_water': {
      const { addWater } = await import('../services/water');
      return addWater(params.amount_ml || 250);
    }

    // ── Здоровье ──
    case 'log_weight': {
      const { addWeight } = await import('../services/bodyweight');
      return addWeight(today, params.weight_kg);
    }

    case 'log_sleep': {
      const { addSleep } = await import('../services/sleep');
      return addSleep({
        bedtime: params.bed_time || params.bedtime || null,
        waketime: params.wake_time || params.waketime || null,
        duration_hours: params.duration_hours || null,
        date: today,
      });
    }

    case 'log_mood': {
      const { logMood } = await import('../services/mood');
      return logMood(params.score || params.value, params.note || '');
    }

    // ── Спорт ──
    case 'log_workout': {
      const { startWorkout } = await import('../services/workouts');
      return startWorkout(null); // без шаблона
    }

    case 'generate_program': {
      const { generateProgram } = await import('../services/aiTrainer');
      const result = await generateProgram({
        goal: params.goal || 'Масса + сила',
        split: params.split || 'Push / Pull / Legs',
        daysPerWeek: params.days_per_week || 4,
        experience: params.experience || 'Средний',
        equipment: params.equipment || 'Полный зал',
      });
      return { success: true, message: `Программа создана: ${result.split}, ${result.totalWeeks} недель` };
    }

    // ── Список покупок ──
    case 'add_to_shopping_list': {
      const { addItem } = await import('../services/shopping');
      const items = Array.isArray(params.items) ? params.items : [params.item || params.name];
      for (const item of items) {
        if (item) await addItem(typeof item === 'string' ? item : item.name);
      }
      return { added: items.length };
    }

    // ── События ──
    case 'add_event': {
      const { addEvent } = await import('../services/events');
      return addEvent({
        title: params.title,
        start: params.start || params.date || today,
        end: params.end || null,
        type: params.type || 'personal',
        location: params.location || null,
        description: params.description || null,
      });
    }

    // ── Напоминания ──
    case 'add_reminder': {
      const { createReminder } = await import('../services/reminders');
      return createReminder(
        params.type || 'general',
        params.ref_id || null,
        params.trigger_at || new Date().toISOString(),
        params.label || params.text || ''
      );
    }

    // ── Навигация ──
    case 'navigate':
      return { navigate: params.screen };

    // ── Запросы ──
    case 'query_expenses': {
      const { getTodayStats, getWeeklyStats } = await import('../services/expenses');
      if (params.period === 'today') {
        const stats = await getTodayStats();
        return { queryResult: `Сегодня потрачено: ${stats.total?.toLocaleString() || 0}₸ (${stats.count || 0} операций)` };
      }
      const stats = await getWeeklyStats();
      return { queryResult: `За неделю: ${stats.total?.toLocaleString() || 0}₸` };
    }

    case 'query_tasks': {
      const db = (await import('../db/index')).default;
      const tasks = await db.tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').limit(10).toArray();
      const todayTasks = tasks.filter(t => t.deadline === today);
      const overdue = tasks.filter(t => t.deadline && t.deadline < today);
      let text = `📋 Активных: ${tasks.length}`;
      if (todayTasks.length) text += `\n📅 Сегодня: ${todayTasks.map(t => t.title).join(', ')}`;
      if (overdue.length) text += `\n⚠️ Просрочено: ${overdue.length}`;
      return { queryResult: text };
    }

    case 'query_nutrition': {
      const { getDailyTotals } = await import('../services/nutrition');
      const date = params.period === 'yesterday'
        ? new Date(Date.now() - 86400000).toISOString().split('T')[0]
        : today;
      const totals = await getDailyTotals(date);
      const label = params.period === 'yesterday' ? 'Вчера' : 'Сегодня';
      return { queryResult: `${label}: ${totals.calories || 0} ккал (Б${totals.protein || 0} Ж${totals.fat || 0} У${totals.carbs || 0})` };
    }

    // ── Аналитика ──
    case 'query_anomalies': {
      const { detectAnomalies } = await import('../services/anomalies');
      const anomalies = await detectAnomalies();
      if (!anomalies.length) return { queryResult: '✅ Всё в пределах нормы — аномалий не обнаружено' };
      return { queryResult: `🔍 Обнаружено ${anomalies.length} аномалий:\n${anomalies.map(a => `${a.icon} ${a.title}: ${a.message}`).join('\n')}` };
    }

    case 'query_correlations': {
      const { findCorrelations } = await import('../services/correlations');
      const corrs = await findCorrelations(30);
      if (!corrs.length) return { queryResult: '📊 Мало данных для корреляций (нужна минимум неделя)' };
      return { queryResult: `📊 Корреляции (30 дней):\n${corrs.map(c => `${c.icon} ${c.text} (r=${c.correlation.toFixed(2)})`).join('\n')}` };
    }

    case 'query_briefing': {
      const { collectBriefingData, generateTemplateBriefing, getGreeting } = await import('../services/briefing');
      const data = await collectBriefingData();
      const lines = generateTemplateBriefing(data);
      return { queryResult: lines.length ? `${getGreeting()}!\n${lines.join('\n')}` : `${getGreeting()}! Всё спокойно — нет срочных уведомлений.` };
    }

    case 'query_cross_analysis': {
      const { generateCrossAnalysis } = await import('../services/crossAnalysis');
      const analysisResult = await generateCrossAnalysis(30);
      if (!analysisResult.ready) return { queryResult: `📊 ${analysisResult.message}` };
      return { queryResult: analysisResult.insights || '📊 Анализ выполнен, но инсайтов не найдено' };
    }

    case 'query_memory': {
      const { getMemories } = await import('../services/aiMemory');
      const { getRunningContext } = await import('../services/chatHistory');
      const [mems, runCtx] = await Promise.all([
        getMemories(30),
        getRunningContext().catch(() => null),
      ]);
      const parts = [];
      if (mems.length) {
        const bycat = {};
        mems.forEach(m => (bycat[m.category] ??= []).push(m.fact));
        parts.push(`🧠 Факты:\n${Object.entries(bycat).map(([c, facts]) => `**${c}**: ${facts.join('; ')}`).join('\n')}`);
      }
      if (runCtx) {
        parts.push(`📋 Контекст разговоров:\n${runCtx}`);
      }
      if (!parts.length) return { queryResult: '🧠 Пока пусто. Расскажи о себе, и я запомню!' };
      return { queryResult: parts.join('\n\n') };
    }

    // ── Рутины ──
    case 'add_routine': {
      const { addRoutine } = await import('../services/routines');
      return addRoutine({
        name: params.name,
        type: params.type || 'morning',
        frequency: params.frequency || 'daily',
        time: params.time || null,
        days: params.days || null,
        emoji: params.emoji || null,
      });
    }

    // ── Заметки ──
    case 'add_note': {
      const { addNote } = await import('../services/notes');
      return addNote({
        content: params.content,
        title: params.title || (params.content || '').slice(0, 50),
        type: params.type || 'note',
        tags: params.tags || [],
      });
    }

    // ── AI-память ──
    case 'save_memory': {
      const { addMemory } = await import('../services/aiMemory');
      return addMemory(params.category || 'lifestyle', params.fact, 'user_said');
    }

    case 'forget_memory': {
      const { searchMemory, deleteMemory } = await import('../services/aiMemory');
      const fragment = params.fact_fragment || params.query || '';
      const found = await searchMemory(fragment);
      if (found.length) {
        await deleteMemory(found[0].id);
      }
      // Также удаляем из running context если содержит этот факт
      try {
        const { getRunningContext } = await import('../services/chatHistory');
        const { setSetting } = await import('../db/helpers');
        const ctx = await getRunningContext();
        if (ctx && fragment && ctx.toLowerCase().includes(fragment.toLowerCase())) {
          const { callAI } = await import('./client');
          const result = await callAI({
            prompt: `Удали из этого контекста всё что связано с "${fragment}". Верни обновлённый контекст (Markdown). Если ничего не осталось — верни пустую строку.\n\n${ctx}`,
            model: 'parsing',
            maxTokens: 800,
            temperature: 0.1,
          });
          const cleaned = result.content?.trim();
          if (cleaned) await setSetting('ai_context_summary', cleaned);
          else await setSetting('ai_context_summary', null);
        }
      } catch { /* running context cleanup not critical */ }
      if (found.length) return { forgotten: found[0].fact };
      return { error: 'Не нашёл такого факта в памяти' };
    }

    // ── Поиск в интернете ──
    case 'web_search': {
      const { searchWeb } = await import('../services/webSearch');
      const result = await searchWeb(params.query);
      if (result.answer) {
        return { queryResult: `🔍 ${result.answer}${result.source ? ` (${result.source})` : ''}` };
      }
      if (result.topics.length) {
        return { queryResult: `🔍 ${result.topics.join('. ')}` };
      }
      return { queryResult: `🔍 По запросу "${params.query}" точного ответа не найдено` };
    }

    // ── Undo ──
    case 'undo_last': {
      const { getSetting, setSetting } = await import('../db/helpers');
      const raw = await getSetting('last_ai_action');
      if (!raw) return { queryResult: '↩️ Нечего отменять' };
      const last = JSON.parse(raw);
      if (Date.now() - last.ts > 300000) return { queryResult: '↩️ Прошло больше 5 минут, отмена невозможна' };
      const deleteMap = {
        add_expense:       ['expenses',      'deleteExpense'],
        add_expense_quick: ['expenses',      'deleteExpense'],
        add_income:        ['incomes',       'deleteIncome'],
        add_task:          ['tasks',         'deleteTask'],
        log_food:          ['nutrition',      'deleteMeal'],
        add_food:          ['nutrition',      'deleteMeal'],
        log_water:         ['water',         'removeWaterEntry'],
        add_event:         ['events',        'deleteEvent'],
        add_reminder:      ['reminders',     'deleteReminder'],
        add_note:          ['notes',         'deleteNote'],
        add_routine:       ['routines',      'deleteRoutine'],
        save_memory:       ['aiMemory',      'deleteMemory'],
        log_weight:        ['bodyweight',    'deleteWeight'],
        log_sleep:         ['sleep',         'deleteSleep'],
        log_mood:          ['mood',          'deleteMood'],
        add_account:       ['accounts',      'deleteAccount'],
        add_subscription:  ['subscriptions', 'cancelSubscription'],
        add_credit:        ['credits',       'deleteCredit'],
        add_trade:         ['trades',        'deleteTrade'],
        add_project:       ['projects',      'deleteProject'],
        add_document:      ['documents',     'deleteDocument'],
        add_goal:          ['goals',         'deleteGoal'],
      };
      const entry = deleteMap[last.action];
      if (!entry) return { queryResult: `↩️ Отмена для «${last.action}» не поддерживается` };
      const [svcName, funcName] = entry;
      try {
        const svcMap = {
          expenses:      () => import('../services/expenses'),
          incomes:       () => import('../services/incomes'),
          tasks:         () => import('../services/tasks'),
          nutrition:      () => import('../services/nutrition'),
          water:         () => import('../services/water'),
          events:        () => import('../services/events'),
          reminders:     () => import('../services/reminders'),
          notes:         () => import('../services/notes'),
          routines:      () => import('../services/routines'),
          aiMemory:      () => import('../services/aiMemory'),
          bodyweight:    () => import('../services/bodyweight'),
          sleep:         () => import('../services/sleep'),
          mood:          () => import('../services/mood'),
          accounts:      () => import('../services/accounts'),
          subscriptions: () => import('../services/subscriptions'),
          credits:       () => import('../services/credits'),
          trades:        () => import('../services/trades'),
          projects:      () => import('../services/projects'),
          documents:     () => import('../services/documents'),
          goals:         () => import('../services/goals'),
        };
        const svc = await svcMap[svcName]();
        await svc[funcName](last.resultId);
        await setSetting('last_ai_action', null);
        return { queryResult: `↩️ Отменено: ${last.description || last.action}` };
      } catch (e) {
        return { queryResult: `↩️ Ошибка отмены: ${e.message}` };
      }
    }

    // ═══ НОВЫЕ ACTIONS: Финансы ═══

    case 'query_accounts': {
      const { getAccounts, getNetWorth } = await import('../services/accounts');
      const [accounts, netWorth] = await Promise.all([getAccounts(), getNetWorth()]);
      if (!accounts.length) return { queryResult: '💰 Нет счетов. Добавь: «создай счёт Kaspi Gold»' };
      const list = accounts.map(a => `• ${a.name}${a.bank ? ` (${a.bank})` : ''}: ${(a.balance || 0).toLocaleString()}₸`).join('\n');
      return { queryResult: `💰 Счета:\n${list}\n\n💎 Чистый капитал: ${netWorth.toLocaleString()}₸` };
    }

    case 'add_account': {
      const { addAccount } = await import('../services/accounts');
      return addAccount({
        name: params.name,
        bank: params.bank || null,
        type: params.type || 'card',
        balance: params.balance || 0,
        currency: params.currency || 'KZT',
      });
    }

    case 'transfer_money': {
      const { getAccounts, transferBetweenAccounts } = await import('../services/accounts');
      const accounts = await getAccounts();
      const fromAcc = accounts.find(a => a.name.toLowerCase().includes((params.from_account || '').toLowerCase()));
      const toAcc = accounts.find(a => a.name.toLowerCase().includes((params.to_account || '').toLowerCase()));
      if (!fromAcc) return { error: `Счёт «${params.from_account}» не найден` };
      if (!toAcc) return { error: `Счёт «${params.to_account}» не найден` };
      await transferBetweenAccounts(fromAcc.id, toAcc.id, params.amount, params.description || 'Перевод');
      return { success: true, message: `Перевод ${params.amount}₸: ${fromAcc.name} → ${toAcc.name}` };
    }

    case 'set_budget': {
      const db = (await import('../db/index')).default;
      const { setBudgetLimit } = await import('../services/budgets');
      const month = params.month || today.slice(0, 7);
      if (params.category_name) {
        const cat = await db.categories.filter(c => c.name.toLowerCase().includes(params.category_name.toLowerCase())).first();
        if (!cat) return { error: `Категория «${params.category_name}» не найдена` };
        await setBudgetLimit(month, cat.id, params.limit);
        return { success: true, message: `Бюджет ${cat.name}: ${params.limit.toLocaleString()}₸/мес` };
      }
      await setBudgetLimit(month, null, params.limit);
      return { success: true, message: `Общий бюджет: ${params.limit.toLocaleString()}₸/мес` };
    }

    case 'query_budget': {
      const { getBudgets, getOverallBudget } = await import('../services/budgets');
      const month = params.month || today.slice(0, 7);
      const [budgets, overall] = await Promise.all([getBudgets(month), getOverallBudget(month)]);
      if (!budgets.length && !overall) return { queryResult: '📊 Бюджеты не установлены' };
      const parts = [];
      if (overall) parts.push(`💰 Общий: ${overall.spent?.toLocaleString() || 0} / ${overall.limit?.toLocaleString() || 0}₸`);
      if (budgets.length) {
        parts.push(budgets.map(b => `• ${b.category_name || 'Без категории'}: ${(b.spent || 0).toLocaleString()} / ${(b.limit || 0).toLocaleString()}₸`).join('\n'));
      }
      return { queryResult: `📊 Бюджет (${month}):\n${parts.join('\n')}` };
    }

    case 'add_subscription': {
      const { addSubscription } = await import('../services/subscriptions');
      return addSubscription({
        name: params.name,
        amount: params.amount,
        frequency: params.frequency || 'monthly',
        category: params.category || null,
        next_payment: params.next_payment || null,
      });
    }

    case 'query_subscriptions': {
      const { getSubscriptions, getMonthlyTotal } = await import('../services/subscriptions');
      const [subs, total] = await Promise.all([getSubscriptions(), getMonthlyTotal()]);
      if (!subs.length) return { queryResult: '📱 Нет активных подписок' };
      const list = subs.map(s => `• ${s.name}: ${s.amount?.toLocaleString()}₸/${s.frequency === 'yearly' ? 'год' : 'мес'}`).join('\n');
      return { queryResult: `📱 Подписки:\n${list}\n\n💸 Всего в месяц: ${total.toLocaleString()}₸` };
    }

    case 'cancel_subscription': {
      const db = (await import('../db/index')).default;
      const { cancelSubscription } = await import('../services/subscriptions');
      const frag = (params.name_fragment || params.name || '').toLowerCase();
      const sub = await db.subscriptions.filter(s => s.name.toLowerCase().includes(frag) && s.is_active !== false).first();
      if (!sub) return { error: `Подписка «${frag}» не найдена` };
      await cancelSubscription(sub.id);
      return { cancelled: sub.name };
    }

    case 'add_credit': {
      const { addCredit } = await import('../services/credits');
      return addCredit({
        name: params.name,
        bank: params.bank || null,
        original_amount: params.original_amount,
        interest_rate: params.interest_rate || null,
        monthly_payment: params.monthly_payment || null,
        payment_day: params.payment_day || null,
      });
    }

    case 'query_credits': {
      const { getActiveCredits, getUpcomingPayments } = await import('../services/credits');
      const [credits, payments] = await Promise.all([getActiveCredits(), getUpcomingPayments()]);
      if (!credits.length) return { queryResult: '🏦 Нет активных кредитов' };
      const list = credits.map(c => `• ${c.name}${c.bank ? ` (${c.bank})` : ''}: ${(c.remaining || c.original_amount || 0).toLocaleString()}₸`).join('\n');
      const payBlock = payments.length ? `\n\n📅 Ближайшие платежи:\n${payments.map(p => `• ${p.name}: ${p.amount?.toLocaleString()}₸ (${p.date})`).join('\n')}` : '';
      return { queryResult: `🏦 Кредиты:\n${list}${payBlock}` };
    }

    // ═══ НОВЫЕ ACTIONS: Инвестиции ═══

    case 'add_trade': {
      const { addTrade } = await import('../services/trades');
      return addTrade({
        ticker: params.ticker,
        type: params.type,
        quantity: params.quantity,
        price: params.price,
        broker: params.broker || null,
        date: params.date || today,
      });
    }

    case 'query_portfolio': {
      const { getPortfolio, getPortfolioSummary } = await import('../services/portfolio');
      const [portfolio, summary] = await Promise.all([getPortfolio(), getPortfolioSummary()]);
      if (!portfolio.length) return { queryResult: '📈 Портфель пуст' };
      const list = portfolio.slice(0, 10).map(p => `• ${p.ticker}: ${p.quantity} шт × ${p.avg_price?.toLocaleString()}₸`).join('\n');
      const sumBlock = summary ? `\n\n💰 Итого: ${summary.total_value?.toLocaleString() || 0}₸ (P&L: ${summary.total_pnl >= 0 ? '+' : ''}${summary.total_pnl?.toLocaleString() || 0}₸)` : '';
      return { queryResult: `📈 Портфель:\n${list}${sumBlock}` };
    }

    case 'query_dividends': {
      const { getDividends, getTotalDividendIncome, getUpcomingDividends } = await import('../services/dividends');
      const year = new Date().getFullYear();
      const [divs, totalIncome, upcoming] = await Promise.all([
        getDividends(),
        getTotalDividendIncome(year),
        getUpcomingDividends(),
      ]);
      const parts = [];
      if (totalIncome) parts.push(`💰 Дивиденды за ${year}: ${totalIncome.toLocaleString()}₸`);
      if (upcoming?.length) {
        parts.push(`📅 Ожидаемые:\n${upcoming.map(u => `• ${u.ticker}: ${u.amount?.toLocaleString()}₸ (${u.date})`).join('\n')}`);
      }
      if (!parts.length) return { queryResult: '💰 Нет данных о дивидендах' };
      return { queryResult: parts.join('\n\n') };
    }

    // ═══ НОВЫЕ ACTIONS: Задачи + Проекты ═══

    case 'update_task': {
      const db = (await import('../db/index')).default;
      const { updateTask } = await import('../services/tasks');
      const frag = (params.task_title_fragment || '').toLowerCase();
      const task = await db.tasks.filter(t => t.status !== 'done' && t.title.toLowerCase().includes(frag)).first();
      if (!task) return { error: `Задача «${frag}» не найдена` };
      const updates = {};
      if (params.deadline) updates.deadline = params.deadline;
      if (params.priority) updates.priority = params.priority;
      if (params.tags) updates.tags = params.tags;
      if (params.description) updates.description = params.description;
      if (params.area) updates.area = params.area;
      if (params.project_name) {
        const { getActiveProjects } = await import('../services/projects');
        const projects = await getActiveProjects();
        const proj = projects.find(p => p.name.toLowerCase().includes(params.project_name.toLowerCase()));
        if (proj) updates.project_id = proj.id;
      }
      await updateTask(task.id, updates);
      return { updated: task.title };
    }

    case 'delete_task': {
      const db = (await import('../db/index')).default;
      const { deleteTask } = await import('../services/tasks');
      const frag = (params.task_title_fragment || '').toLowerCase();
      const task = await db.tasks.filter(t => t.title.toLowerCase().includes(frag)).first();
      if (!task) return { error: `Задача «${frag}» не найдена` };
      await deleteTask(task.id);
      return { deleted: task.title };
    }

    case 'add_subtask': {
      const db = (await import('../db/index')).default;
      const { addSubtask } = await import('../services/tasks');
      const frag = (params.task_title_fragment || '').toLowerCase();
      const task = await db.tasks.filter(t => t.status !== 'done' && t.title.toLowerCase().includes(frag)).first();
      if (!task) return { error: `Задача «${frag}» не найдена` };
      await addSubtask(task.id, params.subtask_title);
      return { success: true, message: `Подзадача «${params.subtask_title}» → ${task.title}` };
    }

    case 'add_project': {
      const { addProject } = await import('../services/projects');
      return addProject({
        name: params.name,
        color: params.color || null,
        icon: params.icon || null,
      });
    }

    case 'query_projects': {
      const { getActiveProjects } = await import('../services/projects');
      const db = (await import('../db/index')).default;
      const projects = await getActiveProjects();
      if (!projects.length) return { queryResult: '📁 Нет активных проектов' };
      const lines = [];
      for (const p of projects) {
        const taskCount = await db.tasks.filter(t => t.project_id === p.id && t.status !== 'done').count();
        lines.push(`• ${p.icon || '📁'} ${p.name}: ${taskCount} задач`);
      }
      return { queryResult: `📁 Проекты:\n${lines.join('\n')}` };
    }

    case 'query_productivity': {
      const { getProductivityStats } = await import('../services/tasks');
      const stats = await getProductivityStats();
      return { queryResult: `📊 Продуктивность:\n• Эта неделя: ${stats.thisWeek || 0} задач\n• Этот месяц: ${stats.thisMonth || 0} задач\n• Streak: ${stats.streak || 0} дней` };
    }

    // ═══ НОВЫЕ ACTIONS: События ═══

    case 'update_event': {
      const db = (await import('../db/index')).default;
      const { updateEvent } = await import('../services/events');
      const frag = (params.event_title_fragment || '').toLowerCase();
      const event = await db.events.filter(e => e.title.toLowerCase().includes(frag)).last();
      if (!event) return { error: `Событие «${frag}» не найдено` };
      const updates = {};
      if (params.title) updates.title = params.title;
      if (params.start) updates.start = params.start;
      if (params.end) updates.end = params.end;
      if (params.type) updates.type = params.type;
      await updateEvent(event.id, updates);
      return { updated: event.title };
    }

    case 'delete_event': {
      const db = (await import('../db/index')).default;
      const { deleteEvent } = await import('../services/events');
      const frag = (params.event_title_fragment || '').toLowerCase();
      const event = await db.events.filter(e => e.title.toLowerCase().includes(frag)).last();
      if (!event) return { error: `Событие «${frag}» не найдено` };
      await deleteEvent(event.id);
      return { deleted: event.title };
    }

    case 'query_events': {
      const { getUpcomingEvents, getEventsForDay } = await import('../services/events');
      if (params.period === 'today') {
        const events = await getEventsForDay(today);
        if (!events.length) return { queryResult: '📅 Сегодня нет событий' };
        return { queryResult: `📅 Сегодня:\n${events.map(e => `• ${e.start ? e.start.slice(11, 16) + ' ' : ''}${e.title}`).join('\n')}` };
      }
      if (params.period === 'tomorrow') {
        const tmr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const events = await getEventsForDay(tmr);
        if (!events.length) return { queryResult: '📅 Завтра нет событий' };
        return { queryResult: `📅 Завтра:\n${events.map(e => `• ${e.start ? e.start.slice(11, 16) + ' ' : ''}${e.title}`).join('\n')}` };
      }
      const events = await getUpcomingEvents(7);
      if (!events.length) return { queryResult: '📅 Нет предстоящих событий' };
      return { queryResult: `📅 Ближайшие:\n${events.map(e => `• ${e.start ? e.start.slice(0, 10) + ' ' : ''}${e.title}`).join('\n')}` };
    }

    // ═══ НОВЫЕ ACTIONS: Здоровье ═══

    case 'log_measurement': {
      const { addMeasurement } = await import('../services/measurements');
      return addMeasurement({
        date: today,
        biceps: params.biceps || null,
        chest: params.chest || null,
        waist: params.waist || null,
        hips: params.hips || null,
        thigh: params.thigh || null,
        calf: params.calf || null,
      });
    }

    case 'query_weight': {
      const { getLatest, getWeights, getTrend, getWeightPrediction } = await import('../services/bodyweight');
      const [latest, weights, prediction] = await Promise.all([
        getLatest(),
        getWeights(30),
        getWeightPrediction().catch(() => null),
      ]);
      if (!latest) return { queryResult: '⚖️ Нет данных о весе' };
      const parts = [`⚖️ Текущий: ${latest.weight} кг`];
      // getTrend is synchronous, needs entries array
      const trend = getTrend(weights);
      if (trend != null) parts.push(`📈 Тренд: ${trend > 0 ? '+' : ''}${trend.toFixed(1)} кг/нед`);
      if (weights.length > 1) {
        const diff = latest.weight - weights[0].weight; // oldest entry first
        parts.push(`📊 За ${weights.length} дней: ${diff > 0 ? '+' : ''}${diff.toFixed(1)} кг`);
      }
      // prediction = {daysToGoal, weeklyChange, predictedDate, message} or null
      if (prediction?.message) parts.push(`🔮 ${prediction.message}`);
      return { queryResult: parts.join('\n') };
    }

    case 'query_sleep': {
      const { getSleepAverage, getTrend: getSleepTrend, getBedtimeRecommendation } = await import('../services/sleep');
      const [avg, trend, rec] = await Promise.all([
        getSleepAverage(7),
        getSleepTrend().catch(() => null),
        getBedtimeRecommendation().catch(() => null),
      ]);
      if (!avg) return { queryResult: '😴 Нет данных о сне' };
      // avg = {average, goal, diff, daysTracked}
      const parts = [`😴 Средний сон (${avg.daysTracked || 7} дней): ${avg.average}ч (цель ${avg.goal}ч)`];
      // trend = {avgDuration, avgQuality, avgBedTime, count}
      if (trend?.avgBedTime) parts.push(`🛌 Среднее засыпание: ${trend.avgBedTime}`);
      // rec = {bedtime, wakeAvg, message}
      if (rec?.message) parts.push(`💡 ${rec.message}`);
      return { queryResult: parts.join('\n') };
    }

    case 'query_mood': {
      const { getAverageMood, getMoodTrend, getTodayMood } = await import('../services/mood');
      const [avg, trend, todayMood] = await Promise.all([
        getAverageMood(7),
        getMoodTrend(7).catch(() => []),
        getTodayMood().catch(() => null),
      ]);
      const parts = [];
      // todayMood field is .value not .score
      if (todayMood) parts.push(`😊 Сегодня: ${todayMood.value}/10${todayMood.note ? ` (${todayMood.note})` : ''}`);
      if (avg) parts.push(`📊 Среднее (7 дней): ${avg.toFixed(1)}/10`);
      // trend is array of entries — compute direction
      if (trend?.length >= 3) {
        const recent = trend.slice(-3).reduce((s, m) => s + m.value, 0) / 3;
        const older = trend.slice(0, 3).reduce((s, m) => s + m.value, 0) / Math.min(3, trend.length);
        const diff = recent - older;
        if (Math.abs(diff) > 0.5) parts.push(`📈 Тренд: ${diff > 0 ? 'улучшение ↑' : 'снижение ↓'}`);
      }
      if (!parts.length) return { queryResult: '😊 Нет данных о настроении' };
      return { queryResult: parts.join('\n') };
    }

    case 'query_measurements': {
      const { getLatest: getLatestMeasurement } = await import('../services/measurements');
      const m = await getLatestMeasurement();
      if (!m) return { queryResult: '📏 Нет замеров тела' };
      const fields = { biceps: 'Бицепс', chest: 'Грудь', waist: 'Талия', hips: 'Бёдра', thigh: 'Бедро', calf: 'Икра' };
      const parts = Object.entries(fields)
        .filter(([k]) => m[k] != null)
        .map(([k, label]) => `• ${label}: ${m[k]} см`);
      if (!parts.length) return { queryResult: '📏 Замеры пусты' };
      return { queryResult: `📏 Последние замеры (${m.date || ''}):\n${parts.join('\n')}` };
    }

    // ═══ НОВЫЕ ACTIONS: Привычки ═══

    case 'toggle_routine': {
      const db = (await import('../db/index')).default;
      const { toggleRoutine } = await import('../services/routines');
      const frag = (params.routine_name_fragment || '').toLowerCase();
      const routine = await db.routines.filter(r => r.name.toLowerCase().includes(frag)).first();
      if (!routine) return { error: `Привычка «${frag}» не найдена` };
      await toggleRoutine(routine.id);
      return { toggled: routine.name };
    }

    case 'query_routines': {
      const db = (await import('../db/index')).default;
      const { getTodayRoutines, getDailyCompletion } = await import('../services/routines');
      const [routines, completion] = await Promise.all([getTodayRoutines(), getDailyCompletion()]);
      if (!routines.length) return { queryResult: '🔄 Нет привычек на сегодня' };
      // Join with routine_log for completion status
      const todayStr = today;
      const logs = await db.routine_log.where('date').equals(todayStr).toArray();
      const completedIds = new Set(logs.filter(l => l.completed).map(l => l.routine_id));
      const list = routines.map(r => {
        const done = completedIds.has(r.id);
        const streak = r.streak || 0;
        return `${done ? '✅' : '⬜'} ${r.emoji || ''} ${r.name}${streak > 1 ? ` (${streak}🔥)` : ''}`;
      }).join('\n');
      const pct = Math.round((completion?.percent || 0) * 100);
      return { queryResult: `🔄 Привычки сегодня (${pct}%):\n${list}` };
    }

    // ═══ НОВЫЕ ACTIONS: Заметки + Документы ═══

    case 'query_notes': {
      const { getNotes } = await import('../services/notes');
      const notes = await getNotes({ search: params.search, tag: params.tag });
      if (!notes.length) return { queryResult: '📝 Заметок не найдено' };
      const list = notes.slice(0, 10).map(n => `• ${n.title || n.content?.slice(0, 40) || 'Без названия'}`).join('\n');
      return { queryResult: `📝 Заметки (${notes.length}):\n${list}` };
    }

    case 'delete_note': {
      const db = (await import('../db/index')).default;
      const { deleteNote } = await import('../services/notes');
      const frag = (params.note_title_fragment || '').toLowerCase();
      const note = await db.notes.filter(n => (n.title || n.content || '').toLowerCase().includes(frag)).first();
      if (!note) return { error: `Заметка «${frag}» не найдена` };
      await deleteNote(note.id);
      return { deleted: note.title || note.content?.slice(0, 40) };
    }

    case 'add_document': {
      const { addDocument } = await import('../services/documents');
      return addDocument({
        type: params.type || 'other',
        number: params.number || null,
        expires_at: params.expires_at || null,
        name: params.name || null,
      });
    }

    case 'query_documents': {
      const { getDocuments, getExpiringSoon } = await import('../services/documents');
      const [docs, expiring] = await Promise.all([getDocuments(), getExpiringSoon()]);
      if (!docs.length) return { queryResult: '📄 Нет документов' };
      const list = docs.map(d => `• ${d.name || d.type}: №${d.number || '—'}${d.expires_at ? ` (до ${d.expires_at})` : ''}`).join('\n');
      const expBlock = expiring?.length ? `\n\n⚠️ Истекают скоро:\n${expiring.map(e => `• ${e.name || e.type}: ${e.expires_at}`).join('\n')}` : '';
      return { queryResult: `📄 Документы:\n${list}${expBlock}` };
    }

    // ═══ НОВЫЕ ACTIONS: Цели ═══

    case 'add_goal': {
      const { addGoal } = await import('../services/goals');
      return addGoal({
        title: params.title || null,
        target_value: params.target_value,
        unit: params.unit || null,
        deadline: params.deadline || null,
        type: params.type || null,
      });
    }

    case 'query_goals': {
      const { refreshAllGoals } = await import('../services/goals');
      const goals = await refreshAllGoals();
      if (!goals?.length) return { queryResult: '🎯 Нет активных целей' };
      const list = goals.map(g => {
        const pct = g.target_value ? Math.round((g.current_value || 0) / g.target_value * 100) : 0;
        return `• ${g.title || g.type}: ${g.current_value || 0}/${g.target_value} ${g.unit || ''} (${pct}%)`;
      }).join('\n');
      return { queryResult: `🎯 Цели:\n${list}` };
    }

    // ═══ НОВЫЕ ACTIONS: Покупки ═══

    case 'toggle_shopping_item': {
      const db = (await import('../db/index')).default;
      const { toggleItem } = await import('../services/shopping');
      const frag = (params.item_name_fragment || '').toLowerCase();
      const item = await db.shopping_list.filter(i => i.name.toLowerCase().includes(frag)).first();
      if (!item) return { error: `Товар «${frag}» не найден в списке` };
      await toggleItem(item.id);
      return { toggled: item.name };
    }

    case 'clear_shopping_list': {
      const { clearChecked } = await import('../services/shopping');
      await clearChecked();
      return { success: true, message: 'Купленные товары убраны из списка' };
    }

    case 'query_shopping_list': {
      const { getItems } = await import('../services/shopping');
      const result = await getItems();
      const items = [];
      if (result.unchecked) {
        for (const [cat, catItems] of result.unchecked) {
          for (const item of catItems) {
            items.push(`⬜ ${item.name}`);
          }
        }
      }
      const checkedCount = result.checked?.length || 0;
      if (!items.length && !checkedCount) return { queryResult: '🛒 Список покупок пуст' };
      let text = `🛒 Список покупок (${items.length}):\n${items.join('\n')}`;
      if (checkedCount) text += `\n\n✅ Куплено: ${checkedCount}`;
      return { queryResult: text };
    }

    default:
      return { unknown: true, action };
  }
}
