import { useRef, useCallback, useEffect } from 'react';

/**
 * ActionSheet — iOS-style список действий снизу.
 * @param {boolean} open
 * @param {function} onClose
 * @param {string} title
 * @param {Array<{label, icon?, onClick, destructive?}>} actions
 * @param {object} theme
 */
export default function ActionSheet({ open, onClose, title, actions = [], theme }) {
  const backdropRef = useRef(null);

  const handleBackdrop = useCallback((e) => {
    if (e.target === backdropRef.current) onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.4)', WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-md mx-4 mb-4" role="dialog" aria-modal="true" aria-label={title || 'Действия'} style={{ animation: 'slideUp 0.25s ease-out', willChange: 'transform' }}>
        <div className="rounded-2xl overflow-hidden mb-2" style={{ background: theme.card }}>
          {title && (
            <div className="px-4 pt-4 pb-2 text-center">
              <p className="text-xs font-medium" style={{ color: theme.gray1 }}>{title}</p>
            </div>
          )}
          {actions.map((action, i) => (
            <div key={i}>
              {(i > 0 || title) && <div style={{ borderTop: `0.5px solid ${theme.gray5}` }} />}
              <button
                onClick={() => { (action.onClick || action.action)?.(); onClose(); }}
                className="w-full px-4 py-3.5 text-center text-base font-medium active:opacity-70 flex items-center justify-center gap-2"
                style={{
                  color: action.destructive ? theme.red : theme.accent,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {action.icon && <span>{action.icon}</span>}
                {action.label}
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl text-center text-base font-semibold active:opacity-70"
          style={{ background: theme.card, color: theme.text, border: 'none', cursor: 'pointer' }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
