import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import { getAllWorkouts } from '../../services/workouts';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function getMonday(d) {
  const date = new Date(typeof d === 'string' && d.length === 10 ? d + 'T12:00:00' : d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekDates(weeksBack = 0) {
  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() - weeksBack * 7);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function intensityColor(count, theme) {
  if (count === 0) return theme.gray5;
  if (count === 1) return theme.green + '40';
  if (count === 2) return theme.green + '80';
  return theme.green;
}

export default function WeeklyActivity({ theme }) {
  const [weeks, setWeeks] = useState([]);
  const [stats, setStats] = useState({ total: 0, avgPerWeek: 0, avgDuration: 0 });
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const workouts = await getAllWorkouts();

    // Группировка по дате
    const byDate = {};
    workouts.forEach(w => {
      const d = (w.date || w.created_at?.slice(0, 10));
      if (!d) return;
      byDate[d] = (byDate[d] || 0) + 1;
    });

    // Heatmap — 7 недель
    const weekData = [];
    for (let w = 6; w >= 0; w--) {
      const dates = getWeekDates(w);
      weekData.push(dates.map(d => ({
        date: d,
        count: byDate[d] || 0,
      })));
    }
    setWeeks(weekData);

    // Статистика
    const totalWorkouts = workouts.length;
    const durations = workouts.filter(w => w.duration_min).map(w => w.duration_min);
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : 0;

    // Кол-во уникальных недель с тренировками
    const weekSet = new Set();
    workouts.forEach(w => {
      const d = w.date || w.created_at?.slice(0, 10);
      if (d) {
        const mon = getMonday(d).toISOString().slice(0, 10);
        weekSet.add(mon);
      }
    });
    const activeWeeks = weekSet.size || 1;
    const avgPerWeek = Math.round((totalWorkouts / activeWeeks) * 10) / 10;

    setStats({ total: totalWorkouts, avgPerWeek, avgDuration });

    // Streak — подряд дней с тренировками от сегодня назад
    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      if (byDate[ds]) {
        currentStreak++;
      } else {
        // Разрешаем пропуск сегодня если ещё не тренировались
        if (i === 0) continue;
        break;
      }
    }
    setStreak(currentStreak);
  };

  return (
    <Card theme={theme}>
      <div className="flex items-center justify-between mb-3">
        <span style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
          Активность
        </span>
        {streak > 0 && (
          <span className="px-2 py-0.5 rounded-full" style={{ background: theme.green + '20', color: theme.green, fontSize: 12, fontWeight: 600 }}>
            🔥 {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} подряд
          </span>
        )}
      </div>

      {/* Heatmap */}
      <div className="flex gap-1 mb-3">
        {/* Дни недели — лейблы */}
        <div className="flex flex-col gap-1 mr-1 pt-0">
          {DAYS.map(d => (
            <div
              key={d}
              className="flex items-center justify-end" style={{ fontSize: 9, color: theme.gray3, height: 14, lineHeight: '14px' }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Ячейки */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 flex-1">
            {week.map((day) => (
              <div
                key={day.date}
                className="rounded-[3px]"
                style={{
                  height: 14,
                  background: intensityColor(day.count, theme),
                  transition: 'background 0.2s',
                }}
                title={`${day.date}: ${day.count} тренировок`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Легенда */}
      <div className="flex items-center gap-1 mb-3 justify-end">
        <span style={{ fontSize: 9, color: theme.gray3 }}>Меньше</span>
        {[0, 1, 2, 3].map(n => (
          <div
            key={n}
            className="w-3 h-3 rounded-[2px]"
            style={{ background: intensityColor(n, theme) }}
          />
        ))}
        <span style={{ fontSize: 9, color: theme.gray3 }}>Больше</span>
      </div>

      {/* Метрики */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-xl p-2.5" style={{ background: theme.gray6, textAlign: 'center' }}>
          <div style={{ color: theme.text, fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {stats.total}
          </div>
          <div style={{ color: theme.gray2, fontSize: 10 }}>Тренировок</div>
        </div>
        <div className="flex-1 rounded-xl p-2.5" style={{ background: theme.gray6, textAlign: 'center' }}>
          <div style={{ color: theme.text, fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {stats.avgPerWeek}
          </div>
          <div style={{ color: theme.gray2, fontSize: 10 }}>В неделю</div>
        </div>
        <div className="flex-1 rounded-xl p-2.5" style={{ background: theme.gray6, textAlign: 'center' }}>
          <div style={{ color: theme.text, fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {stats.avgDuration}<span style={{ fontSize: 12, fontWeight: 400 }}> мин</span>
          </div>
          <div style={{ color: theme.gray2, fontSize: 10 }}>Среднее</div>
        </div>
      </div>
    </Card>
  );
}
