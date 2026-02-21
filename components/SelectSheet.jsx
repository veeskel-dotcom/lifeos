import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * SelectSheet — iOS-style bottom sheet picker, замена <select>.
 * @param {boolean} open
 * @param {function} onClose
 * @param {string} title
 * @param {Array<{value, label, icon?}>} options
 * @param {string} selected - current value
 * @param {function} onSelect - (value) => void
 * @param {object} theme
 * @param {boolean} searchable - show search for long lists
 */
export function SelectTrigger({ label, value, placeholder, onClick, theme }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl"
      style={{ background: theme.gray6, border: 'none', cursor: 'pointer', textAlign: 'left' }}
    >
      <div>
        {label && <div style={{ fontSize: 11, color: theme.gray2, marginBottom: 2 }}>{label}</div>}
        <div style={{ fontSize: 14, color: value ? theme.text : theme.gray3 }}>
          {value || placeholder || 'Выбрать'}
        </div>
      </div>
      <span style={{ color: theme.gray3, fontSize: 14 }}>›</span>
    </button>
  );
}

export default function SelectSheet({ open, onClose, title, options = [], selected, onSelect, theme, searchable }) {
  const [search, setSearch] = useState('');
  const backdropRef = useRef(null);

  const handleBackdrop = useCallback((e) => {
    if (e.target === backdropRef.current) onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl overflow-hidden"
        role="dialog" aria-modal="true" aria-label={title || 'Выбор'}
        style={{ background: theme.card, maxHeight: '60vh', animation: 'slideUp 0.25s ease-out', willChange: 'transform' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-base font-semibold" style={{ color: theme.text }}>{title || 'Выбрать'}</span>
          <button
            onClick={onClose}
            className="text-sm font-medium"
            style={{ color: theme.accent, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Готово
          </button>
        </div>

        {/* Search */}
        {(searchable || options.length > 8) && (
          <div className="px-4 pb-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: theme.gray6, color: theme.text, border: 'none' }}
            />
          </div>
        )}

        {/* Options */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 100px)' }}>
          {filtered.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onSelect(opt.value); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3 active:opacity-70"
              style={{
                background: 'transparent',
                border: 'none',
                borderTop: `0.5px solid ${theme.gray5}`,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {opt.icon && <span>{opt.icon}</span>}
              <span className="flex-1 text-sm" style={{ color: theme.text }}>{opt.label}</span>
              {selected === opt.value && (
                <span style={{ color: theme.accent, fontSize: 18 }}>✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
