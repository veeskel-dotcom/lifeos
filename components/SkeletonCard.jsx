import { SkeletonLine, SkeletonRect } from './Skeleton';

/**
 * SkeletonCard — плейсхолдер для Dashboard-виджетов.
 * Повторяет Card: borderRadius 16, padding 16.
 * Варианты: 'default' | 'compact' | 'chart'
 */
export default function SkeletonCard({ variant = 'default', theme }) {
  const bg = theme?.card || '#fff';

  return (
    <div style={{ background: bg, borderRadius: 16, padding: 16, marginBottom: 12 }}>
      {variant === 'chart' ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <SkeletonLine width="40%" height={14} theme={theme} />
            <SkeletonLine width="20%" height={12} theme={theme} />
          </div>
          <SkeletonRect width="100%" height={120} radius={8} theme={theme} />
        </>
      ) : variant === 'compact' ? (
        <div className="flex items-center gap-3">
          <SkeletonLine width={40} height={40} theme={theme} />
          <div className="flex-1 flex flex-col gap-2">
            <SkeletonLine width="60%" height={14} theme={theme} />
            <SkeletonLine width="40%" height={10} theme={theme} />
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <SkeletonLine width="50%" height={14} theme={theme} />
            <SkeletonLine width="25%" height={12} theme={theme} />
          </div>
          <div className="flex flex-col gap-2 mb-3">
            <SkeletonLine width="90%" height={12} theme={theme} />
            <SkeletonLine width="70%" height={12} theme={theme} />
          </div>
          <SkeletonRect width="100%" height={8} radius={4} theme={theme} />
        </>
      )}
    </div>
  );
}
