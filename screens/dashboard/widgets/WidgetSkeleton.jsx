/**
 * WidgetSkeleton — Shimmer-анимация при загрузке виджета.
 */
export default function WidgetSkeleton({ theme, size = 'small' }) {
  return (
    <div
      className="overflow-hidden animate-pulse"
      style={{
        background: theme.card,
        borderRadius: 20,
        padding: 16,
        minHeight: 140,
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-4 h-4 rounded-full" style={{ background: theme.gray5 }} />
        <div className="h-2.5 rounded-full" style={{ background: theme.gray5, width: 60 }} />
      </div>
      <div className="h-7 rounded-lg mb-2" style={{ background: theme.gray5, width: size === 'wide' ? '40%' : '60%' }} />
      <div className="h-2 rounded-full mt-3" style={{ background: theme.gray5, width: '80%' }} />
      <div className="h-2 rounded-full mt-2" style={{ background: theme.gray5, width: '50%' }} />
    </div>
  );
}
