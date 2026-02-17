import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * InputSheet — Bottom sheet с текстовым полем, замена prompt().
 * @param {boolean} open
 * @param {function} onClose
 * @param {string} title
 * @param {string} placeholder
 * @param {string} initialValue
 * @param {function} onSubmit - (value) => void
 * @param {string} submitLabel
 * @param {object} theme
 * @param {string} inputType - text|number
 */
export default function InputSheet({
  open, onClose, title, placeholder, initialValue = '', onSubmit, submitLabel = 'Готово', theme, inputType = 'text',
}) {
  const [value, setValue] = useState(initialValue);
  const backdropRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, initialValue]);

  const handleBackdrop = useCallback((e) => {
    if (e.target === backdropRef.current) onClose();
  }, [onClose]);

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl px-4 pt-4 pb-8"
        style={{ background: theme.card, animation: 'slideUp 0.25s ease-out' }}
      >
        {title && (
          <p className="text-base font-semibold mb-3" style={{ color: theme.text }}>{title}</p>
        )}
        <input
          ref={inputRef}
          type={inputType}
          inputMode={inputType === 'number' ? 'numeric' : undefined}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder={placeholder}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none mb-3"
          style={{ background: theme.gray6, color: theme.text, border: 'none', fontSize: 16 }}
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-medium active:opacity-70"
            style={{ background: theme.gray6, color: theme.text, border: 'none', cursor: 'pointer' }}
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-3 rounded-xl text-sm font-semibold active:opacity-70"
            style={{ background: theme.accent, color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}
