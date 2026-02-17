import { useState, useMemo } from 'react';
import { useAllWorkouts } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';

import SkeletonList from '../../components/SkeletonList';
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const TYPE_ICONS = { gym: '🏋️', tennis: '🎾', skiing: '⛷', run: '🏃', swim: '🏊', other: '💪' };
const TYPE_LABELS = { gym: 'Зал', tennis: 'Теннис', skiing: 'Лыжи', run: 'Бег', swim: 'Плавание', other: 'Другое' };

export default function WorkoutHistory({ theme, onBack, onSelect }) {
  const [typeFilter, setTypeFilter] = useState(null);

  const workouts = useAllWorkouts();

  const filtered = useMemo(() => {
    if (!workouts) return null;
    let list = workouts.filter(w => w.status === 'done');
    if (typeFilter) list = list.filter(w => w.type === typeFilter);
    return list;
  }, [workouts, typeFilter]);

  const grouped = useMemo(() => {
    if (!filtered) return null;
    const g = {};
    filtered.forEach(w => {
      const key = w.date.slice(0, 7); // '2026-02'
      if (!g[key]) g[key] = [];
      g[key].push(w);
    });
    return Object.entries(g).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  if (!grouped) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
        <NavHeader title="История" onBack={onBack} left="Спорт" theme={theme} />
        <div className="p-4">
          <SkeletonList count={5} theme={theme} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="История" onBack={onBack} left="Спорт" theme={theme} />

      {/* Type filter */}
      <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
        <button
          onClick={() => setTypeFilter(null)}
          className="px-3 py-1.5 rounded-full whitespace-nowrap" style={{ fontSize: 12, fontWeight: 500, background: !typeFilter ? theme.accent : theme.gray5, color: !typeFilter ? '#fff' : theme.text }}
        >
          Все
        </button>
        {Object.entries(TYPE_LABELS).map(([id, label]) => (
          <button key={id}
            onClick={() => setTypeFilter(typeFilter === id ? null : id)}
            className="px-3 py-1.5 rounded-full whitespace-nowrap" style={{ fontSize: 12, fontWeight: 500, background: typeFilter === id ? theme.accent : theme.gray5, color: typeFilter === id ? '#fff' : theme.text }}
          >
            {TYPE_ICONS[id]} {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {/* Stats row */}
        {filtered && filtered.length > 0 && (() => {
          const now = new Date();
          const currentMonth = filtered.filter(w => w.date.slice(0, 7) === now.toISOString().slice(0, 7));
          const avgDur = currentMonth.length > 0
            ? Math.round(currentMonth.reduce((s, w) => s + (w.duration_min || 0), 0) / currentMonth.length)
            : 0;
          const totalVol = currentMonth.reduce((s, w) => s + (w.total_tonnage || 0), 0);
          return (
            <div className="flex gap-2 mb-4">
              {[
                { v: String(avgDur), l: 'За месяц', sub: 'мин/трен' },
                { v: String(currentMonth.length), l: 'Тренировок', sub: MONTHS[now.getMonth()]?.toLowerCase().slice(0, 7) || '' },
                { v: totalVol > 0 ? totalVol.toLocaleString('ru-RU') : '—', l: 'Объём (кг)', sub: 'этот мес' },
              ].map(s => (
                <div key={s.l} style={{ flex: 1, borderRadius: 12, padding: '10px 10px', textAlign: 'center',
                  background: theme.card, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: theme.text }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: theme.gray2 }}>{s.l}</div>
                  <div style={{ fontSize: 10, color: theme.gray3 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Calendar heatmap */}
        {filtered && filtered.length > 0 && (() => {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth();
          const firstDay = new Date(year, month, 1).getDay() || 7; // Mon=1
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const today = now.getDate();
          const trainedDays = new Set(
            filtered
              .filter(w => w.date.slice(0, 7) === now.toISOString().slice(0, 7))
              .map(w => parseInt(w.date.slice(8, 10)))
          );
          const blanks = firstDay - 1;
          return (
            <div className="mb-4">
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1, textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: 4 }}>
                {MONTHS[month]}
              </div>
              <Card theme={theme} style={{ padding: '12px 14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                    <div key={d} style={{ fontSize: 10, color: theme.gray2, textAlign: 'center' }}>{d}</div>
                  ))}
                  {Array(blanks).fill(0).map((_, i) => <div key={`b${i}`} />)}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                    const trained = trainedDays.has(d);
                    const isToday = d === today;
                    return (
                      <div key={d} style={{
                          aspectRatio: '1', borderRadius: 6, fontSize: 12,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isToday ? theme.accent : trained ? theme.green + '30' : theme.gray5,
                          color: isToday ? '#fff' : trained ? theme.green : theme.text,
                          fontWeight: isToday ? 700 : 400,
                        }}>
                        {d}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          );
        })()}

        {grouped.length === 0 ? (
          <EmptyState icon="🏋️" title="Нет тренировок" subtitle="Начните первую тренировку" tip="Создайте шаблон для быстрого старта" theme={theme} />
        ) : (
          grouped.map(([monthKey, items]) => {
            const [y, m] = monthKey.split('-');
            const monthTotal = items.reduce((s, w) => s + (w.total_tonnage || 0), 0);
            return (
              <div key={monthKey} className="mb-4">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                    {MONTHS[parseInt(m) - 1]} {y}
                  </span>
                  {monthTotal > 0 && (
                    <span style={{ fontSize: 12, color: theme.gray2 }}>
                      {monthTotal.toLocaleString('ru-RU')} кг
                    </span>
                  )}
                </div>
                <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
                  {items.map((w, i) => {
                    const colors = [theme.red, theme.accent, theme.purple || '#AF52DE', theme.orange, theme.green || '#34C759'];
                    const d = new Date(w.date + 'T00:00:00');
                    return (
                      <div key={w.id}
                        onClick={() => onSelect(w.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer',
                          borderBottom: i < items.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: colors[i % colors.length] + '15',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                          {TYPE_ICONS[w.type] || '💪'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: theme.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {w.name}
                            {(w.pr_count > 0) && (
                              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 9999, fontWeight: 700, background: '#FFD60A', color: '#000' }}>
                                {w.pr_count} PR
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: theme.gray2, marginTop: 1 }}>
                            {d.getDate()} {MONTHS[d.getMonth()].toLowerCase().slice(0, 3)}
                            {w.duration_min ? ` · ${w.duration_min} мин` : ''}
                            {w.exercises?.length ? ` · ${w.exercises.reduce((s, e) => s + (e.sets?.length || 0), 0)} подходов` : ''}
                          </div>
                        </div>
                        {w.total_tonnage > 0 && (
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{w.total_tonnage.toLocaleString('ru-RU')} кг</div>
                            <div style={{ fontSize: 10, color: theme.gray2 }}>объём</div>
                          </div>
                        )}
                        <span style={{ color: theme.gray3, fontSize: 16 }}>→</span>
                      </div>
                    );
                  })}
                </Card>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
