/**
 * WidgetCard — Обёртка виджета в стиле iOS 17.
 * Цветной градиент, emoji-заголовок, borderRadius 20.
 */
export default function WidgetCard({ title, icon, color, theme, onClick, size = 'small', children }) {
  return (
    <div
      onClick={onClick}
      className="relative overflow-hidden"
      style={{
        background: theme.card,
        borderRadius: 20,
        padding: 16,
        cursor: onClick ? 'pointer' : 'default',
        minHeight: 140,
      }}
    >
      {/* Gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${color}12 0%, transparent 60%)`,
          borderRadius: 20,
        }}
      />

      {/* Header */}
      <div className="relative flex items-center gap-1.5 mb-3">
        <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
        <span
          className="font-bold uppercase tracking-wider"
          style={{ fontSize: 10, color, letterSpacing: '0.08em' }}
        >
          {title}
        </span>
      </div>

      {/* Content */}
      <div className="relative">{children}</div>
    </div>
  );
}
