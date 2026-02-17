import { useState, useRef, useCallback } from 'react';

/**
 * usePullToRefresh — хук для pull-to-refresh на мобильных.
 * Возвращает: { refreshing, pullDistance, handlers }
 * handlers нужно повесить на скроллируемый контейнер.
 */
export function usePullToRefresh(onRefresh, { threshold = 80 } = {}) {
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const pulling = useRef(false);

  const onTouchStart = useCallback((e) => {
    const el = e.currentTarget;
    if (el.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!pulling.current || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setPullDistance(Math.min(dy * 0.5, threshold * 1.5));
    }
  }, [refreshing, threshold]);

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      setPullDistance(threshold * 0.6);
      try { await onRefresh(); } catch { /* ignore */ }
      setRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, threshold, refreshing, onRefresh]);

  return {
    refreshing,
    pullDistance,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
