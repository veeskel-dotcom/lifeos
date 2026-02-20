/**
 * NavHeader — iOS-style navigation header.
 * Центрированный заголовок, кнопка «Назад» слева, опциональная кнопка справа.
 * rightAction: { label, onClick } — кнопка справа
 */
export default function NavHeader({ title, left, right, rightAction, onBack, theme }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 20px 12px',
      fontFamily: '-apple-system, system-ui, sans-serif',
    }}>
      {onBack ? (
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: theme?.accent || '#007AFF',
            fontSize: 16,
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: 0,
            minWidth: 60,
            textAlign: 'left',
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ‹ {left || ''}
        </button>
      ) : (
        <span style={{ fontSize: 13, color: theme?.gray1 || '#8E8E93', minWidth: 60 }}>
          {left || ''}
        </span>
      )}
      <span style={{ fontSize: 17, fontWeight: 600, color: theme?.text }}>
        {title}
      </span>
      {rightAction ? (
        <button
          onClick={rightAction.onClick}
          style={{
            background: 'none',
            border: 'none',
            color: theme?.accent || '#007AFF',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: 0,
            minWidth: 60,
            textAlign: 'right',
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {rightAction.label}
        </button>
      ) : (
        <span style={{ fontSize: 13, color: theme?.accent || '#007AFF', minWidth: 60, textAlign: 'right' }}>
          {right || ''}
        </span>
      )}
    </div>
  );
}
