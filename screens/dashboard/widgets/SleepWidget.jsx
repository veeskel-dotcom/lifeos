import { useState, useEffect } from 'react';
import WidgetCard from './WidgetCard';
import WidgetSkeleton from './WidgetSkeleton';
import { getSleep, getBedtimeRecommendation } from '../../../services/sleep';
import { WIDGET_COLORS } from '../widgetRegistry';

export default function SleepWidget({ theme, onNavigate, size = 'small' }) {
  const color = WIDGET_COLORS.sleep(theme);
  const [data, setData] = useState(undefined);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const sleep = await getSleep(today);
        if (!sleep) { setData(null); return; }
        const rec = await getBedtimeRecommendation().catch(() => null);
        setData({ ...sleep, recommendation: rec });
      } catch { setData(null); }
    })();
  }, []);

  if (data === undefined) return <WidgetSkeleton theme={theme} size={size} />;
  if (!data) return null;

  const hours = data.duration_hours ?? (data.duration_min ? (data.duration_min / 60).toFixed(1) : null);
  const quality = data.quality;

  const qualityLabel = quality >= 8 ? 'Отлично' : quality >= 6 ? 'Хорошо' : quality >= 4 ? 'Средне' : 'Плохо';
  const qualityColor = quality >= 8 ? theme.green : quality >= 6 ? color : quality >= 4 ? theme.orange : theme.red;

  return (
    <WidgetCard title="Сон" iconName="moon" color={color} theme={theme} size={size} onClick={() => onNavigate?.('sleep')}>
      <div className="flex items-baseline gap-1">
        <span className="font-bold tabular-nums" style={{ fontSize: size === 'wide' ? 36 : 28, color: theme.text }}>
          {hours || '—'}
        </span>
        <span className="text-xs" style={{ color: theme.gray2 }}>ч</span>
      </div>
      {quality != null && (
        <div className="text-xs font-semibold mt-1" style={{ color: qualityColor }}>
          {qualityLabel}
        </div>
      )}
      {size === 'wide' && data.recommendation && (
        <div className="text-[10px] mt-2" style={{ color: theme.gray2 }}>
          💡 {data.recommendation.message || `Ложись в ${data.recommendation.bedtime}`}
        </div>
      )}
    </WidgetCard>
  );
}
