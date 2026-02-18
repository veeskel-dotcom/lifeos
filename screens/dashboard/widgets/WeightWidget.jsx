import { useLiveQuery } from '../../../hooks/useDB';
import WidgetCard from './WidgetCard';
import WidgetSkeleton from './WidgetSkeleton';
import Sparkline from './Sparkline';
import { getLatest as getLatestWeight, getTrend, getWeights } from '../../../services/bodyweight';
import { WIDGET_COLORS } from '../widgetRegistry';

export default function WeightWidget({ theme, onNavigate, size = 'wide' }) {
  const color = WIDGET_COLORS.weight(theme);

  const data = useLiveQuery(async () => {
    try {
      const [latest, weights] = await Promise.all([getLatestWeight(), getWeights(30)]);
      if (!latest) return null;
      const trend = getTrend(weights);
      return { latest, weights, trend };
    } catch { return null; }
  });

  if (data === undefined) return <WidgetSkeleton theme={theme} size={size} />;
  if (!data) return (
    <WidgetCard title="Вес" iconName="weight" color={color} theme={theme} size={size} onClick={() => onNavigate?.('sport')}>
      <span className="font-bold" style={{ fontSize: 28, color: theme.gray3 }}>— <span className="text-xs font-normal">кг</span></span>
      <div className="text-[10px] mt-1" style={{ color: theme.gray2 }}>Запишите вес</div>
    </WidgetCard>
  );

  const sparkData = data.weights?.map(w => w.weight) || [];
  const delta = data.trend;
  const deltaColor = delta === null ? theme.gray3 : delta < 0 ? theme.green : theme.red;
  const deltaLabel = delta === null ? '' : (delta > 0 ? '+' : '') + delta.toFixed(1);

  return (
    <WidgetCard title="Вес" iconName="weight" color={color} theme={theme} size={size} onClick={() => onNavigate?.('sport')}>
      {size === 'wide' ? (
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold tabular-nums" style={{ fontSize: 36, color: theme.text }}>
                {data.latest.weight}
              </span>
              <span className="text-xs" style={{ color: theme.gray2 }}>кг</span>
              {deltaLabel && (
                <span className="text-sm font-semibold tabular-nums ml-1" style={{ color: deltaColor }}>
                  {deltaLabel}
                </span>
              )}
            </div>
            <div className="text-[10px] mt-1" style={{ color: theme.gray2 }}>
              за 30 дней
            </div>
          </div>
          <Sparkline data={sparkData} width={120} height={40} color={color} />
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-1">
            <span className="font-bold tabular-nums" style={{ fontSize: 28, color: theme.text }}>
              {data.latest.weight}
            </span>
            <span className="text-xs" style={{ color: theme.gray2 }}>кг</span>
          </div>
          {deltaLabel && (
            <div className="text-xs font-semibold tabular-nums mt-0.5" style={{ color: deltaColor }}>
              {deltaLabel} кг
            </div>
          )}
          <div className="mt-2">
            <Sparkline data={sparkData} width={100} height={28} color={color} />
          </div>
        </>
      )}
    </WidgetCard>
  );
}
