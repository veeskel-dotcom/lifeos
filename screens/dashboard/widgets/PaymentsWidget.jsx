import { useLiveQuery } from '../../../hooks/useDB';
import WidgetCard from './WidgetCard';
import WidgetSkeleton from './WidgetSkeleton';
import { fmtMoney } from '../../../utils/currency';
import { getUpcomingPayments } from '../../../services/credits';
import { getUpcoming as getUpcomingSubs } from '../../../services/subscriptions';
import { WIDGET_COLORS } from '../widgetRegistry';

export default function PaymentsWidget({ theme, onNavigate, size = 'wide' }) {
  const color = WIDGET_COLORS.payments(theme);

  const data = useLiveQuery(async () => {
    try {
      const [credits, subs] = await Promise.all([getUpcomingPayments(30), getUpcomingSubs(30)]);
      const items = [
        ...credits.map(c => ({ type: 'credit', name: c.name, date: c.date, amount: c.amount })),
        ...subs.map(s => ({ type: 'sub', name: s.name, date: s.next_payment, amount: s.price })),
      ].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      if (items.length === 0) return null;
      return items.slice(0, 4);
    } catch { return null; }
  });

  if (data === undefined) return <WidgetSkeleton theme={theme} size={size} />;
  if (!data) return null;

  return (
    <WidgetCard title="Платежи" iconName="bell" color={color} theme={theme} size={size} onClick={() => onNavigate?.('finance')}>
      {data.map((item, i) => (
        <div
          key={i}
          className="flex items-center justify-between py-1.5"
          style={{ borderTop: i > 0 ? `0.5px solid ${theme.gray5}` : 'none' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs">{item.type === 'credit' ? '🏦' : '🔄'}</span>
            <span className="text-sm truncate" style={{ color: theme.text }}>{item.name}</span>
          </div>
          <div className="text-right shrink-0 ml-2">
            <div className="text-sm font-semibold tabular-nums" style={{ color: theme.text }}>
              {fmtMoney(item.amount)}
            </div>
            <div className="text-[10px]" style={{ color: theme.gray3 }}>{item.date?.slice(5)}</div>
          </div>
        </div>
      ))}
    </WidgetCard>
  );
}
