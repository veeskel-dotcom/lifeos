import { useLiveQuery } from '../../../hooks/useDB';
import WidgetCard from './WidgetCard';
import { detectAnomalies } from '../../../services/anomalies';
import { WIDGET_COLORS } from '../widgetRegistry';

export default function AnomaliesWidget({ theme, size = 'small' }) {
  const color = WIDGET_COLORS.anomalies(theme);

  const data = useLiveQuery(async () => {
    try {
      const anomalies = await detectAnomalies();
      return anomalies.length > 0 ? anomalies.slice(0, size === 'wide' ? 3 : 2) : null;
    } catch { return null; }
  });

  if (!data) return null;

  return (
    <WidgetCard title="Аномалии" icon="⚠️" color={color} theme={theme} size={size}>
      {data.map((a, i) => (
        <div
          key={i}
          className="flex items-start gap-2 py-1"
          style={i > 0 ? { borderTop: `0.5px solid ${theme.gray5}` } : {}}
        >
          <span style={{ fontSize: 14 }}>{a.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium" style={{ color: a.severity === 'warning' ? theme.red : theme.text }}>
              {a.title}
            </div>
            <div className="text-[10px]" style={{ color: theme.gray2 }}>{a.message}</div>
          </div>
        </div>
      ))}
    </WidgetCard>
  );
}
