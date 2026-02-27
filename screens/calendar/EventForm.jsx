import { useState } from 'react';
import { addEvent, updateEvent, deleteEvent } from '../../services/events';
import { createReminder } from '../../services/reminders';
import SelectSheet from '../../components/SelectSheet';

const EVENT_TYPES = [
  { id: 'work', label: '💼 Работа' },
  { id: 'personal', label: '👤 Личное' },
  { id: 'event', label: '🎂 Событие' },
  { id: 'health', label: '🏥 Здоровье' },
];

const REPEAT_OPTIONS = [
  { value: 'none', label: '🔁 Не повторяется' },
  { value: 'daily', label: '🔁 Каждый день' },
  { value: 'weekly', label: '🔁 Каждую неделю' },
  { value: 'monthly', label: '🔁 Каждый месяц' },
  { value: 'yearly', label: '🔁 Каждый год' },
];

const REMIND_OPTIONS = [
  { value: 0, label: '🔔 В момент' },
  { value: 15, label: '🔔 За 15 мин' },
  { value: 30, label: '🔔 За 30 мин' },
  { value: 60, label: '🔔 За 1 час' },
  { value: 1440, label: '🔔 За 1 день' },
  { value: -1, label: '🔔 Без напоминания' },
];

const parseTime = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function EventForm({ theme, onBack, initialDate, existing }) {
  const [title, setTitle] = useState(existing?.title || '');
  const [date, setDate] = useState(initialDate || existing?.date || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(parseTime(existing?.start) || '10:00');
  const [endTime, setEndTime] = useState(parseTime(existing?.end) || '11:00');
  const [type, setType] = useState(existing?.type || 'personal');
  const [location, setLocation] = useState(existing?.location || '');
  const [notes, setNotes] = useState(existing?.description || '');
  const [recurrence, setRecurrence] = useState(existing?.recurrence || 'none');
  const [reminderMin, setReminderMin] = useState(existing?.reminder_min ?? 15);
  const [linkedTask] = useState(existing?.linked_task || null);
  const [showRepeat, setShowRepeat] = useState(false);
  const [showRemind, setShowRemind] = useState(false);
  const [errors, setErrors] = useState({});

  const fmtDate = (d) => {
    if (!d) return 'Выбрать';
    return new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleSave = async () => {
    const e = {};
    if (!title.trim()) e.title = 'Введите название';
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    const startISO = `${date}T${startTime}:00`;
    const endISO = endTime ? `${date}T${endTime}:00` : null;
    const data = {
      title: title.trim(), date, start: startISO, end: endISO,
      type, location, description: notes,
      reminder_min: reminderMin >= 0 ? reminderMin : null,
      recurrence: recurrence !== 'none' ? recurrence : null,
    };

    if (existing?.id) {
      await updateEvent(existing.id, data);
    } else {
      const event = await addEvent(data);
      if (reminderMin >= 0 && event) {
        const triggerAt = new Date(startISO);
        triggerAt.setMinutes(triggerAt.getMinutes() - reminderMin);
        await createReminder('event', event.id, triggerAt.toISOString(), `${title} через ${reminderMin} мин`);
      }
    }
    onBack();
  };

  const handleDelete = async () => {
    if (!existing?.id) return;
    if (!confirm('Удалить событие?')) return;
    await deleteEvent(existing.id);
    onBack();
  };

  const selectedDay = parseInt(date.slice(8));
  const inputStyle = { background: theme.gray5, borderRadius: 10, padding: '11px 14px', fontSize: 15, color: theme.text, border: 'none', outline: 'none', width: '100%' };
  const dropStyle = { background: theme.gray5, borderRadius: 10, padding: '11px 14px', fontSize: 14, color: theme.text, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' };

  return (
    <div className="flex flex-col h-full" style={{ background: theme.bg, position: 'relative' }}>
      {/* Blurred calendar background */}
      <div style={{ opacity: 0.4, padding: '8px 16px' }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: theme.text, textAlign: 'center', padding: '8px 0' }}>
          {new Date(date + 'T00:00:00').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center', fontSize: 12, marginBottom: 8 }}>
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
            <div key={d} style={{ color: theme.gray2, padding: 4 }}>{d}</div>
          ))}
          {Array.from({ length: 28 }, (_, i) => (
            <div key={i} style={{
              padding: 4, borderRadius: 8,
              background: i + 1 === selectedDay ? theme.accent + '15' : 'transparent',
              color: i + 1 === selectedDay ? theme.accent : theme.text,
              fontWeight: i + 1 === selectedDay ? 700 : 400,
            }}>{i + 1}</div>
          ))}
        </div>
        {/* Event preview bar */}
        <div style={{ padding: '8px 0', borderTop: `0.5px solid ${theme.gray5}` }}>
          <div className="flex items-center" style={{ gap: 8, padding: '6px 0' }}>
            <div style={{ width: 4, height: 28, borderRadius: 2, background: theme.accent }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: theme.text }}>{title || 'Новое событие'}</div>
              <div style={{ fontSize: 11, color: theme.gray2 }}>{startTime} – {endTime}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, top: 220,
        background: theme.card, borderRadius: '20px 20px 0 0',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
        padding: '12px 16px 32px',
        overflowY: 'auto',
      }}>
        {/* Pill handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: theme.gray3, margin: '0 auto 14px' }} />

        {/* Header: Событие + Удалить */}
        <div className="flex justify-between items-center" style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: theme.text }}>Событие</span>
          {existing?.id && (
            <span onClick={handleDelete} style={{ fontSize: 14, color: theme.red, cursor: 'pointer', fontWeight: 500 }}>Удалить</span>
          )}
        </div>

        {/* Название */}
        <div style={{ fontSize: 12, color: theme.gray2, marginBottom: 4, fontWeight: 500 }}>Название</div>
        <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="Встреча с клиентом" />
        {errors.title && <p className="text-xs mt-1" style={{ color: theme.red }}>{errors.title}</p>}
        <div style={{ height: 12 }} />

        {/* Тип — 4 chips */}
        <div style={{ fontSize: 12, color: theme.gray2, marginBottom: 4, fontWeight: 500 }}>Тип</div>
        <div className="flex" style={{ gap: 6, marginBottom: 12 }}>
          {EVENT_TYPES.map(t => (
            <div key={t.id} onClick={() => setType(t.id)} className="cursor-pointer" style={{
              padding: '6px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500,
              background: type === t.id ? theme.accent + '15' : theme.gray5,
              color: type === t.id ? theme.accent : theme.gray2,
              border: type === t.id ? `1.5px solid ${theme.accent}` : '1.5px solid transparent',
            }}>{t.label}</div>
          ))}
        </div>

        {/* Дата + Время (3 колонки) */}
        <div className="flex" style={{ gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: theme.gray2, marginBottom: 4, fontWeight: 500 }}>Дата</div>
            <div style={dropStyle}>
              <span>{fmtDate(date)}</span>
              <span style={{ color: theme.gray3 }}>▾</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: theme.gray2, marginBottom: 4, fontWeight: 500 }}>Начало</div>
            <div style={dropStyle}>
              <span>{startTime}</span>
              <span style={{ color: theme.gray3 }}>▾</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: theme.gray2, marginBottom: 4, fontWeight: 500 }}>Конец</div>
            <div style={dropStyle}>
              <span>{endTime}</span>
              <span style={{ color: theme.gray3 }}>▾</span>
            </div>
          </div>
        </div>

        {/* Место */}
        <div style={{ fontSize: 12, color: theme.gray2, marginBottom: 4, fontWeight: 500 }}>Место</div>
        <div style={{ ...dropStyle, marginBottom: 12 }}>
          <input value={location} onChange={e => setLocation(e.target.value)}
            placeholder="📍 Офис, Тверская 12"
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: theme.text, flex: 1 }} />
          <span style={{ color: theme.gray3 }}>▾</span>
        </div>

        {/* Повтор + Напоминание (2 колонки) */}
        <div className="flex" style={{ gap: 8, marginBottom: 12 }}>
          <div onClick={() => setShowRepeat(true)} style={{ ...dropStyle, flex: 1, fontSize: 14 }}>
            <span>{REPEAT_OPTIONS.find(o => o.value === recurrence)?.label}</span>
            <span style={{ color: theme.gray3 }}>▾</span>
          </div>
          <div onClick={() => setShowRemind(true)} style={{ ...dropStyle, flex: 1, fontSize: 14 }}>
            <span>{REMIND_OPTIONS.find(o => o.value === reminderMin)?.label}</span>
            <span style={{ color: theme.gray3 }}>▾</span>
          </div>
        </div>

        {/* Связать с задачей */}
        <div style={{ ...dropStyle, marginBottom: 12 }}>
          <span>🔗 Связать с задачей</span>
          <span style={{ color: theme.gray3 }}>{linkedTask || 'Нет'} ▾</span>
        </div>

        {/* Заметки */}
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Заметки (опционально)" rows={2}
          style={{ ...inputStyle, resize: 'none', marginBottom: 14, minHeight: 40 }} />

        {/* Сохранить */}
        <button onClick={handleSave} className="w-full"
          style={{ padding: 14, background: title.trim() ? theme.accent : theme.gray3, borderRadius: 12, textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
          Сохранить
        </button>
      </div>

      {/* Select sheets */}
      <SelectSheet open={showRepeat} onClose={() => setShowRepeat(false)} title="Повтор"
        options={REPEAT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
        selected={recurrence} onSelect={(v) => { setRecurrence(v); setShowRepeat(false); }} theme={theme} />
      <SelectSheet open={showRemind} onClose={() => setShowRemind(false)} title="Напоминание"
        options={REMIND_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
        selected={reminderMin} onSelect={(v) => { setReminderMin(v); setShowRemind(false); }} theme={theme} />
    </div>
  );
}
