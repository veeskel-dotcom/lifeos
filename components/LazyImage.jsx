/**
 * M6.5: LazyImage — отложенная загрузка изображений через IntersectionObserver.
 * rootMargin: 200px — начинает загрузку за 200px до вьюпорта.
 * Fade-in при загрузке (opacity transition 0.3s).
 */
import { useState, useRef, useEffect } from 'react';

export default function LazyImage({ src, alt, className, style, placeholder }) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={{ ...style, position: 'relative', overflow: 'hidden' }}>
      {inView ? (
        <img
          src={src}
          alt={alt || ''}
          onLoad={() => setLoaded(true)}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            opacity: loaded ? 1 : 0, transition: 'opacity 0.3s',
          }}
        />
      ) : null}
      {(!inView || !loaded) && (
        <div style={{
          position: 'absolute', inset: 0,
          background: placeholder || '#f0f0f0',
          borderRadius: 'inherit',
        }} />
      )}
    </div>
  );
}
