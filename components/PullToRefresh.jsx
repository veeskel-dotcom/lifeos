import { usePullToRefresh } from '../hooks/usePullToRefresh';

/**
 * PullToRefresh — обёрточный компонент для pull-to-refresh.
 * Оборачивает скроллируемый контент.
 */
export default function PullToRefresh({ onRefresh, children, theme }) {
  const { refreshing, pullDistance, handlers } = usePullToRefresh(onRefresh);

  return (
    <div
      className="flex-1 overflow-y-auto"
      {...handlers}
      style={{ position: 'relative' }}
    >
      {/* Индикатор */}
      {(pullDistance > 0 || refreshing) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: pullDistance || 40,
            transition: refreshing ? 'none' : 'height 0.2s',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              border: `2.5px solid ${theme?.gray4 || '#ccc'}`,
              borderTopColor: theme?.accent || '#007AFF',
              borderRadius: '50%',
              animation: refreshing ? 'ptr-spin 0.6s linear infinite' : 'none',
              transform: refreshing ? 'none' : `rotate(${pullDistance * 3}deg)`,
              opacity: Math.min(pullDistance / 40, 1),
            }}
          />
        </div>
      )}
      {children}
      <style>{`@keyframes ptr-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
