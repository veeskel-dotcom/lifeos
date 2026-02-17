/**
 * ProgressBar — горизонтальный индикатор прогресса.
 * Закруглённые концы, анимированная ширина.
 */
export default function ProgressBar({
  value,
  max,
  color,
  height = 6,
  theme,
}) {
  const effectiveColor = color || theme?.accent || '#007AFF';
  const trackColor = theme?.gray5 || '#E5E5EA';
  const pct = Math.min(value / max, 1) * 100;

  return (
    <div style={{
      width: '100%',
      height,
      background: trackColor,
      borderRadius: height / 2,
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`,
        height: '100%',
        background: effectiveColor,
        borderRadius: height / 2,
        transition: 'width 0.6s ease',
      }} />
    </div>
  );
}
