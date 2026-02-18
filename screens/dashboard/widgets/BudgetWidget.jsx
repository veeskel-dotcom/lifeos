import { useLiveQuery } from '../../../hooks/useDB';
import WidgetCard from './WidgetCard';
import WidgetSkeleton from './WidgetSkeleton';
import ProgressBar from '../../../components/ProgressBar';
import { fmtMoney } from '../../../utils/currency';
import { getTodayStats } from '../../../services/expenses';
import { getOverallBudget } from '../../../services/budgets';
import { WIDGET_COLORS } from '../widgetRegistry';

export default function BudgetWidget({ theme, onNavigate, data: externalData, size = 'wide' }) {
  const color = WIDGET_COLORS.budget(theme);

  const ownData = useLiveQuery(async () => {
    try {
      const month = new Date().toISOString().slice(0, 7);
      const [budget, today] = await Promise.all([getOverallBudget(month), getTodayStats()]);
      if (!budget || !budget.total || budget.total === 0) return null;
      return { ...budget, todaySpent: today.total, todayCount: today.count };
    } catch { return null; }
  });

  const data = externalData?.loaded
    ? (externalData.budget?.total > 0
      ? { ...externalData.budget, todaySpent: externalData.todayExpenses?.total || 0, todayCount: externalData.todayExpenses?.count || 0 }
      : null)
    : ownData;

  if (data === undefined) return <WidgetSkeleton theme={theme} size={size} />;
  if (!data) return (
    <WidgetCard title="Бюджет" iconName="wallet" color={color} theme={theme} size={size} onClick={() => onNavigate?.('finance')}>
      <span className="font-bold" style={{ fontSize: 28, color: theme.gray3 }}>—</span>
      <div className="text-[10px] mt-1" style={{ color: theme.gray2 }}>Установите бюджет</div>
    </WidgetCard>
  );

  const pct = data.total > 0 ? Math.round((data.spent / data.total) * 100) : 0;
  const isOver = data.spent > data.total;
  const barColor = isOver ? theme.red : color;

  return (
    <WidgetCard title="Бюджет" iconName="wallet" color={color} theme={theme} size={size} onClick={() => onNavigate?.('finance')}>
      {size === 'wide' ? (
        <>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-bold tabular-nums" style={{ fontSize: 36, color: theme.text }}>
              {fmtMoney(data.spent)}
            </span>
            <span className="text-xs" style={{ color: theme.gray2 }}>
              из {fmtMoney(data.total)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ProgressBar value={data.spent} max={data.total} color={barColor} height={6} theme={theme} />
            </div>
            <span className="text-xs font-bold tabular-nums" style={{ color: isOver ? theme.red : theme.gray2 }}>
              {pct}%
            </span>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div>
              <span className="text-sm font-semibold tabular-nums" style={{ color: theme.text }}>
                {fmtMoney(data.remaining)}
              </span>
              <span className="text-[10px] ml-1" style={{ color: theme.gray2 }}>осталось</span>
            </div>
            {data.todayCount > 0 && (
              <div className="text-right">
                <span className="text-sm font-semibold tabular-nums" style={{ color: theme.orange }}>
                  −{fmtMoney(data.todaySpent)}
                </span>
                <span className="text-[10px] ml-1" style={{ color: theme.gray3 }}>сегодня</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="font-bold tabular-nums" style={{ fontSize: 28, color: theme.text }}>
            {fmtMoney(data.remaining)}
          </div>
          <div className="text-xs mt-0.5" style={{ color: theme.gray2 }}>осталось</div>
          <ProgressBar value={data.spent} max={data.total} color={barColor} height={5} theme={theme} />
          <div className="text-[10px] mt-1.5 tabular-nums" style={{ color: isOver ? theme.red : theme.gray2 }}>
            {pct}% · {fmtMoney(data.dailyLimit)}/день
          </div>
        </>
      )}
    </WidgetCard>
  );
}
