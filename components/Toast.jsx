/**
 * Toast — Одно уведомление.
 * Типы: info (синий), warning (жёлтый), danger (красный), success (зелёный).
 * Анимация slide-down, свайп вправо → dismiss.
 */
import { useState, useRef } from 'react';

const TYPE_COLORS = {
  info: { bg: '#007AFF18', border: '#007AFF40', text: '#007AFF' },
  warning: { bg: '#FF950018', border: '#FF950040', text: '#FF9500' },
  danger: { bg: '#FF3B3018', border: '#FF3B3040', text: '#FF3B30' },
  success: { bg: '#34C75918', border: '#34C75940', text: '#34C759' },
};

export default function Toast({ toast, theme, onDismiss }) {
  const [offset, setOffset] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const startX = useRef(0);
  const dragging = useRef(false);

  const colors = TYPE_COLORS[toast.type] || TYPE_COLORS.info;

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    dragging.current = true;
  };

  const handleTouchMove = (e) => {
    if (!dragging.current) return;
    const diff = e.touches[0].clientX - startX.current;
    if (diff > 0) setOffset(diff); // только вправо
  };

  const handleTouchEnd = () => {
    dragging.current = false;
    if (offset > 100) {
      // Свайп достаточно далеко → dismiss
      setDismissed(true);
      setTimeout(onDismiss, 200);
    } else {
      setOffset(0);
    }
  };

  if (dismissed) return null;

  return (
    <div
      className="w-full max-w-sm rounded-card px-4 py-3 flex items-center gap-3 shadow-lg"
      style={{
        background: theme?.card || '#FFFFFF',
        borderLeft: `3px solid ${colors.text}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        transform: `translateX(${offset}px)`,
        opacity: offset > 80 ? 1 - (offset - 80) / 60 : 1,
        transition: dragging.current ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
        animation: 'slideDown 0.3s ease',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={onDismiss}
    >
      {/* Иконка */}
      {toast.icon && <span className="text-lg shrink-0">{toast.icon}</span>}

      {/* Текст */}
      <span className="flex-1 text-sm font-medium" style={{ color: theme?.text || '#000' }}>
        {toast.text}
      </span>

      {/* Action button */}
      {toast.action && (
        <button
          className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg active:opacity-70"
          style={{ background: colors.text + '20', color: colors.text }}
          onClick={(e) => { e.stopPropagation(); toast.action.onClick?.(); onDismiss(); }}
        >
          {toast.action.label}
        </button>
      )}

      {/* Стрелка навигации */}
      {toast.route && (
        <span className="text-sm shrink-0" style={{ color: colors.text }}>→</span>
      )}
    </div>
  );
}
