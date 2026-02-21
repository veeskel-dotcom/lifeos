import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

/**
 * DatePicker — iOS-style calendar grid в bottom sheet.
 * @param {boolean} open
 * @param {function} onClose
 * @param {string} value - 'YYYY-MM-DD'
 * @param {function} onSelect - (dateStr) => void
 * @param {object} theme
 */
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export default function DatePicker({ open, onClose, value, onSelect, theme }) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const initDate = value ? new Date(value + 'T00:00:00') : today;
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());
  const [selected, setSelected] = useState(value || todayStr);
  const backdropRef = useRef(null);

  useEffect(() => {
    if (open) {
      const d = value ? new Date(value + 'T00:00:00') : today;
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setSelected(value || todayStr);
    }
  }, [open, value]);

  const handleBackdrop = useCallback((e) => {
    if (e.target === backdropRef.current) onClose();
  }, [onClose]);

  const days = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startDay = (first.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];

    // Previous month padding
    const prevDays = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      cells.push({ day: prevDays - i, current: false, dateStr: null });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const m = String(viewMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push({ day: d, current: true, dateStr: `${viewYear}-${m}-${dd}` });
    }

    // Next month padding
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        cells.push({ day: d, current: false, dateStr: null });
      }
    }

    return cells;
  }, [viewYear, viewMonth]);

  const shiftMonth = (delta) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m);
    setViewYear(y);
  };

  const handleSelect = (dateStr) => {
    if (!dateStr) return;
    setSelected(dateStr);
    onSelect(dateStr);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl px-4 pt-4 pb-8"
        style={{ background: theme.card, animation: 'slideUp 0.25s ease-out', willChange: 'transform' }}
      >
        {/* Month/Year nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => shiftMonth(-1)} className="w-9 h-9 rounded-full flex items-center justify-center active:opacity-70"
            style={{ background: theme.gray6, border: 'none', cursor: 'pointer', color: theme.text, fontSize: 16 }}>‹</button>
          <span className="text-base font-semibold" style={{ color: theme.text }}>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button onClick={() => shiftMonth(1)} className="w-9 h-9 rounded-full flex items-center justify-center active:opacity-70"
            style={{ background: theme.gray6, border: 'none', cursor: 'pointer', color: theme.text, fontSize: 16 }}>›</button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs font-medium py-1" style={{ color: theme.gray2 }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((cell, i) => {
            const isSelected = cell.dateStr === selected;
            const isToday = cell.dateStr === todayStr;
            return (
              <button
                key={i}
                onClick={() => handleSelect(cell.dateStr)}
                disabled={!cell.current}
                className="flex items-center justify-center active:opacity-70"
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  border: 'none',
                  cursor: cell.current ? 'pointer' : 'default',
                  borderRadius: '50%',
                  fontSize: 15,
                  fontWeight: isSelected || isToday ? 600 : 400,
                  background: isSelected ? theme.accent : 'transparent',
                  color: isSelected ? '#fff'
                    : !cell.current ? theme.gray4
                    : isToday ? theme.accent
                    : theme.text,
                }}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-between mt-4">
          <button
            onClick={() => { onSelect(''); onClose(); }}
            className="text-sm font-medium active:opacity-70"
            style={{ color: theme.red, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Очистить
          </button>
          <button
            onClick={() => handleSelect(todayStr)}
            className="text-sm font-medium active:opacity-70"
            style={{ color: theme.accent, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Сегодня
          </button>
        </div>
      </div>
    </div>
  );
}
