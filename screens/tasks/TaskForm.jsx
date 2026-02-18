import { useState, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import { addTask } from '../../services/tasks';
import { createReminder } from '../../services/reminders';
import { getAreas } from '../../services/areas';
import { getActiveProjects } from '../../services/projects';
import IOSKeyboardSpacer from '../../components/IOSKeyboardSpacer';
import DatePicker from '../../components/DatePicker';
import Ic from '../../components/Icon';

const PRIORITIES = [
  { id: 'urgent', label: '🔴 Срочная' },
  { id: 'important', label: '🟠 Важная' },
  { id: 'normal', label: '🔵 Обычная' },
  { id: 'low', label: '⚪ Низкая' },
];

export default function TaskForm({ theme, onBack }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [priority, setPriority] = useState('normal');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState({});
  /* B1.8: Кастомное напоминание */
  const [reminderOffset, setReminderOffset] = useState('30');
  /* B1.3: Areas */
  const [area, setArea] = useState('');
  const [areas, setAreas] = useState([]);
  /* B1.2: Projects */
  const [projectId, setProjectId] = useState(null);
  const [projects, setProjects] = useState([]);
  useEffect(() => {
    getAreas().then(setAreas);
    getActiveProjects().then(setProjects);
  }, []);

  const handleSave = async () => {
    const e = {};
    if (!title.trim()) e.title = 'Введите название задачи';
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});

    const task = await addTask({
      title: title.trim(),
      description,
      deadline: deadline || null,
      deadline_time: deadlineTime || null,
      priority,
      tags: tags.length > 0 ? tags : [],
      area: area || null,
      project_id: projectId || null,
    });

    // B1.8: Создать напоминание с кастомным смещением
    if (deadline && deadlineTime && reminderOffset !== 'none') {
      const triggerAt = new Date(`${deadline}T${deadlineTime}:00`);
      const mins = parseInt(reminderOffset);
      triggerAt.setMinutes(triggerAt.getMinutes() - mins);
      const label = mins >= 60 ? `${title} через ${mins / 60} ч` : `${title} через ${mins} мин`;
      await createReminder('task', task.id, triggerAt.toISOString(), label);
    }

    onBack();
  };

  return (
    <div className="flex flex-col h-full">
      <NavHeader
        title="Новая задача"
        onBack={onBack}
        right={
          <button onClick={handleSave} style={{ color: title.trim() ? theme.accent : theme.gray3 }}>
            Готово
          </button>
        }
        theme={theme}
      />

      <div className="flex-1 overflow-auto px-4 pb-8">
        {/* Title */}
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); setErrors(prev => ({...prev, title: null})); }}
          className="w-full text-lg font-semibold outline-none mb-1 rounded-xl px-4 py-3"
          style={{ color: theme.text, background: theme.gray6, border: errors.title ? `1px solid ${theme.red}` : 'none' }}
          placeholder="Название задачи"
          autoFocus
        />
        {errors.title && <span className="text-xs mb-2 block px-1" style={{ color: theme.red }}>{errors.title}</span>}

        {/* Description */}
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full rounded-xl p-3 text-sm outline-none resize-none mb-4"
          style={{ background: theme.gray6, color: theme.text, minHeight: 80, border: 'none' }}
          placeholder="Описание (необязательно)"
        />

        {/* Deadline */}
        <div className="flex gap-2 mb-4">
          <div className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl text-sm"
            style={{ background: theme.gray6, color: theme.text }}>
            <Ic name="calendar" color={theme.accent} size={16} r={4} raw />
            <span className="text-sm flex-1 cursor-pointer"
              onClick={() => setShowDeadlinePicker(true)}
              style={{ color: deadline ? theme.text : theme.gray3 }}>{deadline || 'Дедлайн'}</span>
          </div>
          {deadline && (
            <label className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm"
              style={{ background: theme.gray6, color: theme.text }}>
              <Ic name="clock" color={theme.accent} size={16} r={4} raw />
              <DatePicker value={deadlineTime} onChange={setDeadlineTime} mode="time" theme={theme} />
            </label>
          )}
        </div>

        {/* B1.8: Reminder offset */}
        {deadline && deadlineTime && (
          <div className="mb-4">
            <span className="text-xs font-semibold uppercase mb-2 block" style={{ color: theme.gray1 }}>
              Напоминание
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { v: 'none', label: 'Нет' },
                { v: '5', label: '5 мин' },
                { v: '15', label: '15 мин' },
                { v: '30', label: '30 мин' },
                { v: '60', label: '1 час' },
                { v: '1440', label: '1 день' },
              ].map(opt => (
                <button key={opt.v} onClick={() => setReminderOffset(opt.v)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium"
                  style={{
                    background: reminderOffset === opt.v ? theme.accent + '15' : theme.gray6,
                    color: reminderOffset === opt.v ? theme.accent : theme.gray1,
                    border: reminderOffset === opt.v ? `1.5px solid ${theme.accent}` : '1.5px solid transparent',
                  }}>{opt.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* Priority */}
        <span className="text-xs font-semibold uppercase mb-2 block" style={{ color: theme.gray1 }}>
          Приоритет
        </span>
        <div className="flex gap-2 mb-4">
          {PRIORITIES.map(p => (
            <button
              key={p.id}
              onClick={() => setPriority(p.id)}
              className="flex-1 py-2 rounded-xl text-xs font-medium"
              style={{
                background: priority === p.id ? theme.accent + '15' : theme.gray6,
                color: priority === p.id ? theme.accent : theme.gray1,
                border: priority === p.id ? `1.5px solid ${theme.accent}` : `1px solid transparent`,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* B1.6: Multiple tags */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                style={{ background: theme.accent + '15', color: theme.accent }}>
                🏷 {t}
                <button onClick={() => setTags(tags.filter((_, j) => j !== i))}
                  style={{ color: theme.gray2, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
              </span>
            ))}
          </div>
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                e.preventDefault();
                const newTag = tagInput.trim().replace(/,/g, '');
                if (newTag && !tags.includes(newTag)) setTags([...tags, newTag]);
                setTagInput('');
              }
            }}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: theme.gray6, color: theme.text }}
            placeholder="🏷 Добавить тег (Enter для добавления)"
          />
        </div>

        {/* B1.3: Area selector */}
        {areas.length > 0 && (
          <div className="mb-6">
            <span className="text-xs font-semibold uppercase tracking-wide mb-2 block"
              style={{ color: theme.gray1 }}>Сфера</span>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setArea('')}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium"
                style={{
                  background: !area ? theme.accent + '15' : theme.gray6,
                  color: !area ? theme.accent : theme.gray1,
                }}>Без сферы</button>
              {areas.map(a => (
                <button key={a.name} onClick={() => setArea(a.name)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-medium"
                  style={{
                    background: area === a.name ? (a.color || theme.accent) + '15' : theme.gray6,
                    color: area === a.name ? (a.color || theme.accent) : theme.gray1,
                    border: area === a.name ? `1.5px solid ${a.color || theme.accent}` : '1.5px solid transparent',
                  }}>{a.emoji} {a.name}</button>
              ))}
            </div>
          </div>
        )}

        {/* B1.2: Project selector */}
        {projects.length > 0 && (
          <div className="mb-6">
            <span className="text-xs font-semibold uppercase tracking-wide mb-2 block"
              style={{ color: theme.gray1 }}>Проект</span>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setProjectId(null)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium"
                style={{
                  background: !projectId ? theme.accent + '15' : theme.gray6,
                  color: !projectId ? theme.accent : theme.gray1,
                }}>Без проекта</button>
              {projects.map(p => (
                <button key={p.id} onClick={() => setProjectId(p.id)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-medium"
                  style={{
                    background: projectId === p.id ? (p.color || theme.accent) + '15' : theme.gray6,
                    color: projectId === p.id ? (p.color || theme.accent) : theme.gray1,
                    border: projectId === p.id ? `1.5px solid ${p.color || theme.accent}` : '1.5px solid transparent',
                  }}>{p.icon} {p.name}</button>
              ))}
            </div>
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="w-full py-3.5 rounded-xl text-white text-base font-semibold"
          style={{ background: title.trim() ? theme.accent : theme.gray3 }}
        >
          Создать задачу
        </button>
      </div>

      <DatePicker open={showDeadlinePicker} onClose={() => setShowDeadlinePicker(false)} value={deadline} onChange={setDeadline} theme={theme} />
      <IOSKeyboardSpacer />
    </div>
  );
}
