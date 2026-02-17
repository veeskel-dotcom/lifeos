import { useLiveQuery } from '../../../hooks/useDB';
import WidgetCard from './WidgetCard';
import ProgressBar from '../../../components/ProgressBar';
import { refreshAllGoals, getProgress } from '../../../services/goals';
import { WIDGET_COLORS } from '../widgetRegistry';

export default function GoalsWidget({ theme, onNavigate, size = 'small' }) {
  const color = WIDGET_COLORS.goals(theme);

  const data = useLiveQuery(async () => {
    try {
      const goals = await refreshAllGoals();
      if (!goals || goals.length === 0) return null;
      return goals.slice(0, size === 'wide' ? 4 : 3);
    } catch { return null; }
  });

  if (data === undefined) return null;
  if (!data) return null;

  return (
    <WidgetCard title="Цели" icon="🎯" color={color} theme={theme} size={size} onClick={() => onNavigate?.('goals')}>
      <div className="space-y-2">
        {data.map(g => {
          const pct = getProgress(g);
          const done = pct >= 100;
          return (
            <div key={g.id} className="flex items-center gap-2">
              <span style={{ fontSize: 14 }}>{g.icon || '🎯'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs truncate" style={{ color: theme.text }}>{g.title}</span>
                  <span className="text-[10px] font-bold tabular-nums ml-1" style={{ color: done ? theme.green : theme.gray1 }}>
                    {pct}%
                  </span>
                </div>
                <ProgressBar
                  value={Math.min(g.current_value, g.target_value)}
                  max={g.target_value}
                  color={done ? theme.green : color}
                  height={4}
                  theme={theme}
                />
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
