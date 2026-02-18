import { useLiveQuery } from '../../../hooks/useDB';
import WidgetCard from './WidgetCard';
import WidgetSkeleton from './WidgetSkeleton';
import ProgressBar from '../../../components/ProgressBar';
import { getTaskStats } from '../../../services/tasks';
import { WIDGET_COLORS } from '../widgetRegistry';

export default function TasksWidget({ theme, onNavigate, data: externalData, size = 'small' }) {
  const color = WIDGET_COLORS.tasks(theme);

  const ownData = useLiveQuery(async () => {
    try {
      const stats = await getTaskStats();
      if (!stats || stats.total === 0) return null;
      return stats;
    } catch { return null; }
  });

  const data = externalData?.loaded
    ? (externalData.taskStats?.total > 0 ? externalData.taskStats : null)
    : ownData;

  if (data === undefined) return <WidgetSkeleton theme={theme} size={size} />;
  if (!data) return null;

  const pct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;

  return (
    <WidgetCard title="Задачи" iconName="task" color={color} theme={theme} size={size} onClick={() => onNavigate?.('tasks')}>
      <div className="flex items-baseline gap-1">
        <span className="font-bold tabular-nums" style={{ fontSize: size === 'wide' ? 36 : 28, color: theme.text }}>
          {data.done}
        </span>
        <span className="text-sm" style={{ color: theme.gray3 }}>/{data.total}</span>
      </div>
      <ProgressBar value={data.done} max={data.total} color={color} height={5} theme={theme} />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px]" style={{ color: theme.gray2 }}>{pct}% выполнено</span>
        {data.overdue > 0 && (
          <span className="text-[10px] font-semibold" style={{ color: theme.red }}>⚠️ {data.overdue}</span>
        )}
      </div>
    </WidgetCard>
  );
}
