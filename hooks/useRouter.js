/**
 * M1.3: useRouter — История навигации + History API.
 *
 * Решает проблему: кнопка «назад» на iOS выходит из PWA вместо
 * возврата на предыдущий экран.
 *
 * Подход:
 * - Стек навигации (массив {screen, ...data})
 * - Каждый navigate() → pushState + push в стек
 * - popstate → pop из стека → goBack
 * - useSwipeBack продолжает работать (вызывает goBack)
 *
 * API совместим с текущим: navigate(screen, data), goBack()
 */
import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * @param {Function} onStackChange — вызывается при изменении стека,
 *   получает текущий top элемент (или null)
 */
export function useRouter(onStackChange) {
  const stackRef = useRef([]);
  const [current, setCurrent] = useState(null);
  const isPopState = useRef(false);

  // ── Push: navigate to a sub-screen ──
  const navigate = useCallback((screen, data) => {
    const entry = { screen, ...(data || {}) };
    stackRef.current = [...stackRef.current, entry];
    setCurrent(entry);

    // Push to browser history (не при popstate)
    if (!isPopState.current) {
      try {
        window.history.pushState(
          { lifeos: true, depth: stackRef.current.length },
          ''
        );
      } catch {}
    }
  }, []);

  // ── Pop: go back one level ──
  const goBack = useCallback(() => {
    const stack = stackRef.current;

    if (stack.length > 0) {
      stackRef.current = stack.slice(0, -1);
      const prev = stackRef.current[stackRef.current.length - 1] || null;
      setCurrent(prev);

      // Синхронизировать browser history (только если не из popstate)
      if (!isPopState.current) {
        try {
          window.history.back();
        } catch {}
      }
    }
  }, []);

  // ── Reset: clear stack (tab switch) ──
  const reset = useCallback(() => {
    const depth = stackRef.current.length;
    stackRef.current = [];
    setCurrent(null);

    // Очистить browser history entries
    // go(-depth) вернёт на базовый уровень
    if (depth > 0) {
      try {
        window.history.go(-depth);
      } catch {}
    }
  }, []);

  // ── popstate listener ──
  useEffect(() => {
    const handler = (e) => {
      // Проверяем: это наш pushState или внешний?
      // Если стек пуст — ничего не делаем (не мешаем browser default)
      if (stackRef.current.length === 0) return;

      isPopState.current = true;
      goBack();

      // Сбрасываем флаг после microtask
      Promise.resolve().then(() => {
        isPopState.current = false;
      });
    };

    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [goBack]);

  // ── Предотвратить выход из PWA при пустом стеке ──
  // Добавляем «якорный» pushState при маунте, чтобы первый back
  // не выкидывал из приложения
  useEffect(() => {
    try {
      window.history.replaceState({ lifeos: true, root: true }, '');
    } catch {}
  }, []);

  return {
    /** Текущий sub-screen (top of stack) или null */
    current,
    /** Глубина стека */
    depth: stackRef.current.length,
    /** Перейти на экран */
    navigate,
    /** Назад на один уровень */
    goBack,
    /** Сбросить стек (при смене таба) */
    reset,
    /** Есть ли куда возвращаться */
    canGoBack: stackRef.current.length > 0,
  };
}

/**
 * useModuleRouter — облегчённая версия для модулей (Finance, Sport, Invest).
 * Пушит в browser history, но не слушает popstate (слушает App).
 *
 * @param {string} defaultScreen — экран по умолчанию ('overview')
 * @param {Object} backMap — карта экран → куда идти назад { detail: 'list', form: 'detail' }
 */
export function useModuleRouter(defaultScreen = 'overview', backMap = {}) {
  const [screen, setScreen] = useState(defaultScreen);
  const [params, setParams] = useState(null);
  const stackRef = useRef([defaultScreen]);

  const navigate = useCallback((target, data) => {
    stackRef.current = [...stackRef.current, target];
    setScreen(target);
    setParams(data || null);

    try {
      window.history.pushState({ lifeos: true, module: true }, '');
    } catch {}
  }, []);

  const goBack = useCallback(() => {
    if (stackRef.current.length > 1) {
      stackRef.current = stackRef.current.slice(0, -1);
      const prev = stackRef.current[stackRef.current.length - 1];
      setScreen(prev);
      setParams(null);
      return true; // handled
    }
    return false; // not handled — App should handle
  }, []);

  const reset = useCallback(() => {
    stackRef.current = [defaultScreen];
    setScreen(defaultScreen);
    setParams(null);
  }, [defaultScreen]);

  return { screen, params, navigate, goBack, reset, depth: stackRef.current.length };
}
