import { useState, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import WeekGrid from './WeekGrid';
import { getEventsForMonth, getEventsForDay } from '../../services/events';
import { getTasks } from '../../services/tasks';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const EVENT_COLORS = {
  meeting: '#007AFF',
  personal: '#34C759',
  reminder: '#FF9500',
  deadline: '#FF3B30',
};

export default function CalendarScreen({ theme, onBack, onNavigate }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState('month'); // month | week
  const [monthEvents, setMonthEvents] = useState([]);
  const [dayEvents, setDayEvents] = useState([]);
  const [dayTasks, setDayTasks] = useState([]);

  const monthStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`;

  useEffect(() => {
    getEventsForMonth(monthStr).then(setMonthEvents);
  }, [monthStr]);

  useEffect(() => {
    getEventsForDay(selectedDate).then(setDayEvents);
    getTasks({ dateFrom: selectedDate, dateTo: selectedDate }).then(tasks => {
      setDayTasks(tasks.filter(t => t.deadline === selectedDate));
    });
  }, [selectedDate]);

  const prevMonth = () => {
    setCurrentMonth(prev => {
      const m = prev.month === 0 ? 11 : prev.month - 1;
      const y = prev.month === 0 ? prev.year - 1 : prev.year;
      return { year: y, month: m };
    });
  };

  const nextMonth = () => {
    setCurrentMonth(prev => {
      const m = prev.month === 11 ? 0 : prev.month + 1;
      const y = prev.month === 11 ? prev.year + 1 : prev.year;
      return { year: y, month: m };
    });
  };

  // Build calendar grid
  const firstDay = new Date(currentMonth.year, currentMonth.month, 1);
  const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon = 0
  const daysInMonth = lastDay.getDate();
  const today = new Date().toISOString().split('T')[0];

  const eventDays = new Set(monthEvents.map(e => e.start.split('T')[0]));

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Week mode: only show the 7-cell row containing selected date
  const displayCells = (() => {
    if (viewMode === 'month') return cells;
    const selDay = parseInt(selectedDate.split('-')[2]);
    const selIdx = cells.findIndex(c => c === selDay);
    if (selIdx < 0) return cells;
    const rowStart = Math.floor(selIdx / 7) * 7;
    return cells.slice(rowStart, rowStart + 7);
  })();

  if (viewMode === 'week') {
    return (
      <div className="flex flex-col h-full">
        <NavHeader title="Календарь" onBack={onBack} theme={theme}
          right={<span onClick={() => setViewMode('month')} style={{ cursor: 'pointer', fontSize: 14, color: theme.accent }}>📅 Месяц</span>}
        />
        <WeekGrid theme={theme} onBack={() => setViewMode('month')} onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <NavHeader title="Календарь" onBack={onBack} theme={theme}
        right={<span onClick={() => setViewMode('week')} style={{ cursor: 'pointer', fontSize: 14, color: theme.accent }}>📅 Неделя</span>}
      />

      <div className="flex-1 overflow-auto px-4 pb-24">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-3 px-1">
          <button onClick={prevMonth} className="text-lg" style={{ color: theme.accent }}>‹</button>
          <span className="text-base font-semibold" style={{ color: theme.text }}>
            {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
          </span>
          <button onClick={nextMonth} className="text-lg" style={{ color: theme.accent }}>›</button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-medium py-1" style={{ color: theme.gray2 }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <Card theme={theme} style={{ padding: 4, marginBottom: 16 }}>
          <div className="grid grid-cols-7">
            {displayCells.map((day, i) => {
              if (!day) return <div key={i} />;
              const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const hasEvents = eventDays.has(dateStr);

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(dateStr)}
                  className="flex flex-col items-center justify-center py-1.5 rounded-lg relative"
                  style={{
                    background: isSelected ? theme.accent : 'transparent',
                  }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: isSelected ? '#fff' : isToday ? theme.accent : theme.text,
                      fontWeight: isToday ? 700 : 400,
                    }}
                  >
                    {day}
                  </span>
                  {hasEvents && !isSelected && (
                    <div className="w-1 h-1 rounded-full mt-0.5" style={{ background: theme.accent }} />
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Selected day events + tasks */}
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-sm font-semibold" style={{ color: theme.text }}>
            {formatSelectedDate(selectedDate)}
          </span>
          <button
            onClick={() => onNavigate('eventForm', selectedDate)}
            className="text-xs font-medium"
            style={{ color: theme.accent }}
          >
            ＋ Событие
          </button>
        </div>

        {dayEvents.length === 0 && dayTasks.length === 0 && (
          <EmptyState
            icon="📅"
            title="Нет событий"
            subtitle="Добавьте встречу или дедлайн"
            actionLabel="+ Событие"
            onAction={() => onNavigate('eventForm', selectedDate)}
            theme={theme}
          />
        )}

        {dayEvents.map(ev => (
          <Card key={ev.id} theme={theme} style={{ marginBottom: 8, padding: 12 }}>
            <div className="flex items-center gap-2">
              <div className="w-1 h-8 rounded-full" style={{ background: EVENT_COLORS[ev.type] || theme.accent }} />
              <div className="flex-1">
                <div className="text-sm font-medium" style={{ color: theme.text }}>{ev.title}</div>
                <div className="text-xs" style={{ color: theme.gray1 }}>
                  {formatTime(ev.start)}{ev.end ? ` – ${formatTime(ev.end)}` : ''}
                  {ev.location ? ` · ${ev.location}` : ''}
                </div>
              </div>
            </div>
          </Card>
        ))}

        {dayTasks.length > 0 && (
          <>
            <span className="text-xs font-semibold uppercase mb-1 block px-1 mt-3" style={{ color: theme.gray1 }}>
              Задачи с дедлайном
            </span>
            {dayTasks.map(task => (
              <Card
                key={task.id}
                theme={theme}
                style={{ marginBottom: 8, padding: 12, cursor: 'pointer' }}
                onClick={() => onNavigate('taskDetail', task.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{task.status === 'done' ? '✅' : '○'}</span>
                  <span className="text-sm" style={{
                    color: task.status === 'done' ? theme.gray2 : theme.text,
                    textDecoration: task.status === 'done' ? 'line-through' : 'none',
                  }}>
                    {task.title}
                  </span>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function formatSelectedDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  if (diff === -1) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function EmptyState({ icon, title, subtitle, actionLabel, onAction, theme }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <div className="text-lg font-bold mb-2" style={{ color: theme.text }}>{title}</div>
      <div className="text-sm mb-6" style={{ color: theme.gray1 }}>{subtitle}</div>
      {actionLabel && (
        <button onClick={onAction} className="px-6 py-3 rounded-xl text-white font-semibold"
          style={{ background: theme.accent }}>{actionLabel}</button>
      )}
    </div>
  );
}
