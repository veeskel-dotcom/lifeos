import { useState, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import ConfirmSheet from '../../components/ConfirmSheet';
import IOSKeyboardSpacer from '../../components/IOSKeyboardSpacer';
import { haptic } from '../../utils/ios';
import Ic from '../../components/Icon';
import {
  getTask,
  updateTask,
  deleteTask,
  toggleSubtask,
  addSubtask,
  removeSubtask,
  addComment,
  removeComment,
  addAttachment,
  removeAttachment,
} from '../../services/tasks';
import { getActiveProjects } from '../../services/projects';
import DatePicker from '../../components/DatePicker';

const PRIORITIES = [
  { id: 'urgent', label: '🔴 Срочно' },
  { id: 'important', label: '🟠 Важно' },
  { id: 'normal', label: '🔵 Обычный' },
  { id: 'low', label: '⚪ Низкий' },
];

const PRIORITY_COLORS = {
  urgent: '#FF3B30',
  important: '#FF9500',
  normal: '#007AFF',
  low: '#AEAEB2',
};

const RECURRENCE_OPTIONS = [
  { value: null, label: 'Нет' },
  { value: 'daily', label: 'Каждый день' },
  { value: 'weekly', label: 'Каждую неделю' },
  { value: 'monthly', label: 'Каждый месяц' },
  { value: 'weekdays', label: 'По дням' },
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/* ═══ Simple Markdown renderer ═══ */
function renderMarkdown(text, theme) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    // Headers
    if (line.startsWith('### '))
      return <p key={i} className="text-sm font-bold mt-2" style={{ color: theme.text }}>{line.slice(4)}</p>;
    if (line.startsWith('## '))
      return <p key={i} className="text-base font-bold mt-2" style={{ color: theme.text }}>{line.slice(3)}</p>;
    if (line.startsWith('# '))
      return <p key={i} className="text-lg font-bold mt-2" style={{ color: theme.text }}>{line.slice(2)}</p>;

    // Checklist
    if (line.startsWith('- [x] '))
      return <p key={i} className="text-sm ml-2" style={{ color: theme.gray2, textDecoration: 'line-through' }}>☑ {line.slice(6)}</p>;
    if (line.startsWith('- [ ] '))
      return <p key={i} className="text-sm ml-2" style={{ color: theme.text }}>☐ {line.slice(6)}</p>;

    // Bullet
    if (line.startsWith('- '))
      return <p key={i} className="text-sm ml-2" style={{ color: theme.text }}>• {line.slice(2)}</p>;

    // Bold (escape HTML first to prevent XSS)
    const escaped = line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const bold = escaped.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    if (bold !== escaped)
      return <p key={i} className="text-sm" style={{ color: theme.text }} dangerouslySetInnerHTML={{ __html: bold }} />;

    // Empty line
    if (!line.trim()) return <div key={i} className="h-2" />;

    // Regular
    return <p key={i} className="text-sm" style={{ color: theme.text }}>{line}</p>;
  });
}

/* ═══ MAIN COMPONENT ═══ */

export default function TaskDetail({ taskId, theme, onBack }) {
  const [task, setTask] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [deadlineTime, setDeadlineTime] = useState('');
  const [priority, setPriority] = useState('normal');
  const [tag, setTag] = useState('');
  const [recurrenceType, setRecurrenceType] = useState(null);
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [projects, setProjects] = useState([]);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  /* Load task */
  useEffect(() => {
    if (!taskId) return;
    getTask(taskId).then((t) => {
      if (!t) return;
      setTask(t);
      setTitle(t.title || '');
      setDescription(t.description || '');
      setDeadline(t.deadline || '');
      setDeadlineTime(t.deadline_time || '');
      setPriority(t.priority || 'normal');
      setTag((t.tags || [])[0] || '');
      setRecurrenceType(t.recurrence?.type || null);
      setRecurrenceDays(t.recurrence?.days || []);
    });
  }, [taskId]);

  /* B1.4: Load projects for assignment */
  useEffect(() => { getActiveProjects().then(setProjects).catch(() => {}); }, []);

  /* ═══ ACTIONS ═══ */

  const handleAssignProject = async (projectId) => {
    await updateTask(taskId, { project_id: projectId || null });
    setShowProjectPicker(false);
    const t = await getTask(taskId);
    if (t) setTask(t);
  };

  const handleSave = async () => {
    await updateTask(taskId, {
      title,
      description,
      deadline: deadline || null,
      deadline_time: deadlineTime || null,
      priority,
      tags: tag ? [tag] : [],
      recurrence: recurrenceType
        ? {
            type: recurrenceType,
            days: recurrenceType === 'weekdays' ? recurrenceDays : null,
            interval: 1,
          }
        : null,
    });
    const updated = await getTask(taskId);
    setTask(updated);
    setEditMode(false);
    haptic('success');
  };

  const handleDelete = async () => {
    await deleteTask(taskId);
    onBack();
  };

  const handleToggleStatus = async () => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    await updateTask(taskId, {
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    });
    const updated = await getTask(taskId);
    setTask(updated);
    haptic(newStatus === 'done' ? 'success' : 'light');
  };

  /* ═══ SUBTASK ACTIONS ═══ */

  const handleToggleSub = async (subId) => {
    const updated = await toggleSubtask(taskId, subId);
    if (updated) setTask(updated);
    haptic('light');
  };

  const handleAddSub = async () => {
    if (!newSubtask.trim()) return;
    const updated = await addSubtask(taskId, newSubtask.trim());
    if (updated) setTask(updated);
    setNewSubtask('');
    haptic('light');
  };

  const handleRemoveSub = async (subId) => {
    const updated = await removeSubtask(taskId, subId);
    if (updated) setTask(updated);
  };

  /* ═══ RENDER ═══ */

  if (!task) return null;

  const isDone = task.status === 'done';
  const subtasks = task.subtasks || [];
  const subtasksDone = subtasks.filter((s) => s.done).length;

  return (
    <div className="flex flex-col h-full">
      <NavHeader
        title="Задача"
        onBack={onBack}
        right={
          editMode ? (
            <button
              onClick={handleSave}
              style={{ color: title.trim() ? theme.accent : theme.gray3, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
            >
              Сохранить
            </button>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              style={{ color: theme.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
            >
              Править
            </button>
          )
        }
        theme={theme}
      />

      <div className="flex-1 overflow-auto px-4 pb-8">
        {/* Status + Title */}
        <div className="flex items-start gap-3 mb-3">
          <button
            onClick={handleToggleStatus}
            className="flex items-center justify-center shrink-0 mt-0.5"
            style={{
              width: 28, height: 28, borderRadius: 14,
              border: isDone ? 'none' : `2.5px solid ${PRIORITY_COLORS[task.priority] || theme.gray3}`,
              background: isDone ? theme.green : 'transparent',
              cursor: 'pointer',
            }}
          >
            {isDone && <span className="text-white text-xs">✓</span>}
          </button>

          {editMode ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 font-bold bg-transparent outline-none"
              style={{ color: theme.text, fontSize: 22 }}
              placeholder="Название задачи"
            />
          ) : (
            <div className="flex-1">
              <span
                className="font-bold"
                style={{
                  color: isDone ? theme.gray2 : theme.text,
                  textDecoration: isDone ? 'line-through' : 'none',
                  fontSize: 22,
                }}
              >
                {task.title}
              </span>
              {task.deadline && task.deadline < new Date().toISOString().split('T')[0] && !isDone && (
                <div className="text-sm font-medium mt-0.5" style={{ color: theme.red }}>
                  Просрочена
                </div>
              )}
            </div>
          )}
        </div>

        {/* Properties card (proto S2) */}
        {!editMode && (
          <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            {[
              task.project_id && {
                iconName: 'archive', color: theme.accent,
                label: 'Проект',
                value: projects.find(p => p.id === task.project_id)?.name || 'Проект',
              },
              {
                iconName: 'flag', color: PRIORITY_COLORS[task.priority] || theme.accent,
                label: 'Приоритет',
                value: PRIORITIES.find(p => p.id === task.priority)?.label?.replace(/^[^ ]+ /, '') || 'Обычный',
              },
              task.deadline && {
                iconName: 'calendar',
                color: task.deadline < new Date().toISOString().split('T')[0] && !isDone ? theme.red : theme.accent,
                label: 'Дедлайн',
                value: `${task.deadline}${task.deadline_time ? ' ' + task.deadline_time : ''}`,
              },
              task.recurrence && {
                iconName: 'repeat', color: theme.teal || '#30B0C7',
                label: 'Повтор',
                value: RECURRENCE_OPTIONS.find(o => o.value === task.recurrence?.type)?.label || '',
              },
              task.reminder_at && {
                iconName: 'bell', color: theme.orange,
                label: 'Напоминание',
                value: new Date(task.reminder_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
              },
            ].filter(Boolean).map((row, i, arr) => (
              <div key={i} className="flex items-center gap-2.5"
                style={{ padding: '11px 14px', borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                <Ic name={row.iconName} color={row.color} size={24} r={6} />
                <span className="flex-1 text-sm" style={{ color: theme.gray1 }}>{row.label}</span>
                <span className="text-sm font-medium" style={{ color: theme.text }}>{row.value}</span>
              </div>
            ))}
            {/* Tags */}
            {(task.tags || []).length > 0 && (
              <div className="flex items-center gap-2.5"
                style={{ padding: '11px 14px', borderTop: `0.5px solid ${theme.gray5}` }}>
                <Ic name="flag" color={theme.accent} size={16} r={4} raw />
                <span className="flex-1 text-sm" style={{ color: theme.gray1 }}>Теги</span>
                <span className="text-sm" style={{ color: theme.gray2 }}>{(task.tags || []).join(', ')}</span>
              </div>
            )}
          </Card>
        )}

        {/* Description / Notes */}
        {editMode ? (
          <Card theme={theme} style={{ marginBottom: 16 }}>
            <p className="text-xs font-semibold mb-1" style={{ color: theme.gray1 }}>Описание</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl p-3 text-sm outline-none resize-none"
              style={{ background: theme.gray6, color: theme.text, minHeight: 120, border: 'none' }}
              placeholder="Markdown..."
            />
          </Card>
        ) : task.description ? (
          <Card theme={theme} style={{ marginBottom: 16 }}>
            {renderMarkdown(task.description, theme)}
          </Card>
        ) : null}

        {/* ═══ T8: SUBTASKS ═══ */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
              Подзадачи
              {subtasks.length > 0 && (
                <span className="ml-1" style={{ color: subtasksDone === subtasks.length ? theme.green : theme.gray2 }}>
                  {subtasksDone}/{subtasks.length}
                </span>
              )}
            </span>
          </div>

          {subtasks.length > 0 && (
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              {subtasks.map((sub, i) => (
                <div key={sub.id}>
                  {i > 0 && <div className="mx-4" style={{ borderTop: `0.5px solid ${theme.gray5}` }} />}
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      onClick={() => handleToggleSub(sub.id)}
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        border: sub.done ? 'none' : `1.5px solid ${theme.gray3}`,
                        background: sub.done ? theme.green : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {sub.done && <span className="text-white text-[9px]">✓</span>}
                    </button>
                    <span
                      className="flex-1 text-sm"
                      style={{
                        color: sub.done ? theme.gray2 : theme.text,
                        textDecoration: sub.done ? 'line-through' : 'none',
                      }}
                    >
                      {sub.title}
                    </span>
                    <button
                      onClick={() => handleRemoveSub(sub.id)}
                      className="text-xs shrink-0"
                      style={{ color: theme.gray3, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* Add subtask inline */}
          <div className="flex items-center gap-2">
            <input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSub()}
              placeholder="Добавить подзадачу..."
              className="flex-1 text-sm py-2 px-3 rounded-xl outline-none"
              style={{ background: theme.gray6, color: theme.text, border: 'none' }}
            />
            <button
              onClick={handleAddSub}
              className="px-3 py-2 rounded-xl text-sm font-medium"
              style={{
                background: newSubtask.trim() ? theme.accent : theme.gray5,
                color: newSubtask.trim() ? '#fff' : theme.gray3,
                border: 'none',
                cursor: newSubtask.trim() ? 'pointer' : 'default',
              }}
            >
              +
            </button>
          </div>
        </div>

        {/* B2.2: Comments */}
        <CommentsSection taskId={task?.id} comments={task?.comments || []} theme={theme} onUpdate={load} />

        {/* B2.3: Attachments */}
        <AttachmentsSection taskId={task?.id} attachments={task?.attachments || []} theme={theme} onUpdate={load} />

        {/* ═══ Action buttons (proto S2) ═══ */}
        {!editMode && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleToggleStatus}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-center"
              style={{ background: isDone ? theme.gray5 : theme.green, color: isDone ? theme.text : '#fff', border: 'none', cursor: 'pointer' }}
            >
              {isDone ? '↩ Вернуть' : '✓ Выполнено'}
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="py-3 px-4 rounded-xl text-sm font-semibold"
              style={{ background: (theme.red || '#FF3B30') + '10', color: theme.red, border: 'none', cursor: 'pointer' }}
            >
              Удалить
            </button>
          </div>
        )}

        {/* ═══ EDIT MODE: Priority, Deadline, Recurrence ═══ */}
        {editMode && (
          <>
            {/* Deadline */}
            <Card theme={theme} style={{ marginBottom: 12 }}>
              <p className="text-xs font-semibold mb-2" style={{ color: theme.gray1 }}>Дедлайн</p>
              <div className="flex gap-2">
                <div onClick={() => setShowDeadlinePicker(true)}
                  className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl text-sm cursor-pointer"
                  style={{ background: theme.gray6, color: deadline ? theme.text : theme.gray3 }}>
                  <span className="inline-flex items-center gap-1"><Ic name="calendar" color={theme.accent} size={14} r={3} raw /> {deadline || 'Дедлайн'}</span>
                </div>
                {deadline && (
                  <DatePicker value={deadlineTime} onChange={setDeadlineTime} mode="time" theme={theme} />
                )}
              </div>
            </Card>

            {/* Priority */}
            <Card theme={theme} style={{ marginBottom: 12 }}>
              <p className="text-xs font-semibold mb-2" style={{ color: theme.gray1 }}>Приоритет</p>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPriority(p.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium"
                    style={{
                      background: priority === p.id ? theme.accent + '15' : theme.gray6,
                      color: priority === p.id ? theme.accent : theme.gray1,
                      border: priority === p.id ? `1.5px solid ${theme.accent}` : '1px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </Card>

            {/* Tag */}
            <Card theme={theme} style={{ marginBottom: 12 }}>
              <p className="text-xs font-semibold mb-2" style={{ color: theme.gray1 }}>Тег</p>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="работа, дом..."
                className="w-full text-sm py-2 px-3 rounded-xl outline-none"
                style={{ background: theme.gray6, color: theme.text, border: 'none' }}
              />
            </Card>

            {/* Recurrence */}
            <Card theme={theme} style={{ marginBottom: 12 }}>
              <p className="text-xs font-semibold uppercase mb-2" style={{ color: theme.gray1 }}>Повторение</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {RECURRENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value || 'none'}
                    onClick={() => setRecurrenceType(opt.value)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium"
                    style={{
                      background: recurrenceType === opt.value ? theme.accent + '15' : theme.gray6,
                      color: recurrenceType === opt.value ? theme.accent : theme.gray1,
                      border: recurrenceType === opt.value ? `1.5px solid ${theme.accent}` : '1px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {recurrenceType === 'weekdays' && (
                <div className="flex gap-1.5 mb-2">
                  {WEEKDAYS.map((d, i) => {
                    const dow = i + 1;
                    const sel = recurrenceDays.includes(dow);
                    return (
                      <button
                        key={dow}
                        onClick={() => setRecurrenceDays((prev) => sel ? prev.filter((x) => x !== dow) : [...prev, dow])}
                        className="flex-1 py-2 rounded-lg text-xs font-medium text-center"
                        style={{
                          background: sel ? theme.accent : theme.gray6,
                          color: sel ? '#fff' : theme.text,
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Delete */}
            <button
              onClick={() => setShowDelete(true)}
              className="w-full py-3 rounded-xl text-sm font-medium mb-4"
              style={{ background: theme.red + '15', color: theme.red, border: 'none', cursor: 'pointer' }}
            >
              <span className="inline-flex items-center gap-1"><Ic name="trash" color={theme.red} size={14} r={4} raw /> Удалить задачу</span>
            </button>
          </>
        )}
      </div>

      {/* B1.4: Project picker */}
      {showProjectPicker && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowProjectPicker(false)}>
          <div className="w-full rounded-t-2xl p-4 pb-8" style={{ background: theme.card }}
            onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold mb-3" style={{ color: theme.text }}>Выбрать проект</div>
            <div className="space-y-1">
              {projects.map(p => (
                <button key={p.id} onClick={() => handleAssignProject(p.id)}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm"
                  style={{
                    background: task?.project_id === p.id ? theme.accent + '15' : theme.gray6,
                    color: theme.text, border: 'none', cursor: 'pointer',
                  }}>
                  <span className="inline-flex items-center gap-1"><Ic name="archive" color={theme.accent} size={14} r={3} raw /> {p.name}</span>
                </button>
              ))}
              {task?.project_id && (
                <button onClick={() => handleAssignProject(null)}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm"
                  style={{ color: theme.red, background: 'none', border: 'none', cursor: 'pointer' }}>
                  ✕ Убрать из проекта
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {showDelete && (
        <ConfirmSheet
          title="Удалить задачу?"
          message="Это действие нельзя отменить"
          confirmLabel="Удалить"
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          theme={theme}
        />
      )}

      {/* ═══ VoiceBar (proto S2) ═══ */}
      {!editMode && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2"
          style={{ borderTop: `0.5px solid ${theme.gray5}`, background: theme.bg }}>
          <div className="flex items-center justify-center shrink-0"
            style={{ width: 40, height: 40, borderRadius: 20, background: theme.red || '#FF3B30', cursor: 'pointer' }}>
            <svg width={20} height={20} viewBox="0 0 24 24"><g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></g></svg>
          </div>
          <div className="flex-1 py-2.5 px-3.5 rounded-full text-sm"
            style={{ background: theme.card, border: `1px solid ${theme.gray4}`, color: theme.gray3 }}>
            Скажите или напишите...
          </div>
          <div className="flex items-center justify-center shrink-0"
            style={{ width: 36, height: 36, borderRadius: 18, background: theme.accent, cursor: 'pointer' }}>
            <span className="text-white text-base font-semibold">↑</span>
          </div>
        </div>
      )}

      <DatePicker open={showDeadlinePicker} onClose={() => setShowDeadlinePicker(false)} value={deadline} onChange={setDeadline} theme={theme} />

      <IOSKeyboardSpacer />
    </div>
  );
}

/* B2.2: Comments section */
function CommentsSection({ taskId, comments, theme, onUpdate }) {
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(comments.length > 0);

  const handleAdd = async () => {
    if (!text.trim() || !taskId) return;
    await addComment(taskId, text.trim());
    setText('');
    onUpdate?.();
  };

  const handleRemove = async (commentId) => {
    await removeComment(taskId, commentId);
    onUpdate?.();
  };

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' ' +
      d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card theme={theme} style={{ marginBottom: 12 }}>
      <button onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <span className="text-xs font-semibold" style={{ color: theme.gray1 }}>
          <span className="inline-flex items-center gap-1"><Ic name="edit" color={theme.gray1} size={12} r={3} raw /> Комментарии {comments.length > 0 && `(${comments.length})`}</span>
        </span>
        <span className="text-xs" style={{ color: theme.gray2 }}>{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {comments.map(c => (
            <div key={c.id} className="flex gap-2 items-start">
              <div className="flex-1 min-w-0 px-3 py-2 rounded-xl" style={{ background: theme.gray6 }}>
                <p className="text-xs" style={{ color: theme.text }}>{c.text}</p>
                <p className="text-[9px] mt-0.5" style={{ color: theme.gray3 }}>{fmtDate(c.created_at)}</p>
              </div>
              <button onClick={() => handleRemove(c.id)}
                className="text-[10px] px-1 mt-1" style={{ color: theme.gray3, background: 'none', border: 'none', cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Написать..."
              className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
              style={{ background: theme.gray6, color: theme.text }}
            />
            <button onClick={handleAdd}
              className="px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: text.trim() ? theme.accent : theme.gray5, color: text.trim() ? '#fff' : theme.gray3, border: 'none', cursor: 'pointer' }}>
              ↑
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* B2.3: Attachments section */
function AttachmentsSection({ taskId, attachments, theme, onUpdate }) {
  const fileRef = { current: null };
  const [expanded, setExpanded] = useState(attachments.length > 0);

  const handleAdd = async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Макс. 5 МБ'); return; }
    await addAttachment(taskId, file);
    onUpdate?.();
  };

  const handleRemove = async (id) => {
    await removeAttachment(taskId, id);
    onUpdate?.();
  };

  const fmtSize = (bytes) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} КБ`;
    return `${(bytes / 1048576).toFixed(1)} МБ`;
  };

  return (
    <Card theme={theme} style={{ marginBottom: 12 }}>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setExpanded(!expanded)}
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: theme.gray1, background: 'none', border: 'none', cursor: 'pointer' }}>
          <span className="inline-flex items-center gap-1"><Ic name="download" color={theme.gray1} size={12} r={3} raw /> Вложения ({attachments.length}) {expanded ? '▼' : '▶'}</span>
        </button>
        <button onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,.pdf,.doc,.docx'; inp.onchange = handleAdd; inp.click(); }}
          className="text-xs px-2 py-0.5 rounded"
          style={{ background: theme.accent + '15', color: theme.accent, border: 'none', cursor: 'pointer' }}>
          ＋
        </button>
      </div>
      {expanded && attachments.map(a => (
        <div key={a.id} className="flex items-center gap-2 py-1.5"
          style={{ borderTop: `0.5px solid ${theme.gray5}` }}>
          {a.type?.startsWith('image/') ? (
            <img src={a.data} alt="" className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: theme.gray6 }}><Ic name="note" color={theme.gray2} size={20} r={5} raw /></div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs truncate" style={{ color: theme.text }}>{a.name}</div>
            <div className="text-[10px]" style={{ color: theme.gray2 }}>{fmtSize(a.size)}</div>
          </div>
          <button onClick={() => handleRemove(a.id)}
            className="text-xs" style={{ color: theme.red, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      ))}
    </Card>
  );
}
