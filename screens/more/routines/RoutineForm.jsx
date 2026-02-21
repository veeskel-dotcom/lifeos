import { useState } from 'react';
import Card from '../../../components/Card';
import NavHeader from '../../../components/NavHeader';
import { addRoutine, updateRoutine } from '../../../services/routines';
import IOSKeyboardSpacer from '../../../components/IOSKeyboardSpacer';
import FormInput from '../../../components/FormInput';
import DatePicker from '../../../components/DatePicker';

const TYPES = [
  { value: 'morning', emoji: '🌅', label: 'Утро' },
  { value: 'household', emoji: '☀️', label: 'День' },
  { value: 'evening', emoji: '🌙', label: 'Вечер' },
  { value: 'health', emoji: '❤️', label: 'Здоровье' },
];

const FREQUENCIES = [
  { value: 'daily', label: 'Каждый день' },
  { value: 'weekly', label: 'По дням недели' },
  { value: 'monthly', label: 'Ежемесячно' },
  { value: 'custom', label: 'Каждые N дней' },
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export default function RoutineForm({ theme, onBack, onSave, existing }) {
  const [name, setName] = useState(existing?.name || '');
  const [type, setType] = useState(existing?.type || 'morning');
  const [frequency, setFrequency] = useState(existing?.frequency || 'daily');
  const [days, setDays] = useState(existing?.days || []);
  const [intervalDays, setIntervalDays] = useState(existing?.interval_days || 2);
  const [time, setTime] = useState(existing?.time || '');
  const [errors, setErrors] = useState({});

  const toggleDay = (d) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleSave = async () => {
    const e = {};
    if (!name.trim()) e.name = 'Введите название';
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    const data = {
      name: name.trim(),
      type, frequency, time: time || null,
      days: frequency === 'weekly' ? days : frequency === 'monthly' ? days : null,
      interval_days: frequency === 'custom' ? intervalDays : null,
      is_active: true,
    };
    if (existing?.id) {
      await updateRoutine(existing.id, data);
    } else {
      data.streak = 0;
      data.best_streak = 0;
      await addRoutine(data);
    }
    onSave?.();
  };

  return (
    <div className="flex flex-col gap-3 px-4 pt-2 pb-28">
      <NavHeader
        title={existing ? 'Редактировать' : 'Новая рутина'}
        onBack={onBack}
        theme={theme}
        rightAction={{ label: 'Готово', onClick: handleSave }}
      />

      <Card theme={theme}>
        <FormInput value={name} onChange={setName} placeholder="Название рутины" autoFocus theme={theme} />
        {errors.name && <p className="text-xs mt-1" style={{ color: theme.red }}>{errors.name}</p>}
      </Card>

      {/* Тип */}
      <Card theme={theme}>
        <p className="text-xs font-semibold mb-2" style={{ color: theme.gray1 }}>ТИП</p>
        <div className="grid grid-cols-4 gap-2">
          {TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className="flex flex-col items-center gap-1 py-2 rounded-xl transition-transform active:scale-95"
              style={{
                background: type === t.value ? theme.accent + '20' : theme.gray6,
                border: type === t.value ? `2px solid ${theme.accent}` : '2px solid transparent',
              }}
            >
              <span>{t.emoji}</span>
              <span className="text-xs" style={{ color: theme.text }}>{t.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Частота */}
      <Card theme={theme}>
        <p className="text-xs font-semibold mb-2" style={{ color: theme.gray1 }}>ЧАСТОТА</p>
        <div className="flex flex-col gap-1">
          {FREQUENCIES.map(f => (
            <button
              key={f.value}
              onClick={() => setFrequency(f.value)}
              className="flex items-center gap-3 py-2 px-1 rounded-lg text-left"
              style={{ background: frequency === f.value ? theme.accent + '15' : 'transparent' }}
            >
              <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: frequency === f.value ? theme.accent : theme.gray3 }}>
                {frequency === f.value && (
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: theme.accent }} />
                )}
              </span>
              <span className="text-sm" style={{ color: theme.text }}>{f.label}</span>
            </button>
          ))}
        </div>

        {/* Дни недели */}
        {frequency === 'weekly' && (
          <div className="flex gap-1.5 mt-3">
            {WEEKDAYS.map((d, i) => {
              const dow = i + 1; // 1=Пн
              const sel = days.includes(dow);
              return (
                <button
                  key={dow}
                  onClick={() => toggleDay(dow)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium text-center"
                  style={{
                    background: sel ? theme.accent : theme.gray6,
                    color: sel ? '#fff' : theme.text,
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        )}

        {/* Интервал */}
        {frequency === 'custom' && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-sm" style={{ color: theme.text }}>Каждые</span>
            <input
              type="number"
              value={intervalDays}
              onChange={e => setIntervalDays(Math.max(2, Math.min(365, parseInt(e.target.value) || 2)))}
              className="w-16 text-center py-1 rounded-lg text-sm bg-transparent"
              style={{ color: theme.text, border: `1px solid ${theme.gray4}` }}
              min={2}
              max={365}
            />
            <span className="text-sm" style={{ color: theme.text }}>дней</span>
          </div>
        )}
      </Card>

      {/* Время */}
      <Card theme={theme}>
        <p className="text-xs font-semibold mb-2" style={{ color: theme.gray1 }}>ВРЕМЯ (необязательно)</p>
        <DatePicker value={time} onChange={setTime} mode="time" theme={theme} />
      </Card>
      <IOSKeyboardSpacer />
    </div>
  );
}
