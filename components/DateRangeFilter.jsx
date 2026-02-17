/**
 * M2.2: Фильтр по дате — переиспользуемый компонент.
 * Быстрые пресеты + кастомный диапазон.
 */
import { useState } from 'react';

const PRESETS = [
  { id: 'today', label: 'Сегодня', fn: () => { const d = new Date().toISOString().slice(0, 10); return [d, d]; } },
  { id: 'week', label: 'Неделя', fn: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 7); return [s.toISOString().slice(0, 10), e.toISOString().slice(0, 10)]; } },
  { id: 'month', label: 'Месяц', fn: () => { const e = new Date(); const s = new Date(e.getFullYear(), e.getMonth(), 1); return [s.toISOString().slice(0, 10), e.toISOString().slice(0, 10)]; } },
  { id: '3m', label: '3 мес', fn: () => { const e = new Date(); const s = new Date(); s.setMonth(e.getMonth() - 3); return [s.toISOString().slice(0, 10), e.toISOString().slice(0, 10)]; } },
  { id: 'year', label: 'Год', fn: () => { const e = new Date(); const s = new Date(e.getFullYear(), 0, 1); return [s.toISOString().slice(0, 10), e.toISOString().slice(0, 10)]; } },
  { id: 'all', label: 'Все', fn: () => [null, null] },
];

export default function DateRangeFilter({ value, onChange, theme }) {
  const [showCustom, setShowCustom] = useState(false);
  const [from, setFrom] = useState(value?.from || '');
  const [to, setTo] = useState(value?.to || '');

  const activePreset = PRESETS.find(p => {
    const [pFrom, pTo] = p.fn();
    return value?.from === pFrom && value?.to === pTo;
  })?.id || (value?.from ? 'custom' : 'all');

  const handlePreset = (preset) => {
    const [f, t] = preset.fn();
    onChange({ from: f, to: t, preset: preset.id });
    setShowCustom(false);
  };

  const handleCustom = () => {
    onChange({ from: from || null, to: to || null, preset: 'custom' });
  };

  return (
    <div>
      <div className="flex gap-1.5 flex-wrap">
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => handlePreset(p)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium"
            style={{
              background: activePreset === p.id ? theme.accent + '15' : theme.gray6,
              color: activePreset === p.id ? theme.accent : theme.gray1,
              border: activePreset === p.id ? `1px solid ${theme.accent}30` : '1px solid transparent',
              cursor: 'pointer',
            }}>
            {p.label}
          </button>
        ))}
        <button onClick={() => setShowCustom(!showCustom)}
          className="px-2.5 py-1 rounded-lg text-[11px] font-medium"
          style={{
            background: activePreset === 'custom' ? theme.accent + '15' : theme.gray6,
            color: activePreset === 'custom' ? theme.accent : theme.gray1,
            border: activePreset === 'custom' ? `1px solid ${theme.accent}30` : '1px solid transparent',
            cursor: 'pointer',
          }}>
          📅
        </button>
      </div>

      {showCustom && (
        <div className="flex gap-2 mt-2 items-center">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-lg text-[11px] outline-none"
            style={{ background: theme.gray6, color: theme.text }} />
          <span className="text-xs" style={{ color: theme.gray3 }}>—</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-lg text-[11px] outline-none"
            style={{ background: theme.gray6, color: theme.text }} />
          <button onClick={handleCustom}
            className="px-2 py-1.5 rounded-lg text-[11px] font-medium"
            style={{ background: theme.accent, color: '#fff', border: 'none', cursor: 'pointer' }}>
            ✓
          </button>
        </div>
      )}
    </div>
  );
}
