import { useMemo } from 'react';
import { useAccounts } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import { fmtMoney, getSymbolForCode } from '../../utils/currency';
import Ic from '../../components/Icon';

import SkeletonList from '../../components/SkeletonList';
const TYPE_LABELS = {
  debit: 'Дебетовые',
  credit: 'Кредитные',
  savings: 'Накопительные',
  cash: 'Наличные',
};

const TYPE_ORDER = ['debit', 'credit', 'savings', 'cash'];

export default function AccountsList({ theme, onBack, onNavigate }) {
  const accounts = useAccounts();

  const grouped = useMemo(() => {
    if (!accounts) return null;
    const groups = {};
    accounts.forEach(a => {
      const t = a.type || 'debit';
      if (!groups[t]) groups[t] = [];
      groups[t].push(a);
    });
    return TYPE_ORDER.filter(t => groups[t]?.length).map(t => ({
      type: t,
      label: TYPE_LABELS[t],
      items: groups[t],
    }));
  }, [accounts]);

  const totalBalance = useMemo(() => {
    if (!accounts) return 0;
    return accounts
      .filter(a => a.type !== 'credit')
      .reduce((s, a) => s + (a.balance || 0), 0);
  }, [accounts]);

  if (!grouped) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
        <NavHeader title="Счета" onBack={onBack} left="Финансы" theme={theme} />
        <div className="p-4">
          <SkeletonList count={5} theme={theme} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Счета" onBack={onBack} left="Финансы" theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {/* Total balance */}
        <div className="text-center py-4">
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
            Общий баланс
          </div>
          <div className="tabular-nums" style={{ fontSize: 32, fontWeight: 700, color: theme.text, marginTop: 4 }}>
            {fmtMoney(totalBalance)}
          </div>
        </div>

        {/* Groups */}
        {grouped.map(group => (
          <div key={group.type} className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wide py-2" style={{ color: theme.gray1 }}>
              {group.label}
            </div>
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
              {group.items.map((a, i) => (
                <div key={a.id}>
                  {i > 0 && <div className="mx-4" style={{ borderTop: `0.5px solid ${theme.gray5}` }} />}
                  <div
                    className="flex items-center px-4 py-3 cursor-pointer active:opacity-70"
                    onClick={() => onNavigate('accountDetail', { detailId: a.id })}
                  >
                    {/* Icon 40×40 r12 — proto S6 */}
                    {a.type === 'cash' ? (
                      <Ic name="money" color={a.color || '#007AFF'} size={40} r={12} />
                    ) : (
                      <div className="flex items-center justify-center shrink-0"
                        style={{ width: 40, height: 40, borderRadius: 12, background: (a.color || '#007AFF'), fontSize: 16 }}>
                        <span style={{ color: '#fff', fontWeight: 700 }}>{(a.name || 'A').charAt(0)}</span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: theme.text }}>
                        {a.name || a.bank}
                      </div>
                      {a.type === 'credit' ? (
                        <div className="text-xs mt-0.5" style={{ color: theme.gray2 }}>
                          Кредитная · Доступно: {fmtMoney((a.limit || 0) - Math.abs(a.balance || 0))}
                          {a.limit && ` · Лимит ${(a.limit / 1000).toFixed(0)}К`}
                          {a.next_payment_date && ` · Платёж ${a.next_payment_date}`}
                        </div>
                      ) : (
                        <div className="text-xs mt-0.5" style={{ color: theme.gray2 }}>
                          {TYPE_LABELS[a.type]?.replace(/Ы[ЕЙ]$/, 'ая') || 'Дебетовая'}
                        </div>
                      )}
                    </div>

                    <div className="text-right ml-2">
                      {a.type === 'credit' ? (
                        <span className="tabular-nums" style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>
                          {fmtMoney((a.limit || 0) - Math.abs(a.balance || 0))}
                        </span>
                      ) : (
                        <span className="tabular-nums" style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>
                          {fmtMoney(a.balance || 0)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        ))}

        {/* Empty state */}
        {grouped.length === 0 && (
          <EmptyState
            icon="🏦" title="Нет счетов" subtitle="Добавьте банковский счёт"
            actionLabel="＋ Счёт" onAction={() => onNavigate('accountForm')} theme={theme}
          />
        )}

        {/* Add button */}
        <button
          onClick={() => onNavigate('accountForm')}
          className="w-full py-3.5 rounded-xl font-semibold text-base mt-2"
          style={{ background: theme.accent, color: '#fff' }}
        >
          ＋ Добавить счёт
        </button>
      </div>
    </div>
  );
}
