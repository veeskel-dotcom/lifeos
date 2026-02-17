import { SkeletonCircle, SkeletonLine } from './Skeleton';

/**
 * SkeletonList — плейсхолдер для экранов-списков.
 * Повторяет Card с N строками (circle + 2 линии).
 */
export default function SkeletonList({ count = 5, theme }) {
  const bg = theme?.card || '#fff';

  return (
    <div style={{ background: bg, borderRadius: 16, overflow: 'hidden' }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3"
          style={{
            borderBottom: i < count - 1
              ? `0.5px solid ${theme?.gray5 || '#e5e5e5'}`
              : 'none',
          }}
        >
          <SkeletonCircle size={32} theme={theme} />
          <div className="flex-1 flex flex-col gap-1.5">
            <SkeletonLine
              width={`${55 + Math.round(Math.sin(i * 2.3) * 20)}%`}
              height={14}
              theme={theme}
            />
            <SkeletonLine
              width={`${35 + Math.round(Math.cos(i * 1.7) * 15)}%`}
              height={10}
              theme={theme}
            />
          </div>
          <SkeletonLine width={48} height={12} theme={theme} />
        </div>
      ))}
    </div>
  );
}
