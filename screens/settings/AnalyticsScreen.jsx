/**
 * AnalyticsScreen — Аналитика использования приложения.
 * Streak дней, stats grid, weekly heatmap, module usage.
 */
import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import ProgressBar from '../../components/ProgressBar';
import NavHeader from '../../components/NavHeader';
import ScreenWrapper from '../../components/ScreenWrapper';

export default function AnalyticsScreen({ theme, onBack }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const db = (await import('../../db')).default;
        const now = new Date();

        // Days with LifeOS: count distinct dates in any table
        const firstEntry = await db.expenses.orderBy('date').first().catch(() => null);
        const daysWithApp = firstEntry
          ? Math.max(1, Math.floor((now - new Date(firstEntry.date)) / 86400000))
          : 0;

        // Counts
        const [txCount, workoutCount, mealCount, tasksDone] = await Promise.all([
          db.expenses.count().catch(() => 0),
          db.workouts.count().catch(() => 0),
          db.food_log.count().catch(() => 0),
          db.tasks.where('status').equals('done').count().catch(() => 0),
        ]);
        const tasksTotal = await db.tasks.count().catch(() => 1);

        // Weekly activity (last 7 days)
        const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const weekActivity = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000);
          const dt = d.toISOString().slice(0, 10);
          const dayIdx = (d.getDay() + 6) % 7;
          const [fin, food, sport, task] = await Promise.all([
            db.expenses.where('date').equals(dt).count().catch(() => 0),
            db.food_log.where('date').equals(dt).count().catch(() => 0),
            db.workouts.where('date').equals(dt).count().catch(() => 0),
            db.tasks.where('deadline').equals(dt).count().catch(() => 0),
          ]);
          weekActivity.push({ label: DAY_LABELS[dayIdx], fin, food, sport, task });
        }

        setStats({
          daysWithApp,
          txCount, workoutCount, mealCount, tasksDone, tasksTotal,
          txPerDay: daysWithApp > 0 ? (txCount / daysWithApp).toFixed(1) : 0,
          workoutsPerWeek: daysWithApp > 0 ? (workoutCount / daysWithApp * 7).toFixed(1) : 0,
          mealsPerDay: daysWithApp > 0 ? (mealCount / daysWithApp).toFixed(1) : 0,
          tasksPct: tasksTotal > 0 ? Math.round(tasksDone / tasksTotal * 100) : 0,
          weekActivity,
        });
      } catch { /* empty */ }
    })();
  }, []);

  if (!stats) return (
    <ScreenWrapper theme={theme}>
      <NavHeader title="Аналитика" onBack={onBack} theme={theme} />
      <div className="flex items-center justify-center py-20">
        <div className="text-sm" style={{ color: theme.gray2 }}>Загрузка...</div>
      </div>
    </ScreenWrapper>
  );

  const statCards = [
    { emoji: '💰', value: stats.txCount, label: 'Транзакций', sub: `${stats.txPerDay}/день`, color: theme.green },
    { emoji: '🏋️', value: stats.workoutCount, label: 'Тренировок', sub: `${stats.workoutsPerWeek}/нед`, color: theme.red },
    { emoji: '🍎', value: stats.mealCount, label: 'Приёмов пищи', sub: `${stats.mealsPerDay}/день`, color: theme.orange },
    { emoji: '✅', value: stats.tasksDone, label: 'Задач закрыто', sub: `${stats.tasksPct}% выполнено`, color: theme.accent },
  ];

  const categories = [
    { key: 'fin', label: '💰 Фин', color: theme.green },
    { key: 'food', label: '🍎 Еда', color: theme.orange },
    { key: 'sport', label: '🏋 Спорт', color: theme.red },
    { key: 'task', label: '✅ Задачи', color: theme.accent },
  ];

  // Module usage percentages
  const total = stats.txCount + stats.mealCount + stats.workoutCount + stats.tasksDone;
  const modules = [
    { name: 'Финансы', pct: total > 0 ? Math.round(stats.txCount / total * 100) : 0, color: theme.green },
    { name: 'Питание', pct: total > 0 ? Math.round(stats.mealCount / total * 100) : 0, color: theme.orange },
    { name: 'Задачи', pct: total > 0 ? Math.round(stats.tasksDone / total * 100) : 0, color: theme.accent },
    { name: 'Спорт', pct: total > 0 ? Math.round(stats.workoutCount / total * 100) : 0, color: theme.red },
    { name: 'Прочее', pct: total > 0 ? Math.max(0, 100 - Math.round(stats.txCount / total * 100) - Math.round(stats.mealCount / total * 100) - Math.round(stats.tasksDone / total * 100) - Math.round(stats.workoutCount / total * 100)) : 0, color: theme.gray3 },
  ];

  return (
    <ScreenWrapper theme={theme}>
      <NavHeader title="Аналитика" onBack={onBack} theme={theme} />

      {/* Streak */}
      <div className="text-center py-3">
        <div className="text-5xl font-bold" style={{ color: theme.accent }}>{stats.daysWithApp}</div>
        <div className="text-sm mt-1" style={{ color: theme.gray2 }}>дней с LifeOS</div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-3">
        {statCards.map(s => (
          <Card key={s.label} theme={theme} style={{ margin: 0, padding: '14px' }}>
            <div className="text-xl mb-1">{s.emoji}</div>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="font-medium" style={{ color: theme.text, fontSize: 13 }}>{s.label}</div>
            <div className="text-[11px]" style={{ color: theme.gray2 }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* Weekly activity heatmap */}
      <div className="px-4 mt-2">
        <div className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: theme.gray1 }}>
          Активность за неделю
        </div>
        <Card theme={theme} style={{ margin: 0, padding: 14 }}>
          <div className="grid" style={{ gridTemplateColumns: '40px repeat(7, 1fr)', gap: 3, fontSize: 11 }}>
            <div />
            {stats.weekActivity.map(w => (
              <div key={w.label} className="text-center font-medium" style={{ color: theme.gray2 }}>{w.label}</div>
            ))}
            {categories.map(cat => {
              const maxVal = Math.max(1, ...stats.weekActivity.map(w => w[cat.key]));
              return [
                <div key={`${cat.key}-label`} className="flex items-center text-[10px]" style={{ color: theme.gray2 }}>
                  {cat.label}
                </div>,
                ...stats.weekActivity.map((w, wi) => {
                  const v = w[cat.key];
                  const opacity = v === 0 ? 0.05 : 0.2 + (v / maxVal) * 0.8;
                  return (
                    <div key={`${cat.key}-${wi}`} className="rounded"
                      style={{ height: 20, background: cat.color, opacity }} />
                  );
                }),
              ];
            })}
          </div>
        </Card>
      </div>

      {/* Module usage */}
      <div className="px-4 mt-4 mb-6">
        <div className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: theme.gray1 }}>
          Использование модулей
        </div>
        <Card theme={theme} style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
          {modules.map((m, i) => (
            <div key={m.name} className="px-3.5 py-2.5"
              style={{ borderBottom: i < modules.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
              <div className="flex justify-between mb-1">
                <span className="text-sm" style={{ color: theme.text }}>{m.name}</span>
                <span className="font-semibold" style={{ color: m.color, fontSize: 13 }}>{m.pct}%</span>
              </div>
              <ProgressBar value={m.pct} max={100} color={m.color} height={4} theme={theme} />
            </div>
          ))}
        </Card>
      </div>
    </ScreenWrapper>
  );
}
