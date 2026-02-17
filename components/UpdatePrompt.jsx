/**
 * UpdatePrompt — «Обновление доступно» баннер.
 * Показывается внизу над TabBar.
 * «Обновить» → applyUpdate() → reload.
 * Dismiss → скрыть до следующего открытия.
 */
import { applyUpdate } from '../lib/registerSW';

export default function UpdatePrompt({ visible, onDismiss, theme }) {
  if (!visible) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[200] px-4"
      style={{ bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }} // над TabBar (80px)
    >
      <div
        className="flex items-center justify-between rounded-card px-4 py-3 shadow-lg"
        style={{
          background: theme?.card || '#FFFFFF',
          border: `1px solid ${theme?.gray4 || '#D1D1D6'}`,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🔄</span>
          <span className="text-sm font-medium" style={{ color: theme?.text }}>
            Доступно обновление
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 rounded-btn text-xs font-medium"
            style={{
              background: theme?.gray5 || '#E5E5EA',
              color: theme?.gray1 || '#8E8E93',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Позже
          </button>
          <button
            onClick={() => applyUpdate()}
            className="px-3 py-1.5 rounded-btn text-xs font-semibold"
            style={{
              background: theme?.accent || '#007AFF',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Обновить
          </button>
        </div>
      </div>
    </div>
  );
}
