/**
 * ToastProvider — Context provider для In-App toast уведомлений.
 * useToast() → { showToast, dismissToast, toasts }
 * Стек: максимум 3 видимых, auto-dismiss 5с.
 */
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import Toast from './Toast';

const ToastContext = createContext(null);

let nextId = 1;

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children, theme }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    // Очистить таймер
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (arg) => {
      // Normalize: accept string or object
      const opts = typeof arg === 'string' ? { text: arg } : (arg || {});
      const { type = 'info', icon, text, action, route, duration = 5000 } = opts;
      const id = nextId++;

      setToasts((prev) => {
        // Макс 3 — убираем старейший
        const next = prev.length >= 3 ? prev.slice(1) : prev;
        return [...next, { id, type, icon, text, action, route }];
      });

      // Auto-dismiss
      if (duration > 0) {
        const timer = setTimeout(() => dismissToast(id), duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, toasts }}>
      {children}
      {/* Toast stack — рендерится поверх всего */}
      <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex flex-col items-center gap-2 p-3 pointer-events-auto">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              toast={toast}
              theme={theme}
              onDismiss={() => dismissToast(toast.id)}
            />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
