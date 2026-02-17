/**
 * Skeleton — базовые анимированные плейсхолдеры (pulse).
 * Используют theme.text с opacity для адаптации к тёмной теме.
 */

export function SkeletonLine({ width = '100%', height = 16, theme }) {
  return (
    <div
      className="animate-pulse rounded"
      style={{
        width,
        height,
        background: theme?.gray4 || 'currentColor',
        opacity: theme ? 1 : 0.1,
      }}
    />
  );
}

export function SkeletonCircle({ size = 40, theme }) {
  return (
    <div
      className="animate-pulse rounded-full"
      style={{
        width: size,
        height: size,
        background: theme?.gray4 || 'currentColor',
        opacity: theme ? 1 : 0.1,
      }}
    />
  );
}

export function SkeletonRect({ width = '100%', height = 100, radius = 16, theme }) {
  return (
    <div
      className="animate-pulse"
      style={{
        width,
        height,
        borderRadius: radius,
        background: theme?.gray4 || 'currentColor',
        opacity: theme ? 1 : 0.1,
      }}
    />
  );
}
