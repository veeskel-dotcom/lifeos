// ═══ Валидация AI-действий перед записью в БД ═══

import db from '../db/index';

const ACTION_ALLOWLIST = [
  'add_expense', 'add_expense_quick', 'add_income', 'add_transfer', 'add_task', 'complete_task',
  'log_food', 'add_food', 'log_water', 'log_workout', 'log_weight', 'log_mood', 'log_sleep',
  'add_event', 'add_reminder', 'add_to_shopping_list',
  'add_routine', 'add_note',
  'query_expenses', 'query_tasks', 'query_nutrition',
  'save_memory', 'forget_memory', 'web_search',
  'navigate', 'answer', 'undo_last',
];

const VALIDATION_RULES = {
  add_expense: (p) => {
    const errors = [];
    if (!p.amount || p.amount <= 0) errors.push('Сумма должна быть > 0');
    if (p.amount > 10_000_000) errors.push('Сумма слишком большая');
    if (p.date && p.date > addDays(0, 7)) errors.push('Дата > 7 дней в будущем');
    if (p.date && p.date < addDays(0, -365)) errors.push('Дата > 1 года назад');
    return errors;
  },
  add_income: (p) => {
    const errors = [];
    if (!p.amount || p.amount <= 0) errors.push('Сумма должна быть > 0');
    if (p.amount > 100_000_000) errors.push('Сумма слишком большая');
    return errors;
  },
  add_task: (p) => {
    const errors = [];
    if (!p.title || p.title.length === 0) errors.push('Название обязательно');
    if (p.title && p.title.length > 500) errors.push('Название слишком длинное');
    return errors;
  },
  log_water: (p) => {
    const errors = [];
    if (!p.amount_ml || p.amount_ml <= 0) errors.push('Количество должно быть > 0');
    if (p.amount_ml > 5000) errors.push('Больше 5 литров за раз?');
    return errors;
  },
  log_food: (p) => {
    const errors = [];
    if (!p.items || p.items.length === 0) errors.push('Нет продуктов');
    return errors;
  },
};

// Нужно ли подтверждение?
export function needsConfirmation(action, params) {
  const reasons = [];

  if (action === 'add_expense' && params.amount > 10000) {
    reasons.push('large_amount');
  }
  if (action === 'add_income' && params.amount > 100000) {
    reasons.push('large_amount');
  }
  if (params.date && params.date !== new Date().toISOString().split('T')[0]) {
    reasons.push('not_today');
  }

  return reasons.length > 0 ? reasons : false;
}

// Валидация действия
export async function validateAction(action, params) {
  // 1. Allowlist
  if (!ACTION_ALLOWLIST.includes(action)) {
    return { valid: false, reason: `Неизвестное действие: ${action}` };
  }

  // 2. action: null = просто ответ, всегда валиден
  if (action === null || action === 'answer' || action === 'navigate') {
    return { valid: true };
  }

  // 3. Правила валидации
  const validate = VALIDATION_RULES[action];
  if (validate) {
    const errors = validate(params);
    if (errors.length > 0) {
      return { valid: false, reason: errors.join('; ') };
    }
  }

  // 4. Ссылочная целостность
  if (params.category_id) {
    const cat = await db.categories.get(params.category_id);
    if (!cat) {
      // Fallback: категория "Прочее"
      const fallbackCat = await db.categories.where('name').equals('Прочее').first();
      params.category_id = fallbackCat?.id || 1;
      return { valid: true, warning: 'Категория не найдена — «Прочее»' };
    }
  }
  if (params.account_id) {
    const acc = await db.accounts.get(params.account_id);
    if (!acc) {
      return { valid: false, reason: 'Счёт не найден' };
    }
  }

  return { valid: true };
}

function addDays(offset, days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
