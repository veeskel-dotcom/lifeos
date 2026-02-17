import { useState, useMemo } from 'react';
import Card from '../../../components/Card';
import NavHeader from '../../../components/NavHeader';
import { addSleep, updateSleep } from '../../../services/sleep';
import IOSKeyboardSpacer from '../../../components/IOSKeyboardSpacer';
import DatePicker from '../../../components/DatePicker';

export default function SleepForm({ theme, onBack, onSave, existing }) {
  const [bedTime, setBedTime] = useState(existing?.bed_time?.slice(11, 16) || '23:00');
  const [wakeTime, setWakeTime] = useState(existing?.wake_time?.slice(11, 16) || '07:00');
  const [quality, setQuality] = useState(existing?.quality || 7);
  const [notes, setNotes] = useState(existing?.notes || '');
  /* H1: detailed sleep quality */
  const [interruptions, setInterruptions] = useState(existing?.interruptions || 0);
  const [factors, setFactors] = useState(existing?.factors || []);

  const SLEEP_FACTORS = [
    { id: 'caffeine', emoji: '☕', label: 'Кофеин' },
    { id: 'exercise', emoji: '🏋️', label: 'Спорт' },
    { id: 'screen', emoji: '📱', label: 'Экраны' },
    { id: 'stress', emoji: '😰', label: 'Стресс' },
    { id: 'alcohol', emoji: '🍷', label: 'Алкоголь' },
    { id: 'heavy_meal', emoji: '🍕', label: 'Тяжёлая еда' },
    { id: 'nap', emoji: '😴', label: 'Дневной сон' },
  ];

  const toggleFactor = (id) => {
    setFactors(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  // Автоматический расчёт длительности
  const duration = useMemo(() => {
    const [bh, bm] = bedTime.split(':').map(Number);
    const [wh, wm] = wakeTime.split(':').map(Number);
    let bedMin = bh * 60 + bm;
    let wakeMin = wh * 60 + wm;
    if (wakeMin <= bedMin) wakeMin += 1440; // следующий день
    return Math.round((wakeMin - bedMin) / 60 * 10) / 10;
  }, [bedTime, wakeTime]);

  const fmtDuration = (h) => {
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return `${hrs}ч ${mins}м`;
  };

  const handleSave = async () => {
    const today = new Date().toISOString().slice(0, 10);
    // bed_time = вчера или сегодня (если >12:00 = сегодня, иначе вчера + время)
    const [bh] = bedTime.split(':').map(Number);
    const bedDate = bh >= 12 ? new Date(new Date(today).setDate(new Date(today).getDate() - 1)) : new Date(today);
    const bedISO = bedDate.toISOString().slice(0, 10) + 'T' + bedTime + ':00';
    const wakeISO = today + 'T' + wakeTime + ':00';

    const data = {
      date: today,
      bed_time: bedISO,
      wake_time: wakeISO,
      quality,
      notes: notes || null,
      interruptions,
      factors: factors.length ? factors : null,
    };

    if (existing?.id) {
      await updateSleep(existing.id, data);
    } else {
      await addSleep(data);
    }
    onSave?.();
  };

  return (
    <div className="flex flex-col gap-3 px-4 pt-2 pb-28">
      <NavHeader
        title="Записать сон"
        onBack={onBack}
        theme={theme}
        rightAction={{ label: 'Готово', onClick: handleSave }}
      />

      {/* Длительность */}
      <Card theme={theme}>
        <div className="text-center py-2">
          <p className="text-3xl font-bold tabular-nums" style={{
            color: duration >= 7 ? theme.green : duration >= 6 ? theme.yellow : theme.red,
          }}>
            {fmtDuration(duration)}
          </p>
          <p className="text-sm mt-1" style={{ color: theme.gray1 }}>длительность сна</p>
        </div>
      </Card>

      {/* Время */}
      <Card theme={theme}>
        <div className="flex gap-4">
          <div className="flex-1">
            <p className="text-xs mb-1" style={{ color: theme.gray1 }}>🌙 Лёг спать</p>
            <DatePicker value={bedTime} onChange={setBedTime} mode="time" theme={theme} />
          </div>
          <div className="w-px" style={{ background: theme.gray4 }} />
          <div className="flex-1">
            <p className="text-xs mb-1" style={{ color: theme.gray1 }}>☀️ Проснулся</p>
            <DatePicker value={wakeTime} onChange={setWakeTime} mode="time" theme={theme} />
          </div>
        </div>
      </Card>

      {/* Качество */}
      <Card theme={theme}>
        <p className="text-xs font-semibold mb-2" style={{ color: theme.gray1 }}>КАЧЕСТВО СНА</p>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1} max={10}
            value={quality}
            onChange={e => setQuality(parseInt(e.target.value))}
            className="flex-1"
            style={{ accentColor: theme.accent }}
          />
          <span className="text-lg font-bold tabular-nums w-10 text-center" style={{
            color: quality >= 7 ? theme.green : quality >= 4 ? theme.yellow : theme.red,
          }}>
            {quality}
          </span>
        </div>
        <div className="flex justify-between text-xs mt-1" style={{ color: theme.gray2 }}>
          <span>😫 Ужасно</span>
          <span>🔥 Отлично</span>
        </div>
      </Card>

      {/* H1: Interruptions */}
      <Card theme={theme}>
        <p className="text-xs font-semibold mb-2" style={{ color: theme.gray1 }}>ПРОБУЖДЕНИЯ НОЧЬЮ</p>
        <div className="flex items-center gap-3">
          {[0, 1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setInterruptions(n)}
              className="w-9 h-9 rounded-full text-sm font-semibold"
              style={{
                background: interruptions === n ? theme.accent : theme.gray6,
                color: interruptions === n ? '#fff' : theme.text,
              }}>{n === 5 ? '5+' : n}</button>
          ))}
        </div>
      </Card>

      {/* H1: Factors */}
      <Card theme={theme}>
        <p className="text-xs font-semibold mb-2" style={{ color: theme.gray1 }}>ЧТО ПОВЛИЯЛО</p>
        <div className="flex flex-wrap gap-2">
          {SLEEP_FACTORS.map(f => (
            <button key={f.id} onClick={() => toggleFactor(f.id)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{
                background: factors.includes(f.id) ? theme.accent + '15' : theme.gray6,
                color: factors.includes(f.id) ? theme.accent : theme.gray1,
                border: factors.includes(f.id) ? `1.5px solid ${theme.accent}` : '1.5px solid transparent',
              }}>
              {f.emoji} {f.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Заметки */}
      <Card theme={theme}>
        <p className="text-xs font-semibold mb-1" style={{ color: theme.gray1 }}>ЗАМЕТКИ</p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Долго засыпал, проснулся среди ночи..."
          className="w-full min-h-16 text-sm bg-transparent outline-none resize-none"
          style={{ color: theme.text }}
        />
      </Card>
      <IOSKeyboardSpacer />
    </div>
  );
}
