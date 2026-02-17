import { useMemo } from 'react';
import { useAccount, useExpenseCategories, useLiveQuery } from '../../hooks/useDB';
import { getAccountOperations, getAccountMonthStats } from '../../services/accounts';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import ProgressBar from '../../components/ProgressBar';
import { fmtMoney, getSymbolForCode, getCurrencyCode } from '../../utils/currency';
import ScreenWrapper from '../../components/ScreenWrapper';

const TYPE_ICONS = { debit: '💳', credit: '💳', savings: '🏦', cash: '💵' };
const TYPE_LABELS = { debit: 'Дебетовая', credit: 'Кредитная', savings: 'Накопительная', cash: 'Наличные' };

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function fmt(n, currency) {
  return fmtMoney(n, getSymbolForCode(currency));
}

export default function AccountDetail({ accountId, theme, onBack, onNavigate }) {
  const account = useAccount(accountId);
  const categories = useExpenseCategories();

  // Последние 20 операций по этому счёту
  const recentOps = useLiveQuery(
    () => accountId ? getAccountOperations(accountId).catch(() => []) : [],
    [accountId]
  );

  // Расходы за текущий месяц
  const monthStats = useLiveQuery(
    () => accountId ? getAccountMonthStats(accountId).catch(() => null) : null,
    [accountId]
  );

  if (!account) return null;

  const cur = account.currency || getCurrencyCode();
  const isCredit = account.type === 'credit';

  return (
    <ScreenWrapper theme={theme}>
      <NavHeader title={account.name} onBack={onBack} theme={theme}
        rightContent={
          <button
            onClick={() => onNavigate('accountForm', { edit: account })}
            className="text-sm font-medium"
            style={{ color: theme.accent }}
          >
            Изменить
          </button>
        }
      />

      <div className="flex-1 overflow-auto px-4 pb-8 space-y-4">
        {/* ═══ Баланс ═══ */}
        <Card theme={theme}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: (account.color || '#FFD60A') + '22' }}>
              {TYPE_ICONS[account.type] || '💳'}
            </div>
            <div>
              <span className="text-sm font-medium" style={{ color: theme.text }}>{account.bank}</span>
              <p className="text-xs" style={{ color: theme.gray2 }}>{TYPE_LABELS[account.type] || 'Счёт'}</p>
            </div>
          </div>

          <div className="text-3xl font-bold mt-2" style={{ color: theme.text }}>
            {fmt(account.balance || 0, cur)}
          </div>

          {/* Кредитная карта: лимит и долг */}
          {isCredit && account.limit > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span style={{ color: theme.gray1 }}>Лимит</span>
                <span style={{ color: theme.text }}>{fmt(account.limit, cur)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: theme.gray1 }}>Задолженность</span>
                <span style={{ color: account.balance < 0 ? theme.red : theme.text }}>
                  {fmt(Math.abs(Math.min(0, account.balance)), cur)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: theme.gray1 }}>Доступно</span>
                <span className="font-semibold" style={{ color: theme.green }}>
                  {fmt(account.limit + Math.min(0, account.balance), cur)}
                </span>
              </div>
              <ProgressBar
                value={Math.abs(Math.min(0, account.balance))}
                max={account.limit}
                color={Math.abs(account.balance) > account.limit * 0.8 ? theme.red : theme.accent}
                height={6}
                theme={theme}
              />
              {account.next_payment_date && (
                <div className="flex justify-between text-sm mt-1">
                  <span style={{ color: theme.gray1 }}>Дата погашения</span>
                  <span style={{ color: theme.orange }}>
                    {new Date(account.next_payment_date).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ═══ Статистика за месяц ═══ */}
        {monthStats && (monthStats.spent > 0 || monthStats.earned > 0) && (
          <Card theme={theme}>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
              За этот месяц
            </span>
            <div className="flex gap-4 mt-2">
              <div className="flex-1">
                <p className="text-xs" style={{ color: theme.gray2 }}>Расходы</p>
                <p className="text-base font-semibold" style={{ color: theme.red }}>
                  −{fmt(monthStats.spent, cur)}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-xs" style={{ color: theme.gray2 }}>Поступления</p>
                <p className="text-base font-semibold" style={{ color: theme.green }}>
                  +{fmt(monthStats.earned, cur)}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: theme.gray2 }}>Операций</p>
                <p className="text-base font-semibold" style={{ color: theme.text }}>
                  {monthStats.txCount}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* ═══ Операции ═══ */}
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
          <div className="px-4 pt-4 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
              Последние операции
            </span>
          </div>
          {(!recentOps || recentOps.length === 0) ? (
            <p className="text-sm text-center py-6 px-4" style={{ color: theme.gray2 }}>
              Операций пока нет
            </p>
          ) : (
            recentOps.map((op, i) => {
              const cat = op.opType === 'expense'
                ? categories?.find(c => c.id === op.category_id)
                : null;
              const isIncome = op.opType === 'income';
              const d = new Date(op.date + 'T00:00:00');
              const dateStr = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
              return (
                <div key={`${op.opType}-${op.id}`}>
                  {i > 0 && <div className="mx-4" style={{ borderTop: `0.5px solid ${theme.gray5}` }} />}
                  <div className="flex items-center px-4 py-2.5">
                    <span className="text-lg mr-3">
                      {isIncome ? '💰' : cat?.icon || '📦'}
                    </span>
                    <span className="flex-1 text-sm truncate" style={{ color: theme.text }}>
                      {op.description || (isIncome ? 'Доход' : cat?.name || 'Расход')}
                    </span>
                    <div className="text-right ml-2">
                      <span className="text-sm font-medium tabular-nums" style={{
                        color: isIncome ? theme.green : theme.text,
                      }}>
                        {isIncome ? '+' : '−'}{fmt(op.amount, cur)}
                      </span>
                      <p className="text-xs" style={{ color: theme.gray2 }}>{dateStr}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {recentOps && recentOps.length > 0 && (
            <div className="px-4 py-3" style={{ borderTop: `0.5px solid ${theme.gray5}` }}>
              <button
                onClick={() => onNavigate('expenses', { filterAccountId: accountId })}
                className="text-sm font-medium"
                style={{ color: theme.accent }}
              >
                Все операции →
              </button>
            </div>
          )}
        </Card>
      </div>
    </ScreenWrapper>
  );
}
