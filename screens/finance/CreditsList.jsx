import { useMemo } from 'react';
import { useCredits } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import { fmtMoney } from '../../utils/currency';
import EmptyState from '../../components/EmptyState';
import ProgressBar from '../../components/ProgressBar';

import SkeletonList from '../../components/SkeletonList';
import ScreenWrapper from '../../components/ScreenWrapper';
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
}

function formatPaymentDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function CreditsList({ theme, onBack, onNavigate }) {
  const credits = useCredits();

  const nearest = useMemo(() => {
    if (!credits?.length) return null;
    const upcoming = credits
      .filter(c => c.next_payment_date && daysUntil(c.next_payment_date) >= 0)
      .sort((a, b) => daysUntil(a.next_payment_date) - daysUntil(b.next_payment_date));
    return upcoming[0] || null;
  }, [credits]);

  if (!credits) {
    return (
      <ScreenWrapper theme={theme}>
        <NavHeader title="Кредиты" onBack={onBack} left="Финансы" theme={theme} />
        <div className="p-4">
          <SkeletonList count={5} theme={theme} />
        </div>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper theme={theme}>
      <NavHeader title="Кредиты" onBack={onBack} left="Финансы" theme={theme} />

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Nearest payment banner — proto S7 */}
        {nearest && (
          <Card theme={theme} style={{ margin: '4px 16px 8px', cursor: 'pointer' }}
            onClick={() => onNavigate('creditDetail', { detailId: nearest.id })}>
            <div style={{ fontSize: 11, fontWeight: 600, color: theme.orange, letterSpacing: 0.3, marginBottom: 6 }}>БЛИЖАЙШИЙ ПЛАТЁЖ</div>
            <div className="flex items-center" style={{ gap: 10 }}>
              <div className="flex items-center justify-center shrink-0"
                style={{ width: 40, height: 40, borderRadius: 12, background: (theme.green || '#34C759') + '15', fontSize: 20 }}>
                {nearest.type === 'card' ? '💳' : '🏠'}
              </div>
              <div className="flex-1">
                <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{nearest.name}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: theme.orange }}>
                  через {daysUntil(nearest.next_payment_date)} дн. · {formatPaymentDate(nearest.next_payment_date)}
                </div>
              </div>
              <span className="tabular-nums" style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>
                {fmtMoney(nearest.monthly_payment || 0)}
              </span>
            </div>
          </Card>
        )}

        {/* Summary cards — proto S7 */}
        {credits.length > 0 && (
          <div className="flex" style={{ gap: 8, padding: '0 16px 8px' }}>
            {[
              { label: 'Общий долг', value: fmtMoney(credits.reduce((s, c) => s + (c.remaining_amount || 0), 0)), color: theme.text },
              { label: 'Платежей/мес', value: fmtMoney(credits.reduce((s, c) => s + (c.monthly_payment || 0), 0)), color: theme.red },
              { label: 'Средняя ставка', value: (credits.reduce((s, c) => s + (c.rate || 0), 0) / credits.length).toFixed(1) + '%', color: theme.orange },
            ].map(s => (
              <div key={s.label} className="flex-1 text-center" style={{ background: theme.card, borderRadius: 12, padding: '10px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: theme.gray2, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* All credits */}
        <div style={{ padding: '4px 16px 4px' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>ВСЕ КРЕДИТЫ</span>
        </div>
        {credits.length === 0 ? (
          <div style={{ padding: '0 16px' }}>
            <EmptyState icon="💳" title="Нет кредитов" subtitle="И это прекрасно! 🎉"
              actionLabel="＋ Добавить кредит" onAction={() => onNavigate('creditForm')} theme={theme} />
          </div>
        ) : (
          credits.map(c => {
            const paid = (c.total_amount || 0) - (c.remaining_amount || 0);
            const pctPaid = c.total_amount > 0 ? Math.round((paid / c.total_amount) * 100) : 0;
            const isCard = c.type === 'card';
            const loanColor = isCard ? (theme.yellow || '#FFCC00') : (theme.green || '#34C759');
            return (
              <Card key={c.id} theme={theme} style={{ margin: '0 16px 8px', cursor: 'pointer' }}
                onClick={() => onNavigate('creditDetail', { detailId: c.id })}>
                {/* Header */}
                <div className="flex items-center" style={{ gap: 10, marginBottom: 10 }}>
                  <div className="flex items-center justify-center shrink-0"
                    style={{ width: 42, height: 42, borderRadius: 12, background: loanColor + '12', fontSize: 22 }}>
                    {isCard ? '💳' : '🏠'}
                  </div>
                  <div className="flex-1">
                    <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: theme.gray2 }}>
                      {isCard ? 'Кредитная карта' : 'Кредит'}{c.payment_day ? ` · платёж ${c.payment_day}-го` : ''}
                    </div>
                  </div>
                  <span style={{ color: theme.gray3, fontSize: 16 }}>→</span>
                </div>
                {/* Debt progress */}
                <div className="flex justify-between" style={{ marginBottom: 4 }}>
                  <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>
                    Остаток: {fmtMoney(c.remaining_amount || 0)}
                  </span>
                  <span className="tabular-nums" style={{ fontSize: 12, color: theme.gray2 }}>
                    из {fmtMoney(c.total_amount || 0)}
                  </span>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <ProgressBar value={paid} max={c.total_amount || 1} color={loanColor} height={4} theme={theme} />
                </div>
                {/* Tags */}
                <div className="flex flex-wrap" style={{ gap: 4 }}>
                  {c.rate && <span style={{ padding: '3px 8px', borderRadius: 6, background: theme.gray5, fontSize: 11, color: theme.gray2 }}>{c.rate}%</span>}
                  {c.monthly_payment && <span style={{ padding: '3px 8px', borderRadius: 6, background: theme.gray5, fontSize: 11, color: theme.gray2 }}>{fmtMoney(c.monthly_payment)}/мес</span>}
                  {c.end_date && <span style={{ padding: '3px 8px', borderRadius: 6, background: theme.gray5, fontSize: 11, color: theme.gray2 }}>до {new Date(c.end_date).getFullYear()}</span>}
                  {isCard && c.grace_period_end && <span style={{ padding: '3px 8px', borderRadius: 6, background: (theme.green || '#34C759') + '15', fontSize: 11, fontWeight: 500, color: theme.green || '#34C759' }}>✓ грейс до {formatPaymentDate(c.grace_period_end)}</span>}
                </div>
              </Card>
            );
          })
        )}
        {/* Dashed add — proto S7 */}
        <div style={{ padding: '4px 16px 16px' }}>
          <div onClick={() => onNavigate('creditForm')} className="cursor-pointer"
            style={{ padding: 14, borderRadius: 12, border: `1.5px dashed ${theme.gray3}`, textAlign: 'center', fontSize: 15, color: theme.gray2 }}>
            ＋ Добавить кредит
          </div>
        </div>
      </div>
    </ScreenWrapper>
  );
}
