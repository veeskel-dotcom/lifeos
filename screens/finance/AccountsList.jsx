import { useMemo } from 'react';
import { useAccounts, useActiveCredits } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import { fmtMoney, getSymbolForCode } from '../../utils/currency';

import SkeletonList from '../../components/SkeletonList';

/**
 * AccountsList — Экран «Счета» (proto S6).
 * Группы: БАНКОВСКИЕ КАРТЫ (debit+credit), НАЛИЧНЫЕ (cash), КРЕДИТЫ.
 * Иконка — цветной круг 40×40 r12 с буквой банка.
 * Подзаголовок: *1234 · Дебетовая.
 */
export default function AccountsList({ theme, onBack, onNavigate }) {
  const accounts = useAccounts();
  const credits = useActiveCredits();

  // Proto S6: группировка — Банковские карты (debit+credit), Наличные (cash)
  const { cardAccounts, cashAccounts } = useMemo(() => {
    if (!accounts) return { cardAccounts: [], cashAccounts: [] };
    return {
      cardAccounts: accounts.filter(a => a.type !== 'cash'),
      cashAccounts: accounts.filter(a => a.type === 'cash'),
    };
  }, [accounts]);

  const totalBalance = useMemo(() => {
    if (!accounts) return 0;
    return accounts
      .filter(a => a.type !== 'credit')
      .reduce((s, a) => s + (a.balance || 0), 0);
  }, [accounts]);

  if (!accounts) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
        <NavHeader title="Счета" onBack={onBack} left="Финансы" theme={theme}
          rightContent={
            <button onClick={() => onNavigate('accountForm')} style={{ color: theme.accent, fontSize: 17, fontWeight: 500, minHeight: 44, minWidth: 44 }}>+</button>
          }
        />
        <div className="p-4">
          <SkeletonList count={5} theme={theme} />
        </div>
      </div>
    );
  }

  const hasAny = cardAccounts.length > 0 || cashAccounts.length > 0;

  // Subtitle for account row: *1234 · Дебетовая
  const getSubtitle = (a) => {
    const num = a.card_number ? `*${a.card_number.slice(-4)}` : a.bank || '';
    if (a.type === 'credit') {
      const limit = a.limit ? ` · лимит ${fmtMoney(a.limit)}` : '';
      return `${num} · Кредитная${limit}`;
    }
    if (a.type === 'savings') return `${num} · Накопительный`;
    return `${num} · Дебетовая`;
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Счета" onBack={onBack} left="Финансы" theme={theme}
        rightContent={
          <button onClick={() => onNavigate('accountForm')} style={{ color: theme.accent, fontSize: 22, fontWeight: 400, minHeight: 44, minWidth: 44 }}>+</button>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {/* Total balance — proto S6 */}
        <Card theme={theme} style={{ marginBottom: 12 }}>
          <div className="text-center py-2">
            <div style={{ fontSize: 12, color: theme.gray1 }}>Общий баланс</div>
            <div className="tabular-nums" style={{ fontSize: 32, fontWeight: 700, color: theme.text, marginTop: 4 }}>
              {fmtMoney(totalBalance)}
            </div>
          </div>
        </Card>

        {/* БАНКОВСКИЕ КАРТЫ — proto S6 */}
        {cardAccounts.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wide py-2" style={{ color: theme.gray1 }}>
              Банковские карты
            </div>
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
              {cardAccounts.map((a, i) => (
                <div key={a.id}
                  className="flex items-center cursor-pointer active:opacity-70"
                  style={{ gap: 10, padding: '14px 14px', borderBottom: i < cardAccounts.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}
                  onClick={() => onNavigate('accountDetail', { detailId: a.id })}
                >
                  {/* Color circle with bank letter — proto S6 */}
                  <div className="flex items-center justify-center shrink-0"
                    style={{ width: 40, height: 40, borderRadius: 12, background: a.color || theme.accent }}>
                    <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
                      {(a.bank || a.name || 'A').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: theme.gray2 }}>{getSubtitle(a)}</div>
                  </div>
                  <span className="tabular-nums" style={{
                    fontSize: 15, fontWeight: 600,
                    color: a.type === 'credit' && (a.balance || 0) < 0 ? theme.red : theme.text,
                  }}>
                    {fmtMoney(a.balance || 0, getSymbolForCode(a.currency))}
                  </span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* НАЛИЧНЫЕ — proto S6 */}
        {cashAccounts.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wide py-2" style={{ color: theme.gray1 }}>
              Наличные
            </div>
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
              {cashAccounts.map((a, i) => (
                <div key={a.id}
                  className="flex items-center cursor-pointer active:opacity-70"
                  style={{ gap: 10, padding: '14px 14px', borderBottom: i < cashAccounts.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}
                  onClick={() => onNavigate('accountDetail', { detailId: a.id })}
                >
                  <div className="flex items-center justify-center shrink-0"
                    style={{ width: 40, height: 40, borderRadius: 12, background: (theme.green || '#34C759') + '15' }}>
                    <span style={{ fontSize: 18 }}>💵</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{a.name || 'Наличные'}</div>
                    <div style={{ fontSize: 12, color: theme.gray2 }}>Кошелёк</div>
                  </div>
                  <span className="tabular-nums" style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>
                    {fmtMoney(a.balance || 0, getSymbolForCode(a.currency))}
                  </span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* КРЕДИТЫ — proto S6 */}
        {credits && credits.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wide py-2" style={{ color: theme.gray1 }}>
              Кредиты
            </div>
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
              {credits.map((cr, i) => (
                <div key={cr.id}
                  className="cursor-pointer active:opacity-70"
                  style={{ padding: '14px 14px', borderBottom: i < credits.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}
                  onClick={() => onNavigate('creditDetail', { detailId: cr.id })}
                >
                  <div className="flex justify-between" style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{cr.name}</div>
                    <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.red }}>
                      {fmtMoney(cr.remaining_amount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ fontSize: 12, color: theme.gray2 }}>
                      {cr.description || (cr.end_date ? `Осталось до ${cr.end_date}` : '')}
                    </span>
                    <span style={{ fontSize: 12, color: theme.orange, fontWeight: 500 }}>
                      {cr.monthly_payment ? `→ ${fmtMoney(cr.monthly_payment)}/мес` : ''}
                      {cr.next_payment_date ? ` · ${new Date(cr.next_payment_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* Empty state */}
        {!hasAny && (!credits || credits.length === 0) && (
          <EmptyState
            icon="🏦" title="Нет счетов" subtitle="Добавьте банковский счёт"
            actionLabel="＋ Счёт" onAction={() => onNavigate('accountForm')} theme={theme}
          />
        )}
      </div>
    </div>
  );
}
