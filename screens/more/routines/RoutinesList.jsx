import { useState, useEffect, useCallback } from 'react';
import Card from '../../../components/Card';
import ProgressBar from '../../../components/ProgressBar';
import NavHeader from '../../../components/NavHeader';
import EmptyState from '../../../components/EmptyState';
import { getTodayRoutines, toggleRoutine, getDailyCompletion, getRoutineLog, getFullHeatmapData, addRoutine } from '../../../services/routines';
import VoiceAddButton from '../../../components/VoiceAddButton';
import Heatmap from '../../../components/Heatmap';
import SkeletonCard from '../../../components/SkeletonCard';
import Ic from '../../../components/Icon';


const TYPE_CFG = {
  morning: { e: '🌅', l: 'УТРО', name: 'Утренняя рутина' },
  household: { e: '☀️', l: 'ДЕНЬ', name: 'Дневная рутина' },
  evening: { e: '🌙', l: 'ВЕЧЕР', name: 'Вечерняя рутина' },
  health: { e: '❤️', l: 'ЗДОРОВЬЕ', name: 'Рутина здоровья' },
};

export default function RoutinesList({ theme, onBack, onAdd }) {
  const [routines, setRoutines] = useState(undefined);
  const [completion, setCompletion] = useState({ total: 0, completed: 0 });
  const [doneIds, setDoneIds] = useState(new Set());
  const [heatmapData, setHeatmapData] = useState([]);

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const todayR = await getTodayRoutines();
    const comp = await getDailyCompletion();
    const done = new Set();
    for (const r of todayR) { const log = await getRoutineLog(r.id, today); if (log?.completed) done.add(r.id); }
    setRoutines(todayR); setCompletion(comp); setDoneIds(done);

    // Heatmap: last 84 days
    try {
      const hd = await getFullHeatmapData(todayR.length || 1);
      setHeatmapData(hd);
    } catch { /* heatmap not critical */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id) => {
    await toggleRoutine(id, new Date().toISOString().slice(0, 10));
    await load();
  };

  /* M4.1: Skeleton while loading */
  if (routines === undefined) {
    return (
      <div className="flex flex-col gap-3 px-4 pt-2 pb-28">
        <NavHeader title="Рутины" onBack={onBack} theme={theme} />
        <SkeletonCard theme={theme} />
        <SkeletonCard variant="compact" theme={theme} />
        <SkeletonCard variant="compact" theme={theme} />
      </div>
    );
  }

  if (routines !== undefined && routines.length === 0) {
    return (
      <div className="flex flex-col gap-3 px-4 pt-2 pb-28">
        <NavHeader title="Рутины" onBack={onBack} theme={theme} />
        <EmptyState
          iconName="repeat" iconColor={theme.accent}
          title="Нет рутин"
          subtitle="Создайте утреннюю привычку"
          tip="Выполняйте каждый день — серия 🔥 будет мотивировать"
          actionLabel="＋ Рутина"
          onAction={onAdd}
          theme={theme}
        />
      </div>
    );
  }

  const groups = {};
  (routines || []).forEach(r => { const t = r.type || 'household'; if (!groups[t]) groups[t] = []; groups[t].push(r); });

  return (
    <div className="flex flex-col gap-3 px-4 pt-2 pb-28">
      <NavHeader title="Рутины" onBack={onBack} theme={theme} />
      <div className="px-1">
        <p style={{ color: theme.gray1, fontSize: 13 }}>
          {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>
      {/* Heatmap — 12 недель активности */}
      {heatmapData.length > 0 && (
        <Card theme={theme}>
          <p className="text-xs font-semibold mb-2" style={{ color: theme.gray1 }}>АКТИВНОСТЬ (12 НЕДЕЛЬ)</p>
          <Heatmap data={heatmapData} theme={theme} />
        </Card>
      )}
      {['morning','household','evening','health'].map(type => {
        const items = groups[type]; if (!items?.length) return null;
        const cfg = TYPE_CFG[type];
        const groupDone = items.filter(r => doneIds.has(r.id)).length;
        const allDone = groupDone === items.length;
        const groupColor = allDone ? (theme.green || '#34C759') : (theme.accent || '#007AFF');
        const maxStreak = Math.max(0, ...items.map(r => r.streak || 0));
        return (
          <Card key={type} theme={theme} style={{ padding: '14px 14px 10px' }}>
            {/* Header row */}
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center shrink-0" style={{ width: 28, height: 28, borderRadius: 8, background: groupColor }}>
                  <svg width={15} height={15} viewBox="0 0 24 24"><g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="17,1 21,5 17,9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7,23 3,19 7,15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></g></svg>
                </div>
                <div>
                  <div className="font-semibold" style={{ color: theme.text, fontSize: 15 }}>{cfg.name}</div>
                  <div className="text-xs" style={{ color: theme.gray2 }}>
                    {maxStreak > 0 && <><Ic name="flame" color={theme.orange} size={14} r={4} raw /> <span style={{ color: theme.orange }}>{maxStreak} дн</span> серия</>}
                  </div>
                </div>
              </div>
              <div className="font-bold" style={{ color: groupColor, fontSize: 14 }}>{groupDone}/{items.length}</div>
            </div>
            {/* Progress bar */}
            <div className="mb-2">
              <ProgressBar value={groupDone} max={items.length || 1} color={groupColor} height={4} theme={theme} />
            </div>
            {/* Items with circle checkboxes */}
            {items.map(r => {
              const done = doneIds.has(r.id);
              return (
                <button key={r.id} onClick={() => handleToggle(r.id)} className="flex items-center gap-2 w-full text-left active:opacity-70" style={{ padding: '6px 0' }}>
                  <div className="flex items-center justify-center shrink-0" style={{
                    width: 20, height: 20, borderRadius: 10,
                    background: done ? (theme.green || '#34C759') : 'transparent',
                    border: done ? 'none' : `2px solid ${theme.gray3 || '#C7C7CC'}`,
                  }}>
                    {done && <span className="text-white" style={{ fontSize: 10, fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{
                    fontSize: 14,
                    color: done ? (theme.gray2 || '#AEAEB2') : theme.text,
                    textDecoration: done ? 'line-through' : 'none',
                  }}>{r.name}</span>
                  {r.streak > 0 && (
                    <span className="ml-auto text-[10px] flex items-center gap-0.5" style={{ color: theme.orange }}><Ic name="flame" color={theme.orange} size={12} r={3} raw />{r.streak}</span>
                  )}
                  {r.time && !done && !r.streak && (
                    <span className="ml-auto text-[10px] flex items-center gap-0.5" style={{ color: theme.gray2 }}><Ic name="clock" color={theme.gray2} size={12} r={3} raw /> {r.time}</span>
                  )}
                </button>
              );
            })}
          </Card>
        );
      })}
      <div className="flex gap-2">
        <button onClick={onAdd} className="flex-1 py-3 rounded-2xl text-sm font-semibold text-center" style={{ background: theme.accent, color: '#fff' }}>＋ Новая рутина</button>
        <VoiceAddButton
          theme={theme}
          hint="Скажите название рутины"
          onResult={async (text) => {
            if (text.trim()) {
              await addRoutine({ name: text.trim(), type: 'morning', frequency: 'daily' });
              load();
            }
          }}
        />
      </div>
    </div>
  );
}
