import { useLiveQuery } from '../../../hooks/useDB';
import WidgetCard from './WidgetCard';
import WidgetSkeleton from './WidgetSkeleton';
import { fmtMoney } from '../../../utils/currency';
import { getPortfolioValue, getDailyChange, getPortfolioPnL } from '../../../services/portfolio';
import { WIDGET_COLORS } from '../widgetRegistry';

export default function PortfolioWidget({ theme, onNavigate, size = 'wide' }) {
  const color = WIDGET_COLORS.portfolio(theme);

  const data = useLiveQuery(async () => {
    try {
      const [value, change, pnl] = await Promise.all([getPortfolioValue(), getDailyChange(), getPortfolioPnL()]);
      if (!value || value === 0) return null;
      return { value, change, pnl };
    } catch { return null; }
  });

  if (data === undefined) return <WidgetSkeleton theme={theme} size={size} />;
  if (!data) return null;

  const changeColor = data.change >= 0 ? theme.green : theme.red;
  const changeSign = data.change >= 0 ? '+' : '';

  return (
    <WidgetCard title="Портфель" icon="📈" color={color} theme={theme} size={size} onClick={() => onNavigate?.('invest')}>
      {size === 'wide' ? (
        <div className="flex items-end justify-between">
          <div>
            <div className="font-bold tabular-nums" style={{ fontSize: 36, color: theme.text }}>
              {fmtMoney(data.value)}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-semibold tabular-nums" style={{ color: changeColor }}>
                {changeSign}{fmtMoney(data.change)} за день
              </span>
              {data.pnl != null && data.pnl !== 0 && (
                <span className="text-[10px] tabular-nums" style={{ color: data.pnl >= 0 ? theme.green : theme.red }}>
                  PnL {data.pnl >= 0 ? '+' : ''}{fmtMoney(data.pnl)}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="font-bold tabular-nums" style={{ fontSize: 28, color: theme.text }}>
            {fmtMoney(data.value)}
          </div>
          <div className="text-xs font-semibold tabular-nums mt-1" style={{ color: changeColor }}>
            {changeSign}{fmtMoney(data.change)}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: theme.gray2 }}>за день</div>
        </>
      )}
    </WidgetCard>
  );
}
