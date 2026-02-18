import { useLiveQuery } from '../../../hooks/useDB';
import WidgetCard from './WidgetCard';
import WidgetSkeleton from './WidgetSkeleton';
import { getStats as getWorkoutStats } from '../../../services/workouts';
import { WIDGET_COLORS } from '../widgetRegistry';

export default function SportWidget({ theme, onNavigate, data: externalData, size = 'small' }) {
  const color = WIDGET_COLORS.sport(theme);

  const ownData = useLiveQuery(async () => {
    try {
      const stats = await getWorkoutStats();
      if (!stats || stats.totalWorkouts === 0) return null;
      return stats;
    } catch { return null; }
  });

  const data = externalData?.loaded
    ? (externalData.workouts?.total > 0
      ? { thisWeek: externalData.workouts.thisWeek, totalWorkouts: externalData.workouts.total, streak: externalData.workouts.streak || 0, avgDuration: externalData.workouts.avgDuration || 0 }
      : null)
    : ownData;

  if (data === undefined) return <WidgetSkeleton theme={theme} size={size} />;
  if (!data) return (
    <WidgetCard title="Спорт" iconName="gym" color={color} theme={theme} size={size} onClick={() => onNavigate?.('sport')}>
      <span className="font-bold" style={{ fontSize: 28, color: theme.gray3 }}>—</span>
      <div className="text-[10px] mt-1" style={{ color: theme.gray2 }}>Начните тренировку</div>
    </WidgetCard>
  );

  return (
    <WidgetCard title="Спорт" iconName="gym" color={color} theme={theme} size={size} onClick={() => onNavigate?.('sport')}>
      <div className="flex items-baseline gap-1">
        <span className="font-bold tabular-nums" style={{ fontSize: size === 'wide' ? 36 : 28, color: theme.text }}>
          {data.thisWeek}
        </span>
        <span className="text-xs" style={{ color: theme.gray2 }}>на неделе</span>
      </div>
      <div className="text-[10px] mt-1" style={{ color: theme.gray2 }}>
        {data.streak > 0 ? `🔥 ${data.streak} дн. подряд` : `Всего ${data.totalWorkouts}`}
        {data.avgDuration > 0 ? ` · ~${data.avgDuration} мин` : ''}
      </div>
      {size === 'wide' && (
        <div className="flex gap-4 mt-2">
          <div className="text-[10px]" style={{ color: theme.gray1 }}>
            <span className="font-semibold">{data.totalWorkouts}</span> всего
          </div>
          {data.avgDuration > 0 && (
            <div className="text-[10px]" style={{ color: theme.gray1 }}>
              <span className="font-semibold">~{data.avgDuration}</span> мин/тр
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
