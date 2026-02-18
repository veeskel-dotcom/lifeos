/**
 * WaterTracker — Водный баланс (встраивается в NutritionDiary).
 * Кнопки быстрого добавления + визуал кружков + прогресс.
 */
import { useState, useEffect, useCallback } from 'react';
import { addWater, getWaterProgress, getWaterForDay, removeWaterEntry, getWeeklyWaterAvg, getWeeklyWaterData } from '../../services/water';
import Ic from '../../components/Icon';

const QUICK_AMOUNTS = [150, 250, 350, 500];

function WaterRing({ current, goal, size = 120, theme }) {
  const pct = Math.min(current / goal, 1);
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const color = pct >= 1 ? theme.green : theme.accent;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={theme.gray5} strokeWidth={10} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <Ic name="drop" color={color} size={24} r={6} raw />
        <span className="text-xs font-bold tabular-nums mt-0.5" style={{ color: theme.text }}>
          {Math.round(pct * 100)}%
        </span>
      </div>
    </div>
  );
}

export default function WaterTracker({ date, theme, onUpdate }) {
  const [progress, setProgress] = useState({ current: 0, goal: 2000, percent: 0 });
  const [entries, setEntries] = useState([]);
  const [weekAvg, setWeekAvg] = useState(0);
  const [weekData, setWeekData] = useState([]);

  const load = useCallback(async () => {
    const [prog, data] = await Promise.all([
      getWaterProgress(date),
      getWaterForDay(date),
    ]);
    setProgress(prog);
    setEntries(data.entries);
    const avg = await getWeeklyWaterAvg();
    setWeekAvg(avg);
    const wd = await getWeeklyWaterData();
    setWeekData(wd);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (ml) => {
    await addWater(ml, date);
    await load();
    onUpdate?.();
  };

  const handleRemove = async (id) => {
    await removeWaterEntry(id);
    await load();
    onUpdate?.();
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: theme.card }}>
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Ic name="drop" color={theme.accent} size={22} r={6} raw />
          <span className="text-base font-semibold" style={{ color: theme.text }}>Вода</span>
        </div>
        <span className="text-sm" style={{ color: theme.gray1 }}>
          {progress.current} / {progress.goal} мл
        </span>
      </div>

      {/* Circular progress */}
      <div className="flex items-center gap-4 mb-3">
        <WaterRing current={progress.current} goal={progress.goal} theme={theme} />
        <div className="flex-1">
          <div className="text-lg font-bold tabular-nums" style={{ color: theme.text }}>
            {progress.current} мл
          </div>
          <div className="text-xs" style={{ color: theme.gray2 }}>
            из {progress.goal} мл · осталось {Math.max(0, progress.goal - progress.current)} мл
          </div>
          {weekAvg > 0 && (
            <div className="text-xs mt-1" style={{ color: theme.gray3 }}>
              ∅ за неделю: {weekAvg} мл/день
            </div>
          )}
        </div>
      </div>

      {/* Кнопки быстрого добавления */}
      <div className="flex gap-2">
        {QUICK_AMOUNTS.map(ml => (
          <button
            key={ml}
            onClick={() => handleAdd(ml)}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: theme.accent + '18',
              color: theme.accent,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            +{ml}мл
          </button>
        ))}
      </div>

      {/* Today log */}
      {entries.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: theme.gray2 }}>
            Сегодня
          </div>
          <div className="rounded-xl overflow-hidden" style={{ background: theme.gray6 }}>
            {[...entries].reverse().map((e, i) => (
              <div key={e.id} className="flex items-center gap-2.5 px-3 py-2"
                style={{ borderTop: i > 0 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                <Ic name="drop" color={theme.accent} size={28} r={8} />
                <span className="text-sm font-medium flex-1" style={{ color: theme.text }}>{e.amount_ml} мл</span>
                <span className="text-xs" style={{ color: theme.gray2 }}>{e.time}</span>
                <button onClick={() => handleRemove(e.id)}
                  className="text-xs px-1" style={{ color: theme.gray3, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week bar chart */}
      {weekData.length > 0 && (() => {
        const maxVal = Math.max(...weekData.map(d => d.value), progress.goal);
        return (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: theme.gray2 }}>
                Неделя
              </span>
              {weekAvg > 0 && (
                <span className="text-[10px]" style={{ color: theme.gray2 }}>
                  ∅ {weekAvg} мл/день
                </span>
              )}
            </div>
            <div className="flex items-end gap-1.5" style={{ height: 50, position: 'relative' }}>
              {/* Goal line */}
              <div style={{
                position: 'absolute', left: 0, right: 0,
                bottom: `${(progress.goal / maxVal) * 100}%`,
                height: 1, borderTop: `1px dashed ${theme.gray3}`, opacity: 0.5,
              }} />
              {weekData.map((d, i) => {
                const h = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full rounded-t-sm" style={{
                      height: `${Math.max(h, 2)}%`,
                      background: d.isToday ? theme.accent : d.value >= progress.goal ? theme.green : theme.accent + '40',
                      minHeight: 2,
                    }} />
                    <span className="text-[9px]" style={{
                      color: d.isToday ? theme.accent : theme.gray2, fontWeight: d.isToday ? 600 : 400,
                    }}>{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
