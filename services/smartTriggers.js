/**
 * Q1.1-Q1.10: Smart Triggers — кросс-модульные автоматизации.
 * Запускается при каждом важном действии, проверяет триггеры.
 *
 * Q1.1  Ресторан → залогировать еду
 * Q1.2  Тренировка → напомнить белок
 * Q1.3  Плохой сон → «Полегче сегодня»
 * Q1.4  Перерасход → готовить дома
 * Q1.5  Вес растёт → калории
 * Q1.6  Зарплата → авторазнос по конвертам
 * Q1.7  Пропустил рутину → напоминание
 * Q1.8  Дивиденд → автодоход
 * Q1.9  Подписка → авторасход
 * Q1.10 Задача #покупки → список покупок
 */
import db from '../db/index';
import { getSetting, setSetting } from '../db/helpers';

/**
 * Проверить триггеры после действия.
 * @param {string} event — тип события
 * @param {object} data — данные события
 * @returns {Array<{type, icon, title, message, actions?}>} — уведомления
 */
export async function checkTriggers(event, data = {}) {
  const notifications = [];

  try {
    switch (event) {
      case 'expense_added':
        await checkQ1_1(data, notifications);
        await checkQ1_4(data, notifications);
        break;

      case 'workout_completed':
        await checkQ1_2(data, notifications);
        break;

      case 'sleep_logged':
        await checkQ1_3(data, notifications);
        break;

      case 'weight_logged':
        await checkQ1_5(data, notifications);
        break;

      case 'income_added':
        await checkQ1_6(data, notifications);
        break;

      case 'routine_missed':
        await checkQ1_7(data, notifications);
        break;

      case 'task_added':
        await checkQ1_10(data, notifications);
        break;

      case 'daily_check':
        await checkQ1_8(notifications);
        await checkQ1_9(notifications);
        break;
    }
  } catch (e) {
    console.error('[smartTriggers]', e);
  }

  return notifications;
}

// Q1.1: Расход в категории «Кафе» → предложить залогировать еду
async function checkQ1_1(data, out) {
  const category = (data.category || '').toLowerCase();
  if (category.includes('кафе') || category.includes('ресторан') || category.includes('доставка')) {
    // Проверить, логировал ли уже еду сегодня
    const today = new Date().toISOString().slice(0, 10);
    const meals = await db.food_log.where('date').equals(today).count();
    if (meals < 3) {
      out.push({
        type: 'food_log_prompt',
        icon: '🍽',
        title: 'Залогировать обед?',
        message: `Вы потратили ${data.amount}₸ в кафе. Записать приём пищи?`,
        actions: [
          { label: 'Записать', action: 'navigate', params: { screen: 'nutrition' } },
        ],
      });
    }
  }
}

// Q1.2: Тренировка → напомнить про белок
async function checkQ1_2(data, out) {
  const goal = await getSetting('daily_protein_goal');
  const proteinGoal = parseInt(goal) || 120;

  const today = new Date().toISOString().slice(0, 10);
  const meals = await db.food_log.where('date').equals(today).toArray();
  const totalProtein = meals.reduce((sum, m) =>
    sum + (m.items || []).reduce((s, i) => s + (i.protein || 0), 0), 0);

  if (totalProtein < proteinGoal * 0.6) {
    out.push({
      type: 'protein_reminder',
      icon: '🥩',
      title: 'Пора подкрепиться белком',
      message: `После тренировки важно. Сегодня: ${Math.round(totalProtein)}г из ${proteinGoal}г`,
    });
  }
}

// Q1.3: Плохой сон → совет полегче
async function checkQ1_3(data, out) {
  const hours = data.duration_hours || 0;
  const quality = data.quality || 0;

  if (hours < 6 || quality <= 2) {
    out.push({
      type: 'easy_day',
      icon: '😴',
      title: 'Полегче сегодня',
      message: hours < 6
        ? `Только ${hours}ч сна. Отложите сложные задачи, если можно.`
        : 'Плохой сон. Не перегружайтесь сегодня.',
    });
  }
}

// Q1.4: Перерасход → готовить дома
async function checkQ1_4(data, out) {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  try {
    const budget = await db.budgets.where('month').equals(month).first();
    if (!budget?.total) return;

    const expenses = await db.expenses.where('date').between(month + '-01', month + '-31', true, true).toArray();
    const total = expenses.reduce((s, e) => s + (e.amount_base || e.amount || 0), 0);
    const pct = total / budget.total;

    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const expectedPct = dayOfMonth / daysInMonth;

    if (pct > expectedPct + 0.15) {
      // Проверить не показывали ли уже сегодня
      const lastShown = await getSetting('q1_4_last_shown');
      if (lastShown === today) return;
      await setSetting('q1_4_last_shown', today);

      out.push({
        type: 'overspend_warning',
        icon: '⚠️',
        title: 'Бюджет под угрозой',
        message: `Потрачено ${Math.round(pct * 100)}% бюджета при ожидаемых ${Math.round(expectedPct * 100)}%. Попробуйте готовить дома.`,
      });
    }
  } catch {}
}

// Q1.5: Вес растёт 3 замера подряд → предупредить
async function checkQ1_5(data, out) {
  try {
    const weights = await db.body_weight.orderBy('date').reverse().limit(3).toArray();
    if (weights.length < 3) return;

    if (weights[0].weight > weights[1].weight && weights[1].weight > weights[2].weight) {
      out.push({
        type: 'weight_trend',
        icon: '⚖️',
        title: 'Вес растёт 3 замера подряд',
        message: `${weights[2].weight} → ${weights[1].weight} → ${weights[0].weight} кг. Проверьте калории.`,
        actions: [
          { label: 'Посмотреть питание', action: 'navigate', params: { screen: 'nutrition' } },
        ],
      });
    }
  } catch {}
}

// Q1.6: Зарплата → предложить распределить
async function checkQ1_6(data, out) {
  const category = (data.category || '').toLowerCase();
  if (category.includes('зарплата') || category.includes('salary')) {
    out.push({
      type: 'salary_distribute',
      icon: '💰',
      title: 'Распределить по бюджету?',
      message: `Доход ${data.amount}₸. Обновить месячный бюджет?`,
      actions: [
        { label: 'К бюджету', action: 'navigate', params: { screen: 'finances' } },
      ],
    });
  }
}

// Q1.7: Пропущенная рутина → мягкое напоминание
async function checkQ1_7(data, out) {
  out.push({
    type: 'routine_missed',
    icon: '🔁',
    title: `Пропущена: ${data.name || 'рутина'}`,
    message: data.streak > 3
      ? `Серия ${data.streak} дней! Не сломайте 🔥`
      : 'Ещё не поздно выполнить',
  });
}

// Q1.8: Дивиденды — проверить ex-dates
async function checkQ1_8(out) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const divs = await db.dividends.where('ex_date').equals(today).toArray();
    for (const d of divs) {
      out.push({
        type: 'dividend_exdate',
        icon: '💵',
        title: `Дивиденд: ${d.ticker}`,
        message: `Сегодня ex-date. ${d.amount ? d.amount + '₸' : 'Записать доход?'}`,
      });
    }
  } catch {}
}

// Q1.9: Подписки — напомнить о списании
async function checkQ1_9(out) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const subs = await db.subscriptions.where('next_payment').equals(today).toArray();
    for (const s of subs) {
      out.push({
        type: 'subscription_payment',
        icon: '🔄',
        title: `Списание: ${s.name}`,
        message: `${s.amount}₸ сегодня. Записать расход?`,
        actions: [
          { label: 'Записать', action: 'auto_expense', params: { amount: s.amount, description: s.name, category: 'Подписки' } },
        ],
      });
    }
  } catch {}
}

// Q1.10: Задача с #покупки → предложить список покупок
async function checkQ1_10(data, out) {
  const tags = data.tags || [];
  const title = (data.title || '').toLowerCase();
  if (tags.includes('покупки') || tags.includes('shopping') || title.includes('купить') || title.includes('магазин')) {
    out.push({
      type: 'shopping_list',
      icon: '🛒',
      title: 'Добавить в список покупок?',
      message: `"${data.title}" похоже на покупку`,
      actions: [
        { label: 'В список', action: 'navigate', params: { screen: 'shopping-list' } },
      ],
    });
  }
}
