import { useRef, useCallback, useEffect } from 'react';

/**
 * ConfirmSheet — iOS-style подтверждение снизу.
 * Эталон: iOS Action Sheet / Destructive Alert.
 * @param {boolean} open
 * @param {function} onClose
 * @param {string} title
 * @param {string} message
 * @param {string} confirmLabel - текст красной кнопки
 * @param {function} onConfirm
 * @param {object} theme
 * @param {boolean} destructive - красная кнопка (default true)
 */
export default function ConfirmSheet({ open, onClose, title, message, confirmLabel, onConfirm, theme, destructive = true }) {
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
      <div
        className="w-full max-w-md mx-4 mb-4 animate-slide-up"
        role="dialog" aria-modal="true" aria-label={title || 'Подтверждение'}
        style={{ animation: 'slideUp 0.25s ease-out', willChange: 'transform' }}
      >
        {/* Main card */}
        <div className="rounded-2xl overflow-hidden mb-2" style={{ background: theme.card }}>
          <div className="px-4 py-4 text-center">
            {title && (
              <p className="text-sm font-semibold mb-1" style={{ color: theme.text }}>{title}</p>
            )}
            {message && (
              <p className="text-xs" style={{ color: theme.gray1 }}>{message}</p>
            )}
          </div>
          <div style={{ borderTop: `0.5px solid ${theme.gray5}` }}>
            <button
              onClick={() => { onConfirm(); onClose(); }}
              className="w-full py-3.5 text-center text-base font-semibold active:opacity-70"
              style={{ color: destructive ? theme.red : theme.accent }}
            >
              {confirmLabel || 'Подтвердить'}
            </button>
          </div>
        </div>

        {/* Cancel */}
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl text-center text-base font-semibold active:opacity-70"
          style={{ background: theme.card, color: theme.accent }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
