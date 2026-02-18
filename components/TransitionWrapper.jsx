import { useState, useEffect } from 'react';

export default function TransitionWrapper({ children, active, direction = 'left', bg }) {
  const [shouldRender, setShouldRender] = useState(active);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (active) {
      setShouldRender(true);
      requestAnimationFrame(() => setAnimating(true));
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [active]);

  if (!shouldRender) return null;

  const translateX = direction === 'left'
    ? (animating ? '0%' : '100%')
    : (animating ? '0%' : '-30%');

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      overflow: 'auto',
      WebkitOverflowScrolling: 'touch',
      transform: `translateX(${translateX})`,
      transition: 'transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1)',
      willChange: 'transform',
      background: bg || '#000',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      {children}
    </div>
  );
}
