import { useState, useRef, useEffect, useMemo } from 'react';
import Card from '../../components/Card';

const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function getMonday(d) {
  const dt = new Date(typeof d === 'string' && d.length === 10 ? d + 'T12:00:00' : d);
  const day = dt.getDay() || 7;
  dt.setDate(dt.getDate() - day + 1);
  return dt;
}

function dateStr(d) {
  return d.toISOString().split('T')[0];
}

/**
 * CalendarView — Fantastical-style DayTicker + месячная сетка.
 * Горизонтальная полоса дней (14 дней), тап → задачи дня, pull → месяц.
 * @param {Array} tasks - все задачи
 * @param {object} theme
 * @param {function} onTap - (taskId) => void
 * @param {function} onToggle - (taskId) => void
 */
export default function CalendarView({ tasks, theme, onTap, onToggle }) {
  const today = dateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [showMonth, setShowMonth] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const tickerRef = useRef(null);

  // 14 дней: 7 назад + сегодня + 6 вперёд
  const dayTicker = useMemo(() => {
    const days = [];
    const center = new Date();
    for (let i = -7; i <= 6; i++) {
      const d = new Date(center);
      d.setDate(d.getDate() + i);
      days.push({ date: dateStr(d), day: d.getDate(), weekday: DAYS_SHORT[(d.getDay() + 6) % 7], isToday: i === 0, isWeekend: d.getDay() === 0 || d.getDay() === 6 });
    }
    return days;
  }, []);

  // Задачи с дедлайном на выбранный день
  const dayTasks = useMemo(() => {
    return tasks.filter(t => t.deadline === selectedDate && t.status !== 'cancelled')
      .sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
        const p = { urgent: 0, important: 1, normal: 2, low: 3 };
        return (p[a.priority] ?? 2) - (p[b.priority] ?? 2);
      });
  }, [tasks, selectedDate]);

  // Точки — есть ли задачи в этот день
  const taskDates = useMemo(() => {
    const dates = new Set();
    tasks.forEach(t => { if (t.deadline) dates.add(t.deadline); });
    return dates;
  }, [tasks]);

  // Месячная сетка
  const monthData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + monthOffset;
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = (first.getDay() + 6) % 7; // Monday=0

    const cells = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      const dt = new Date(year, month, d);
      cells.push({ date: dateStr(dt), day: d, isToday: dateStr(dt) === today });
    }
    return { cells, monthLabel: `${MONTHS[first.getMonth()]} ${first.getFullYear()}` };
  }, [monthOffset, today]);

  // Скролл к сегодня при монтировании
  useEffect(() => {
    if (tickerRef.current) {
      const todayEl = tickerRef.current.querySelector('[data-today="true"]');
      todayEl?.scrollIntoView({ inline: 'center', behavior: 'instant' });
    }
  }, []);

  const PRIORITY_COLORS = { urgent: '#FF3B30', important: '#FF9500', normal: '#007AFF', low: '#AEAEB2' };

  return (
    <div className="flex flex-col gap-3">
      {/* ═══ Day Ticker ═══ */}
      <div
        ref={tickerRef}
        className="flex gap-1 overflow-x-auto no-scrollbar px-2 py-2"
        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
      >
        {dayTicker.map(d => {
          const isSelected = d.date === selectedDate;
          const hasTasks = taskDates.has(d.date);
          return (
            <button
              key={d.date}
              data-today={d.isToday || undefined}
              onClick={() => setSelectedDate(d.date)}
              className="flex flex-col items-center shrink-0 rounded-2xl py-2 px-3 transition-all active:scale-95"
              style={{
                background: isSelected ? theme.accent : 'transparent',
                minWidth: 44,
              }}
            >
              <span className="text-[10px] font-medium"
                style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : d.isWeekend ? theme.red : theme.gray2 }}>
                {d.weekday}
              </span>
              <span className="text-base font-bold mt-0.5"
                style={{ color: isSelected ? '#fff' : d.isToday ? theme.accent : theme.text }}>
                {d.day}
              </span>
              {/* Dot indicator */}
              <div className="w-1 h-1 rounded-full mt-1"
                style={{ background: hasTasks ? (isSelected ? '#fff' : theme.accent) : 'transparent' }} />
            </button>
          );
        })}
        <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
      </div>

      {/* Toggle month view */}
      <button
        onClick={() => setShowMonth(!showMonth)}
        className="text-xs font-medium text-center py-1 active:opacity-70"
        style={{ color: theme.accent }}
      >
        {showMonth ? 'Скрыть календарь ▲' : 'Показать календарь ▼'}
      </button>

      {/* ═══ Month Grid ═══ */}
      {showMonth && (
        <Card theme={theme}>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setMonthOffset(monthOffset - 1)}
              className="text-lg px-2 active:opacity-70" style={{ color: theme.accent }}>‹</button>
            <span className="text-sm font-semibold" style={{ color: theme.text }}>
              {monthData.monthLabel}
            </span>
            <button onClick={() => setMonthOffset(monthOffset + 1)}
              className="text-lg px-2 active:opacity-70" style={{ color: theme.accent }}>›</button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS_SHORT.map(d => (
              <span key={d} className="text-[10px] text-center font-medium" style={{ color: theme.gray2 }}>{d}</span>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-1">
            {monthData.cells.map((cell, i) => {
              if (!cell) return <div key={`e${i}`} />;
              const isSelected = cell.date === selectedDate;
              const hasTasks = taskDates.has(cell.date);
              return (
                <button
                  key={cell.date}
                  onClick={() => { setSelectedDate(cell.date); setShowMonth(false); }}
                  className="w-full aspect-square rounded-full flex flex-col items-center justify-center text-xs font-medium relative active:scale-90"
                  style={{
                    background: isSelected ? theme.accent : cell.isToday ? theme.accent + '20' : 'transparent',
                    color: isSelected ? '#fff' : cell.isToday ? theme.accent : theme.text,
                  }}
                >
                  {cell.day}
                  {hasTasks && !isSelected && (
                    <div className="w-1 h-1 rounded-full absolute bottom-1" style={{ background: theme.accent }} />
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* ═══ Tasks for selected date ═══ */}
      <div className="px-1">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
          {selectedDate === today ? 'Сегодня' : new Date(selectedDate + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          {dayTasks.length > 0 && ` · ${dayTasks.length}`}
        </span>
      </div>

      {dayTasks.length === 0 ? (
        <div className="flex flex-col items-center py-8">
          <span className="text-3xl mb-2">🗓️</span>
          <span className="text-sm" style={{ color: theme.gray2 }}>Нет задач на этот день</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {dayTasks.map((task, i) => {
            const isDone = task.status === 'done';
            const pColor = PRIORITY_COLORS[task.priority] || theme.accent;
            return (
              <div key={task.id} className="flex gap-2.5">
                {/* Time column */}
                <div className="w-11 text-right pt-2.5 shrink-0">
                  <span className="text-sm tabular-nums" style={{ color: theme.gray1 }}>
                    {task.deadline_time || ''}
                  </span>
                </div>
                {/* Vertical colored line */}
                <div className="shrink-0" style={{ width: 2, borderRadius: 1, background: pColor + '30' }} />
                {/* Card */}
                <div
                  className="flex-1 flex items-center gap-2 py-2 px-3 mb-1 rounded-xl cursor-pointer active:opacity-70"
                  style={{ background: theme.card, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `3px solid ${pColor}` }}
                  onClick={() => onTap?.(task.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium" style={{
                        color: isDone ? theme.gray3 : theme.text,
                        textDecoration: isDone ? 'line-through' : 'none',
                      }}>
                        {task.title}
                      </span>
                    </div>
                    {task.deadline_time && !isDone && task.priority === 'urgent' && (
                      <div className="text-[11px] font-medium mt-0.5" style={{ color: theme.red }}>!! Просрочена</div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggle?.(task.id); }}
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 18, height: 18, borderRadius: 9,
                      border: isDone ? 'none' : `2px solid ${pColor}`,
                      background: isDone ? theme.green : 'transparent',
                    }}
                  >
                    {isDone && <span className="text-[9px] text-white">✓</span>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
