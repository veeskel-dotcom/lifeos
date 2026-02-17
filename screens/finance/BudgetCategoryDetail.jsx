import { useState, useMemo } from 'react';
import { useLiveQuery } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import ProgressBar from '../../components/ProgressBar';
import { fmtMoney } from '../../utils/currency';

export default function BudgetCategoryDetail({ categoryId, month, theme, onBack, onNavigate }) {
  const data = useLiveQuery(async () => {
    if (!categoryId || !month) return null;
    const db = (await import('../../db')).default;

    const category = await db.categories.get(categoryId);
    if (!category) return null;

    const budget = await db.budgets
      .where({ category_id: categoryId, month })
      .first()
      .catch(() => null);

    const monthStart = month + '-01';
    const monthEnd = month + '-31';

    const expenses = await db.expenses
      .where('date').between(monthStart, monthEnd + '\uffff')
      .and(e => e.category_id === categoryId)
      .toArray();

    // 6 month history
    const history = [];
    const [y, m] = month.split('-').map(Number);
    for (let i = 5; i >= 0; i--) {
      const hm = new Date(y, m - 1 - i, 1);
      const mStr = `${hm.getFullYear()}-${String(hm.getMonth() + 1).padStart(2, '0')}`;
      const mStart = mStr + '-01';
      const mEnd = mStr + '-31';
      const mExpenses = await db.expenses
        .where('date').between(mStart, mEnd + '\uffff')
        .and(e => e.category_id === categoryId)
        .toArray();
      const total = mExpenses.reduce((s, e) => s + e.amount, 0);
      history.push({ month: mStr, total });
    }

    // Subcategory breakdown (by description keywords)
    const subCats = {};
    expenses.forEach(e => {
      const key = e.subcategory || e.category_path_snapshot || 'Прочее';
      subCats[key] = (subCats[key] || 0) + e.amount;
    });

    return {
      category,
      limit: budget?.limit || 0,
      expenses: expenses.sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts),
      history,
      subCats: Object.entries(subCats)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [categoryId, month]);

  if (!data) return <div style={{ background: theme.bg, minHeight: '100vh' }} />;

  const { category, limit, expenses, history, subCats } = data;
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const remaining = limit - spent;
  const daysInMonth = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5)), 0).getDate();
  const currentDay = new Date().getDate();
  const avgPerDay = currentDay > 0 ? Math.round(spent / currentDay) : 0;
  const historyMax = Math.max(...history.map(h => h.total), 1);
  const historyAvg = Math.round(history.reduce((s, h) => s + h.total, 0) / history.length);
  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader
        title={`${category.icon || '📁'} ${category.name}`}
        onBack={onBack}
        right="Изменить"
        onRight={() => onNavigate?.('editBudget', { categoryId, month })}
        theme={theme}
      />

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Hero — proto S10: 34/700 centered + PB h:6 */}
        <div style={{ textAlign: 'center', padding: '4px 16px 8px' }}>
          <div className="tabular-nums" style={{ fontSize: 34, fontWeight: 700, color: theme.text }}>
            {fmtMoney(spent)}
          </div>
          {limit > 0 && (
            <div style={{ fontSize: 14, color: theme.gray2 }}>
              из {fmtMoney(limit)} · {pct}%
            </div>
          )}
          {limit > 0 && (
            <div style={{ margin: '8px 32px' }}>
              <ProgressBar value={spent} max={limit}
                color={pct >= 90 ? theme.red : pct >= 70 ? theme.orange : (category.color || theme.accent)}
                height={6} theme={theme} />
            </div>
          )}
        </div>

        {/* Stats cards ×3 — proto S10: 15/700 + 10 gray2 */}
        <div className="flex" style={{ gap: 8, padding: '0 16px 8px' }}>
          {[
            { label: 'Осталось', value: fmtMoney(Math.max(0, remaining)), color: remaining > 0 ? (theme.green || '#34C759') : theme.red },
            { label: 'Средний/день', value: fmtMoney(avgPerDay), color: theme.text },
            { label: 'Транзакций', value: String(expenses.length), color: theme.text },
          ].map(s => (
            <div key={s.label} className="flex-1 text-center"
              style={{ background: theme.card, borderRadius: 12, padding: '10px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: theme.gray2, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* 6-month trend — proto S10 */}
        {history.length > 1 && (
          <Card theme={theme} style={{ margin: '0 16px 8px', padding: '12px 14px' }}>
            <div style={{ fontSize: 12, color: theme.gray2, marginBottom: 6 }}>
              Тренд за 6 месяцев · среднее: {fmtMoney(historyAvg)}
            </div>
            <div className="flex items-end" style={{ height: 32, gap: 6 }}>
              {history.map((h, i) => (
                <div key={h.month} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full rounded-sm" style={{
                    height: Math.max(2, (h.total / historyMax) * 30),
                    background: i === history.length - 1
                      ? (category.color || theme.accent)
                      : (category.color || theme.accent) + '40',
                  }} />
                  <span className="text-[9px]" style={{ color: theme.gray3 }}>
                    {monthNames[parseInt(h.month.slice(5)) - 1]?.[0]}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Subcategories — proto S10 */}
        {subCats.length > 1 && (
          <>
            <div style={{ padding: '0 16px 4px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>ПОДКАТЕГОРИИ</span>
            </div>
            <Card theme={theme} style={{ margin: '0 16px 8px', padding: 0, overflow: 'hidden' }}>
              {subCats.map((sub, i) => {
                const subPct = spent > 0 ? Math.round((sub.amount / spent) * 100) : 0;
                return (
                  <div key={sub.name} className="cursor-pointer"
                    style={{ padding: '10px 14px', borderBottom: i < subCats.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                    <div className="flex justify-between items-center" style={{ marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{sub.name}</span>
                      <div className="flex items-baseline" style={{ gap: 4 }}>
                        <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{fmtMoney(sub.amount)}</span>
                        <span className="tabular-nums" style={{ fontSize: 11, color: theme.gray2 }}>{subPct}%</span>
                      </div>
                    </div>
                    <ProgressBar value={sub.amount} max={spent} color={category.color || theme.accent} height={3} theme={theme} />
                  </div>
                );
              })}
            </Card>
          </>
        )}

        {/* Recent transactions — proto S10 */}
        <div style={{ padding: '0 16px 4px' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>ПОСЛЕДНИЕ ТРАНЗАКЦИИ</span>
        </div>
        <Card theme={theme} style={{ margin: '0 16px 8px', padding: 0, overflow: 'hidden' }}>
          {expenses.slice(0, 10).map((e, i) => (
            <div key={e.id || i} className="flex items-center cursor-pointer active:opacity-70"
              style={{ gap: 10, padding: '10px 14px', borderBottom: i < Math.min(expenses.length, 10) - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}
              onClick={() => onNavigate?.('expenseForm', { edit: e })}>
              <div className="flex items-center justify-center shrink-0"
                style={{ width: 36, height: 36, borderRadius: 10, background: (category.color || theme.accent) + '12', fontSize: 16 }}>
                {category.icon || '📁'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate" style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>
                  {e.description || 'Расход'}
                </div>
                <div className="truncate" style={{ fontSize: 12, color: theme.gray2 }}>
                  {e.account_name || ''}{e.account_name && ' · '}{e.date}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>
                  -{fmtMoney(e.amount)}
                </div>
              </div>
            </div>
          ))}
          {expenses.length > 10 && (
            <div className="text-center cursor-pointer"
              style={{ padding: '10px 14px', fontSize: 14, color: theme.accent }}
              onClick={() => onNavigate?.('expenses', { category: categoryId })}>
              Все {expenses.length} транзакций
            </div>
          )}
          {expenses.length === 0 && (
            <div className="text-center" style={{ padding: '24px 14px', fontSize: 14, color: theme.gray2 }}>
              Нет транзакций за этот месяц
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
