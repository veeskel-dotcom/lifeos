import db from '../db/index';
import { emit } from './triggerBus';

const today = () => new Date().toISOString().split('T')[0];

export async function addTask(data) {
  try {
    const task = {
      title: data.title,
      description: data.description || '',
      status: 'todo',
      priority: data.priority || 'normal',
      deadline: data.deadline || null,
      deadline_time: data.deadline_time || null,
      project_id: data.project_id || null,
      tags: data.tags || [],
      subtasks: data.subtasks || [],
      recurrence: data.recurrence || null,
      completed_at: null,
      created_at: new Date().toISOString(),
    };
    const id = await db.tasks.add(task);
    emit('task_added', { title: task.title, tags: task.tags }).catch(() => {});
    return { ...task, id };

  } catch (e) {
    console.error('[tasks.addTask]', e);
    throw e;
  }
}

export async function getTask(id) {
  try {
    return db.tasks.get(id);

  } catch (e) {
    console.error('[tasks.getTask]', e);
    return null;
  }
}

export async function updateTask(id, data) {
  try {
    await db.tasks.update(id, data);
    return db.tasks.get(id);

  } catch (e) {
    console.error('[tasks.updateTask]', e);
    throw e;
  }
}

export async function deleteTask(id) {
  try {
    await db.tasks.delete(id);

  } catch (e) {
    console.error('[tasks.deleteTask]', e);
    throw e;
  }
}

export async function toggleTask(id) {
  try {
    const task = await db.tasks.get(id);
    if (!task) return null;

    if (task.status !== 'done' && task.recurrence) {
      return completeRecurringTask(id);
    }

    const isDone = task.status === 'done';
    await db.tasks.update(id, {
      status: isDone ? 'todo' : 'done',
      completed_at: isDone ? null : new Date().toISOString(),
    });
    return db.tasks.get(id);

  } catch (e) {
    console.error('[tasks.toggleTask]', e);
    throw e;
  }
}

export async function completeRecurringTask(id) {
  try {
    const task = await db.tasks.get(id);
    if (!task || !task.recurrence) return null;

    await db.tasks.update(id, {
      status: 'done',
      completed_at: new Date().toISOString(),
    });

    const nextDeadline = calcNextDate(task.deadline || today(), task.recurrence);

    const next = {
      title: task.title,
      description: task.description || '',
      status: 'todo',
      priority: task.priority,
      deadline: nextDeadline,
      deadline_time: task.deadline_time || null,
      project_id: task.project_id || null,
      tags: task.tags || [],
      subtasks: (task.subtasks || []).map(s => ({ ...s, done: false })),
      recurrence: task.recurrence,
      completed_at: null,
      created_at: new Date().toISOString(),
    };
    const newId = await db.tasks.add(next);
    return { ...next, id: newId };

  } catch (e) {
    console.error('[tasks.completeRecurringTask]', e);
    throw e;
  }
}

function calcNextDate(fromDate, recurrence) {
  const d = new Date(fromDate + 'T00:00:00');
  const interval = recurrence.interval || 1;

  switch (recurrence.type) {
    case 'daily':
      d.setDate(d.getDate() + interval);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7 * interval);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + interval);
      break;
    case 'weekdays': {
      const targetDays = recurrence.days || [];
      for (let i = 1; i <= 7; i++) {
        const next = new Date(d);
        next.setDate(next.getDate() + i);
        const dow = next.getDay() === 0 ? 7 : next.getDay();
        if (targetDays.includes(dow)) return next.toISOString().split('T')[0];
      }
      d.setDate(d.getDate() + 1);
      break;
    }
  }
  return d.toISOString().split('T')[0];
}

export async function getTasks({ status, priority, dateFrom, dateTo, tag } = {}) {
  try {
    let collection = db.tasks.toCollection();

    if (status) {
      collection = db.tasks.where('status').equals(status);
    }

    let results = await collection.toArray();

    if (priority) {
      results = results.filter(t => t.priority === priority);
    }
    if (dateFrom) {
      results = results.filter(t => t.deadline && t.deadline >= dateFrom);
    }
    if (dateTo) {
      results = results.filter(t => t.deadline && t.deadline <= dateTo);
    }
    if (tag) {
      results = results.filter(t => t.tags?.includes(tag));
    }

    return results;

  } catch (e) {
    console.error('[tasks.getTasks]', e);
    return [];
  }
}

export async function getTaskStats() {
  try {
    const all = await db.tasks.toArray();
    const d = today();
    return {
      total: all.length,
      done: all.filter(x => x.status === 'done').length,
      overdue: all.filter(x => x.status !== 'done' && x.deadline && x.deadline < d).length,
      todayCount: all.filter(x => x.deadline === d).length,
    };

  } catch (e) {
    console.error('[tasks.getTaskStats]', e);
    return [];
  }
}

export async function toggleSubtask(taskId, subtaskId) {
  try {
    const task = await db.tasks.get(taskId);
    if (!task) return null;
    const subtasks = (task.subtasks || []).map(s =>
      s.id === subtaskId ? { ...s, done: !s.done } : s
    );
    await db.tasks.update(taskId, { subtasks });
    return db.tasks.get(taskId);

  } catch (e) {
    console.error('[tasks.toggleSubtask]', e);
    throw e;
  }
}

export async function addSubtask(taskId, title) {
  try {
    const task = await db.tasks.get(taskId);
    if (!task) return null;

    const subtasks = [...(task.subtasks || []), {
      id: 's' + Date.now(),
      title,
      done: false,
    }];
    await db.tasks.update(taskId, { subtasks });
    return db.tasks.get(taskId);

  } catch (e) {
    console.error('[tasks.addSubtask]', e);
    throw e;
  }
}

export async function removeSubtask(taskId, subtaskId) {
  try {
    const task = await db.tasks.get(taskId);
    if (!task) return null;

    const subtasks = (task.subtasks || []).filter(s => s.id !== subtaskId);
    await db.tasks.update(taskId, { subtasks });
    return db.tasks.get(taskId);

  } catch (e) {
    console.error('[tasks.removeSubtask]', e);
    throw e;
  }
}

export function groupTasks(tasks) {
  const d = today();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tom = tomorrow.toISOString().split('T')[0];

  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
  const we = weekEnd.toISOString().split('T')[0];

  const active = tasks.filter(x => x.status !== 'done' && x.status !== 'cancelled');
  const done = tasks.filter(x => x.status === 'done');

  const groups = [];

  const overdue = active.filter(x => x.deadline && x.deadline < d);
  if (overdue.length) groups.push({ label: 'Просроченные', items: overdue, type: 'overdue' });

  const todayTasks = active.filter(x => x.deadline === d);
  if (todayTasks.length) groups.push({ label: 'Сегодня', items: todayTasks, type: 'today' });

  const tomorrowTasks = active.filter(x => x.deadline === tom);
  if (tomorrowTasks.length) groups.push({ label: 'Завтра', items: tomorrowTasks, type: 'tomorrow' });

  const weekTasks = active.filter(x => x.deadline && x.deadline > tom && x.deadline <= we);
  if (weekTasks.length) groups.push({ label: 'На этой неделе', items: weekTasks, type: 'week' });

  const laterTasks = active.filter(x => x.deadline && x.deadline > we);
  if (laterTasks.length) groups.push({ label: 'Позже', items: laterTasks, type: 'later' });

  const noDate = active.filter(x => !x.deadline);
  if (noDate.length) groups.push({ label: 'Без даты', items: noDate, type: 'nodate' });

  if (done.length) groups.push({ label: 'Выполнено', items: done.slice(0, 20), type: 'done' });

  return groups;
}

/* ═══ B2.4 — Продуктивность задач ═══ */

export async function getProductivityStats() {
  try {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const all = await db.tasks.toArray();
    const done = all.filter(t => t.status === 'done' && t.completed_at);

    const thisWeek = done.filter(t => new Date(t.completed_at) >= weekAgo).length;
    const thisMonth = done.filter(t => new Date(t.completed_at) >= monthAgo).length;

    let streak = 0;
    const checkDate = new Date();
    for (let i = 0; i < 365; i++) {
      const ds = checkDate.toISOString().slice(0, 10);
      const completed = done.some(t => t.completed_at?.startsWith(ds));
      if (completed) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    const byDay = [0, 0, 0, 0, 0, 0, 0];
    const LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    done.filter(t => new Date(t.completed_at) >= monthAgo).forEach(t => {
      const d = new Date(t.completed_at).getDay();
      byDay[d === 0 ? 6 : d - 1]++;
    });

    return {
      thisWeek,
      thisMonth,
      streak,
      total: done.length,
      byDay: LABELS.map((label, i) => ({ label, count: byDay[i] })),
    };
  } catch {
    return { thisWeek: 0, thisMonth: 0, streak: 0, total: 0, byDay: [] };
  }
}

/**
 * B2.2: Комментарии к задаче (хранятся как массив в задаче).
 */
export async function addComment(taskId, text) {
  const task = await db.tasks.get(taskId);
  if (!task) throw new Error('Задача не найдена');
  const comments = task.comments || [];
  comments.push({
    id: Date.now().toString(36),
    text,
    created_at: new Date().toISOString(),
  });
  return db.tasks.update(taskId, { comments });
}

export async function removeComment(taskId, commentId) {
  const task = await db.tasks.get(taskId);
  if (!task) return;
  const comments = (task.comments || []).filter(c => c.id !== commentId);
  return db.tasks.update(taskId, { comments });
}

/**
 * B2.3: Вложения к задаче — фото/файлы как base64.
 */
export async function addAttachment(taskId, file) {
  const task = await db.tasks.get(taskId);
  if (!task) throw new Error('Задача не найдена');
  
  const data = await readFileAsBase64(file);
  const attachments = task.attachments || [];
  attachments.push({
    id: Date.now().toString(36),
    name: file.name,
    type: file.type,
    size: file.size,
    data,
    created_at: new Date().toISOString(),
  });
  return db.tasks.update(taskId, { attachments });
}

export async function removeAttachment(taskId, attachmentId) {
  const task = await db.tasks.get(taskId);
  if (!task) return;
  const attachments = (task.attachments || []).filter(a => a.id !== attachmentId);
  return db.tasks.update(taskId, { attachments });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
