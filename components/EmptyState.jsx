/**
 * EmptyState — пустое состояние с иконкой, текстом, кнопкой.
 * M4.9: tip — подсказка для первых дней, secondaryAction — доп. кнопка.
 */
export default function EmptyState({ icon, title, subtitle, actionLabel, onAction, tip, secondaryLabel, onSecondary, theme }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <div className="text-lg font-bold mb-1" style={{ color: theme.text }}>{title}</div>
      {subtitle && (
        <div className="text-sm" style={{ color: theme.gray2 }}>{subtitle}</div>
      )}
      {tip && (
        <div className="mt-3 px-4 py-2.5 rounded-xl text-xs leading-relaxed" style={{ background: theme.accent + '12', color: theme.accent }}>
          💡 {tip}
        </div>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 px-6 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: theme.accent, color: '#fff' }}
        >
          {actionLabel}
        </button>
      )}
      {secondaryLabel && onSecondary && (
        <button
          onClick={onSecondary}
          className="mt-2 px-4 py-2 text-xs font-medium"
          style={{ color: theme.gray1 }}
        >
          {secondaryLabel}
        </button>
      )}
    </div>
  );
}
