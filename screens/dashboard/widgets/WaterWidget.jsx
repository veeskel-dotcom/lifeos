import { useLiveQuery } from '../../../hooks/useDB';
import WidgetCard from './WidgetCard';
import WidgetSkeleton from './WidgetSkeleton';
import ProgressRing from '../../../components/ProgressRing';
import { getWaterProgress } from '../../../services/water';
import { WIDGET_COLORS } from '../widgetRegistry';

export default function WaterWidget({ theme, onNavigate, data: externalData, size = 'small' }) {
  const color = WIDGET_COLORS.water(theme);

  const ownData = useLiveQuery(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const progress = await getWaterProgress(today);
      if (!progress || progress.current === 0) return null;
      return progress;
    } catch { return null; }
  });

  const data = externalData?.loaded
    ? (externalData.water?.current > 0
      ? { ...externalData.water, percent: externalData.water.goal > 0 ? Math.round((externalData.water.current / externalData.water.goal) * 100) : 0 }
      : null)
    : ownData;

  if (data === undefined) return <WidgetSkeleton theme={theme} size={size} />;
  if (!data) return null;

  const pct = data.percent ?? (data.goal > 0 ? Math.round((data.current / data.goal) * 100) : 0);

  return (
    <WidgetCard title="Вода" iconName="drop" color={color} theme={theme} size={size} onClick={() => onNavigate?.('nutrition')}>
      <div className="flex items-center gap-3">
        <ProgressRing value={data.current} max={data.goal} size={52} strokeWidth={5} color={color} theme={theme}>
          <span className="font-bold" style={{ fontSize: 11, color }}>{pct}%</span>
        </ProgressRing>
        <div>
          <div className="font-bold tabular-nums" style={{ fontSize: 28, color: theme.text }}>{data.current}</div>
          <div className="text-[10px]" style={{ color: theme.gray2 }}>мл из {data.goal}</div>
        </div>
      </div>
    </WidgetCard>
  );
}
