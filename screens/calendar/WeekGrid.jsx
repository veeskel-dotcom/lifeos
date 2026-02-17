/**
 * B3.3: Недельная сетка с часовыми слотами.
 */
import { useState, useEffect, useRef } from 'react';
import { getEventsForDay } from '../../services/events';
import { getTasks } from '../../services/tasks';

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 - 22:00
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function getWeekDates(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd.toISOString().split('T')[0];
  });
}

export default function WeekGrid({ theme, onBack, onNavigate }) {
  const [weekStart, setWeekStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [events, setEvents] = useState({});
  const [tasks, setTasks] = useState({});
  const scrollRef = useRef(null);

  const dates = getWeekDates(weekStart);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const load = async () => {
      const evMap = {};
      const tkMap = {};
      for (const date of dates) {
        evMap[date] = await getEventsForDay(date).catch(() => []);
        const allTasks = await getTasks().catch(() => []);
        tkMap[date] = allTasks.filter(t => t.deadline === date && t.status !== 'done');
      }
      setEvents(evMap);
      setTasks(tkMap);
    };
    load();
  }, [weekStart]);

  // Scroll to 8:00 on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 2 * 48; // 2 rows * 48px (hours 6,7 → scroll to 8:00)
    }
  }, []);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d.toISOString().split('T')[0]);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d.toISOString().split('T')[0]);
  };
  const goToday = () => setWeekStart(today);

  const getEventsAtHour = (date, hour) => {
    const dayEvents = events[date] || [];
    return dayEvents.filter(e => {
      if (!e.time) return hour === 9; // default 9:00
      const h = parseInt(e.time.split(':')[0], 10);
      return h === hour;
    });
  };

  const getTasksForDate = (date) => tasks[date] || [];

  const fmtMonth = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full" style={{ background: theme.bg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <button onClick={onBack} className="text-sm font-medium" style={{ color: theme.accent, background: 'none', border: 'none' }}>← Назад</button>
        <span className="text-sm font-semibold capitalize" style={{ color: theme.text }}>{fmtMonth(dates[0])}</span>
        <button onClick={goToday} className="text-xs px-2 py-1 rounded" style={{ color: theme.accent, background: 'none', border: 'none' }}>Сегодня</button>
      </div>

      {/* Week nav */}
      <div className="flex items-center px-2">
        <button onClick={prevWeek} className="px-2 py-1 text-sm" style={{ color: theme.gray1, background: 'none', border: 'none' }}>‹</button>
        <div className="flex-1 grid grid-cols-7 gap-0">
          {dates.map((date, i) => {
            const isToday = date === today;
            const day = new Date(date + 'T00:00:00').getDate();
            const tasksCount = getTasksForDate(date).length;
            return (
              <div key={date} className="flex flex-col items-center py-1">
                <span className="text-[9px]" style={{ color: isToday ? theme.accent : theme.gray2 }}>
                  {WEEKDAYS[i]}
                </span>
                <span className="text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full"
                  style={{
                    color: isToday ? '#fff' : theme.text,
                    background: isToday ? theme.accent : 'transparent',
                  }}>
                  {day}
                </span>
                {tasksCount > 0 && (
                  <span className="w-1 h-1 rounded-full mt-0.5" style={{ background: theme.orange }} />
                )}
              </div>
            );
          })}
        </div>
        <button onClick={nextWeek} className="px-2 py-1 text-sm" style={{ color: theme.gray1, background: 'none', border: 'none' }}>›</button>
      </div>

      {/* Grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ borderTop: `0.5px solid ${theme.gray5}` }}>
        <div className="flex">
          {/* Time column */}
          <div className="flex-shrink-0 w-10">
            {HOURS.map(h => (
              <div key={h} className="h-12 flex items-start justify-end pr-1 pt-0.5"
                style={{ borderBottom: `0.5px solid ${theme.gray6}` }}>
                <span className="text-[9px] tabular-nums" style={{ color: theme.gray3 }}>{h}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex-1 grid grid-cols-7">
            {dates.map((date) => (
              <div key={date} className="relative" style={{ borderLeft: `0.5px solid ${theme.gray6}` }}>
                {HOURS.map(h => {
                  const hourEvents = getEventsAtHour(date, h);
                  return (
                    <div key={h} className="h-12 relative"
                      onClick={() => onNavigate?.('event-form', { date, time: `${String(h).padStart(2, '0')}:00` })}
                      style={{ borderBottom: `0.5px solid ${theme.gray6}`, cursor: 'pointer' }}>
                      {hourEvents.map((ev, ei) => (
                        <div key={ei}
                          className="absolute inset-x-0.5 rounded text-[8px] px-0.5 py-px overflow-hidden"
                          style={{
                            top: 1,
                            background: (ev.color || theme.accent) + '25',
                            color: ev.color || theme.accent,
                            borderLeft: `2px solid ${ev.color || theme.accent}`,
                            zIndex: 1,
                          }}>
                          {ev.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
