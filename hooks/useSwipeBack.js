/**
 * M1.2: useSwipeBack — iOS-style swipe from left edge to go back.
 * Touch starts within 20px of left edge → drag → release at >100px → trigger onBack.
 */
import { useRef, useCallback, useEffect, useState } from 'react';

export function useSwipeBack(onBack) {
  const startXRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const active = useRef(false);

  const onTouchStart = useCallback((e) => {
    const x = e.touches[0].clientX;
    if (x < 20) {
      startXRef.current = x;
      active.current = true;
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!active.current) return;
    const dx = e.touches[0].clientX - startXRef.current;
    if (dx > 0) setDragX(dx);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!active.current) return;
    if (dragX > 100) onBack?.();
    setDragX(0);
    active.current = false;
    startXRef.current = null;
  }, [dragX, onBack]);

  useEffect(() => {
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  // Overlay style for visual feedback
  const overlayStyle = dragX > 0 ? {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: Math.min(dragX, 60),
    background: `linear-gradient(to right, rgba(0,0,0,${Math.min(dragX / 400, 0.15)}), transparent)`,
    zIndex: 9999,
    pointerEvents: 'none',
  } : null;

  return { dragX, overlayStyle };
}
