import { useLiveQuery } from '../../hooks/useDB';
import Card from '../../components/Card';
import ProgressBar from '../../components/ProgressBar';
import ProgressRing from '../../components/ProgressRing';
import TabBar from '../../components/TabBar';
import SkeletonCard from '../../components/SkeletonCard';

export default function HealthHub({ onNavigate, theme }) {
  const data = useLiveQuery(async () => {
    const db = (await import('../../db')).default;
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const [sleep, routines, water, nutrition, weight, workouts] = await Promise.all([
      db.sleep_log.where('date').equals(today).first().catch(() => null),
      db.routine_log.where('date').equals(today).toArray().catch(() => []),
      db.water_log.where('date').equals(today).toArray().catch(() => []),
      db.food_log.where('date').equals(today).toArray().catch(() => []),
      db.body_weight.orderBy('date').reverse().first().catch(() => null),
      db.workouts.orderBy('date').reverse().limit(1).toArray().catch(() => []),
    ]);

    // Sleep week data (last 7 days)
    const sleepWeek = [];
    for (let d = 6; d >= 0; d--) {
      const dt = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      const s = await db.sleep_log.where('date').equals(dt).first().catch(() => null);
      sleepWeek.push(s?.duration ? s.duration / 60 : 0);
    }

    // Routine streak
    let streakDays = 0;
    for (let d = 0; d < 365; d++) {
      const dt = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      const dayLogs = await db.routine_log.where('date').equals(dt).toArray().catch(() => []);
      if (dayLogs.some(r => r.completed)) { streakDays++; } else if (d > 0) break;
    }

    const weekWeights = await db.body_weight.where('date').between(weekAgo, today + '\uffff').toArray().catch(() => []);
    const totalRoutines = await db.routines.where('active').equals(1).count().catch(() => 0);
    const doneRoutines = routines.filter(r => r.completed).length;
    const waterMl = water.reduce((s, w) => s + (w.amount_ml || 0), 0);
    const waterGoal = (await db.settings.get('water_goal'))?.value || 2000;
    const nutritionGoal = (await db.settings.get('daily_calories'))?.value || 2200;
    const totalCal = nutrition.reduce((s, f) => s + (f.calories || 0), 0);
    const totalP = nutrition.reduce((s, f) => s + (f.protein || 0), 0);
    const totalF = nutrition.reduce((s, f) => s + (f.fat || 0), 0);
    const totalC = nutrition.reduce((s, f) => s + (f.carbs || 0), 0);

    const weightTrend = weekWeights.length >= 2
      ? weekWeights[weekWeights.length - 1].weight - weekWeights[0].weight
      : null;

    return {
      sleep, sleepWeek, doneRoutines, totalRoutines, streakDays,
      waterMl, waterGoal,
      totalCal, totalP, totalF, totalC, nutritionGoal,
      weight: weight?.weight, weightTrend,
      lastWorkout: workouts[0] || null,
    };
  });

  if (!data) return (
    <div style={{ background: theme.bg, minHeight: '100vh' }}>
      <div className="px-4 pt-14 pb-2">
        <div className="text-xl font-bold" style={{ color: theme.text }}>Здоровье</div>
      </div>
      <div className="px-4 space-y-3">
        <SkeletonCard theme={theme} />
        <SkeletonCard variant="compact" theme={theme} />
        <SkeletonCard variant="compact" theme={theme} />
      </div>
    </div>
  );

  const sleepH = data.sleep?.duration ? Math.floor(data.sleep.duration / 60) : null;
  const sleepM = data.sleep?.duration ? data.sleep.duration % 60 : null;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <div className="px-5 pt-2 pb-0.5">
        <div className="font-bold" style={{ color: theme.text, fontSize: 28 }}>Здоровье</div>
        <div style={{ color: theme.gray1, fontSize: 13 }}>
          {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {/* Sleep + Routines grid */}
        <div className="flex gap-2 mt-2">
          <Card theme={theme} style={{ flex: 1, margin: 0, padding: 12 }}
            onClick={() => onNavigate?.('sleep')}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="flex items-center justify-center shrink-0" style={{ width: 24, height: 24, borderRadius: 6, background: theme.purple || '#AF52DE' }}>
                <svg width={13} height={13} viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span className="text-xs font-medium" style={{ color: theme.gray2 }}>Сон</span>
            </div>
            <div className="font-bold" style={{ color: theme.text, fontSize: 22 }}>
              {sleepH != null ? `${sleepH}ч ${sleepM}м` : '—'}
            </div>
            {data.sleep?.quality && (
              <div className="text-xs font-medium mt-0.5" style={{ color: theme.green }}>
                {data.sleep.quality >= 80 ? 'Норма ✓' : `${data.sleep.quality}%`}
              </div>
            )}
            {/* Mini week bars */}
            <div className="flex gap-0.5 mt-1.5 items-end" style={{ height: 16 }}>
              {(data.sleepWeek || []).map((h, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{
                  height: h > 0 ? Math.max(2, (h / 8) * 14) : 2,
                  background: i === 6 ? (theme.purple || '#AF52DE') : h > 0 ? (theme.purple || '#AF52DE') + '40' : theme.gray4,
                }} />
              ))}
            </div>
          </Card>

          <Card theme={theme} style={{ flex: 1, margin: 0, padding: 12 }}
            onClick={() => onNavigate?.('routines')}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="flex items-center justify-center shrink-0" style={{ width: 24, height: 24, borderRadius: 6, background: theme.teal || '#30B0C7' }}>
                <svg width={13} height={13} viewBox="0 0 24 24"><g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="17,1 21,5 17,9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7,23 3,19 7,15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></g></svg>
              </div>
              <span className="text-xs font-medium" style={{ color: theme.gray2 }}>Рутины</span>
            </div>
            <div className="font-bold" style={{ color: theme.text, fontSize: 22 }}>
              {data.doneRoutines}<span className="font-normal" style={{ color: theme.gray2, fontSize: 14 }}>/{data.totalRoutines}</span>
            </div>
            {data.streakDays > 0 && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs font-medium" style={{ color: theme.orange }}>🔥 {data.streakDays} дн</span>
                <span className="text-xs" style={{ color: theme.gray3 }}>серия</span>
              </div>
            )}
            <ProgressBar value={data.doneRoutines} max={data.totalRoutines || 1}
              color={theme.teal || theme.accent} height={3} theme={theme} />
          </Card>
        </div>

        {/* Water */}
        <Card theme={theme} style={{ marginTop: 8, padding: '12px 14px' }}
          onClick={() => onNavigate?.('water')}>
          <div className="flex items-center gap-3">
            <ProgressRing value={data.waterMl} max={data.waterGoal} size={52} strokeWidth={5}
              color={theme.teal || theme.accent} theme={theme}>
              <span className="text-sm">💧</span>
            </ProgressRing>
            <div className="flex-1">
              <div className="text-xs" style={{ color: theme.gray2 }}>Вода</div>
              <div className="text-lg font-bold" style={{ color: theme.text }}>
                {data.waterMl} мл <span className="text-sm font-normal" style={{ color: theme.gray2 }}>из {data.waterGoal}</span>
              </div>
            </div>
            <div className="flex gap-1">
              {[150, 250].map(ml => (
                <button key={ml} className="px-2.5 py-1.5 text-xs font-semibold"
                  style={{ borderRadius: 10, background: (theme.teal || theme.accent) + '12', color: theme.teal || theme.accent }}
                  onClick={async (e) => {
                    e.stopPropagation();
                    const db = (await import('../../db')).default;
                    await db.water_log.add({ date: new Date().toISOString().slice(0, 10), amount_ml: ml, created_at: new Date().toISOString() });
                  }}>
                  +{ml}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Last workout */}
        {data.lastWorkout && (
          <Card theme={theme} style={{ marginTop: 8, padding: '12px 14px' }}
            onClick={() => onNavigate?.('sport')}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: theme.red + '12' }}>🏋️</div>
              <div className="flex-1">
                <div className="text-xs" style={{ color: theme.gray2 }}>Последняя тренировка</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>
                  {data.lastWorkout.name || data.lastWorkout.type} · {data.lastWorkout.duration || '?'} мин
                </div>
                <div className="text-xs" style={{ color: theme.gray2 }}>{data.lastWorkout.date}</div>
              </div>
              <span style={{ color: theme.gray3 }}>→</span>
            </div>
          </Card>
        )}

        {/* Nutrition summary */}
        <Card theme={theme} style={{ marginTop: 8, padding: '12px 14px' }}
          onClick={() => onNavigate?.('nutrition')}>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="flex items-center justify-center shrink-0" style={{ width: 24, height: 24, borderRadius: 6, background: theme.orange }}>
              <svg width={13} height={13} viewBox="0 0 24 24"><g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v5.5a2.5 2.5 0 005 0V3"/><line x1="8.5" y1="8.5" x2="8.5" y2="21"/><path d="M18 3v4c0 1.7-1.3 3-3 3"/><line x1="18" y1="10" x2="18" y2="21"/></g></svg>
            </div>
            <span className="text-xs font-medium" style={{ color: theme.gray2 }}>Питание сегодня</span>
            <span className="ml-auto text-sm font-bold" style={{ color: theme.text }}>{data.totalCal} ккал</span>
            <span className="text-xs" style={{ color: theme.gray2 }}>из {data.nutritionGoal}</span>
          </div>
          <ProgressBar value={data.totalCal} max={data.nutritionGoal} color={theme.orange} height={4} theme={theme} />
          <div className="flex justify-between mt-1.5">
            {[
              { label: 'Белки', val: data.totalP, color: theme.red },
              { label: 'Жиры', val: data.totalF, color: '#FFCC00' },
              { label: 'Углев.', val: data.totalC, color: theme.accent },
            ].map(m => (
              <div key={m.label} className="text-center">
                <div className="font-semibold" style={{ fontSize: 13, color: m.color }}>{Math.round(m.val)} г</div>
                <div className="text-[10px]" style={{ color: theme.gray2 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Body weight */}
        {data.weight != null && (
          <Card theme={theme} style={{ marginTop: 8, padding: '12px 14px' }}
            onClick={() => onNavigate?.('body-weight')}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: theme.green + '12' }}>⚖️</div>
              <div className="flex-1">
                <div className="text-xs" style={{ color: theme.gray2 }}>Вес</div>
                <div className="text-lg font-bold" style={{ color: theme.text }}>{data.weight} кг</div>
              </div>
              {data.weightTrend != null && (
                <div className="text-right">
                  <div className="text-sm font-semibold" style={{ color: data.weightTrend <= 0 ? theme.green : theme.red }}>
                    {data.weightTrend > 0 ? '+' : ''}{data.weightTrend.toFixed(1)} кг
                  </div>
                  <div className="text-xs" style={{ color: theme.gray2 }}>за неделю</div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Steps / Activity */}
        <Card theme={theme} style={{ marginTop: 8, padding: '12px 14px' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: '#FF2D55' + '12' }}>🔥</div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: theme.text }}>Активность</div>
              <div className="text-xs" style={{ color: theme.gray2 }}>Шаги · Расстояние</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold" style={{ color: '#FF2D55' }}>— ккал</div>
              <div className="text-xs" style={{ color: theme.gray2 }}>нет данных</div>
            </div>
          </div>
        </Card>
      </div>

      <TabBar active="more" onNavigate={onNavigate} theme={theme} />
    </div>
  );
}
