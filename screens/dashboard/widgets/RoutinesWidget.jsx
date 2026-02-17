import { useLiveQuery } from '../../../hooks/useDB';
import WidgetCard from './WidgetCard';
import WidgetSkeleton from './WidgetSkeleton';
import ProgressRing from '../../../components/ProgressRing';
import { getRoutinesDailyStats } from '../../../services/routines';
import { WIDGET_COLORS } from '../widgetRegistry';

export default function RoutinesWidget({ theme, onNavigate, data: externalData, size = 'small' }) {
  const color = WIDGET_COLORS.routines(theme);

  const ownData = useLiveQuery(async () => {
    try {
      const stats = await getRoutinesDailyStats();
      if (!stats || stats.total === 0) return null;
      return stats;
    } catch { return null; }
  });

  const data = externalData?.loaded
    ? (externalData.routines?.total > 0 ? externalData.routines : null)
    : ownData;

  if (data === undefined) return <WidgetSkeleton theme={theme} size={size} />;
  if (!data) return null;

  const pct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;

  return (
    <WidgetCard title="Привычки" icon="🔄" color={color} theme={theme} size={size} onClick={() => onNavigate?.('routines')}>
      <div className="flex items-center gap-3">
        <ProgressRing value={data.done} max={data.total} size={52} strokeWidth={5} color={color} theme={theme}>
          <span className="font-bold" style={{ fontSize: 12, color }}>{pct}%</span>
        </ProgressRing>
        <div>
          <div className="font-bold tabular-nums" style={{ fontSize: size === 'wide' ? 36 : 28, color: theme.text }}>
            {data.done}/{data.total}
          </div>
          <div className="text-[10px]" style={{ color: theme.gray2 }}>на сегодня</div>
        </div>
      </div>
    </WidgetCard>
  );
}
