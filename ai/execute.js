/**
 * execute.js — выполнение AI-действий: запись в БД через сервисы.
 * Каскад возвращает {action, params} → executeAction записывает данные.
 */

// Действия, для которых НЕ сохраняем undo
const NO_UNDO_ACTIONS = ['query_expenses', 'query_tasks', 'query_nutrition', 'navigate', 'web_search', 'chat_response', 'undo_last', 'forget_memory', 'complete_task'];

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
      return addTask({
        title: params.title,
        deadline: params.deadline || null,
        priority: params.priority || 'normal',
        tags: params.tags || [],
      });
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
        bed_time: params.bed_time || null,
        wake_time: params.wake_time || null,
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

    // ── Рутины ──
    case 'add_routine': {
      const { addRoutine } = await import('../services/routines');
      return addRoutine({
        name: params.name,
        type: params.type || 'morning',
        frequency: params.frequency || 'daily',
      });
    }

    // ── Заметки ──
    case 'add_note': {
      const { addNote } = await import('../services/notes');
      return addNote({
        content: params.content,
        title: (params.content || '').slice(0, 50),
      });
    }

    // ── AI-память ──
    case 'save_memory': {
      const { addMemory } = await import('../services/aiMemory');
      return addMemory(params.category || 'lifestyle', params.fact, 'user_said');
    }

    case 'forget_memory': {
      const { searchMemory, deleteMemory } = await import('../services/aiMemory');
      const found = await searchMemory(params.fact_fragment || params.query || '');
      if (found.length) {
        await deleteMemory(found[0].id);
        return { forgotten: found[0].fact };
      }
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
        add_expense:       ['expenses',  'deleteExpense'],
        add_expense_quick: ['expenses',  'deleteExpense'],
        add_income:        ['incomes',   'deleteIncome'],
        add_task:          ['tasks',     'deleteTask'],
        log_food:          ['nutrition',  'deleteMeal'],
        add_food:          ['nutrition',  'deleteMeal'],
        log_water:         ['water',     'removeWaterEntry'],
        add_event:         ['events',    'deleteEvent'],
        add_reminder:      ['reminders', 'deleteReminder'],
        add_note:          ['notes',     'deleteNote'],
        add_routine:       ['routines',  'deleteRoutine'],
        save_memory:       ['aiMemory',  'deleteMemory'],
        log_weight:        ['bodyweight','deleteWeight'],
        log_sleep:         ['sleep',     'deleteSleep'],
        log_mood:          ['mood',      'deleteMood'],
      };
      const entry = deleteMap[last.action];
      if (!entry) return { queryResult: `↩️ Отмена для «${last.action}» не поддерживается` };
      const [svcName, funcName] = entry;
      try {
        const svcMap = {
          expenses:  () => import('../services/expenses'),
          incomes:   () => import('../services/incomes'),
          tasks:     () => import('../services/tasks'),
          nutrition:  () => import('../services/nutrition'),
          water:     () => import('../services/water'),
          events:    () => import('../services/events'),
          reminders: () => import('../services/reminders'),
          notes:     () => import('../services/notes'),
          routines:  () => import('../services/routines'),
          aiMemory:  () => import('../services/aiMemory'),
          bodyweight:() => import('../services/bodyweight'),
          sleep:     () => import('../services/sleep'),
          mood:      () => import('../services/mood'),
        };
        const svc = await svcMap[svcName]();
        await svc[funcName](last.resultId);
        await setSetting('last_ai_action', null);
        return { queryResult: `↩️ Отменено: ${last.description || last.action}` };
      } catch (e) {
        return { queryResult: `↩️ Ошибка отмены: ${e.message}` };
      }
    }

    default:
      return { unknown: true, action };
  }
}
