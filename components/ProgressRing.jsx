/**
 * ProgressRing — кольцевой индикатор прогресса (Apple Health стиль).
 * Дочерние элементы отображаются по центру кольца.
 */
export default function ProgressRing({
  value,
  max,
  size = 100,
  strokeWidth = 8,
  color,
  children,
  theme,
}) {
  const effectiveColor = color || theme?.accent || '#007AFF';
  const trackColor = theme?.gray5 || '#E5E5EA';
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const pct = max ? Math.min((value || 0) / max, 1) : 0;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={trackColor} strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={effectiveColor} strokeWidth={strokeWidth}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {children}
      </div>
    </div>
  );
}
