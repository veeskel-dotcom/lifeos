import { useLiveQuery } from '../../../hooks/useDB';
import WidgetCard from './WidgetCard';
import WidgetSkeleton from './WidgetSkeleton';
import ProgressBar from '../../../components/ProgressBar';
import { getDailyTotals, getGoals } from '../../../services/nutrition';
import { WIDGET_COLORS } from '../widgetRegistry';

export default function NutritionWidget({ theme, onNavigate, data: externalData, size = 'small' }) {
  const color = WIDGET_COLORS.nutrition(theme);

  const ownData = useLiveQuery(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [totals, goals] = await Promise.all([getDailyTotals(today), getGoals()]);
      if (!totals || (totals.calories === 0 && totals.protein === 0)) return null;
      return { totals, goals };
    } catch { return null; }
  });

  const data = externalData?.loaded
    ? ((externalData.nutrition?.calories > 0 || externalData.nutrition?.protein > 0)
      ? { totals: externalData.nutrition, goals: externalData.nutritionGoals }
      : null)
    : ownData;

  if (data === undefined) return <WidgetSkeleton theme={theme} size={size} />;
  if (!data) return null;

  const { totals, goals } = data;
  const calPct = goals.calories > 0 ? Math.round((totals.calories / goals.calories) * 100) : 0;

  return (
    <WidgetCard title="Питание" icon="🍎" color={color} theme={theme} size={size} onClick={() => onNavigate?.('nutrition')}>
      <div className="flex items-baseline gap-1">
        <span className="font-bold tabular-nums" style={{ fontSize: size === 'wide' ? 36 : 28, color: theme.text }}>
          {totals.calories}
        </span>
        <span className="text-xs" style={{ color: theme.gray2 }}>ккал</span>
      </div>
      <ProgressBar value={totals.calories} max={goals.calories || 2200} color={color} height={5} theme={theme} />
      <div className="text-[10px] mt-1.5" style={{ color: theme.gray2 }}>
        цель {goals.calories} · {calPct}%
      </div>
      {size === 'wide' && (
        <div className="flex gap-3 mt-2">
          {[
            { label: 'Б', val: totals.protein },
            { label: 'Ж', val: totals.fat },
            { label: 'У', val: totals.carbs },
          ].map(m => (
            <div key={m.label} className="text-[10px]" style={{ color: theme.gray1 }}>
              <span className="font-semibold">{m.label}</span> {Math.round(m.val || 0)}г
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
