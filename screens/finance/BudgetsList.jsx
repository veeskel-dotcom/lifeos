import { useState, useMemo } from 'react';
import { useSetting, useExpenseCategories, useBudgets, useMonthExpenses } from '../../hooks/useDB';
import { setBudgetLimit } from '../../services/budgets';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import { fmtMoney } from '../../utils/currency';
import ProgressBar from '../../components/ProgressBar';

import SkeletonList from '../../components/SkeletonList';
const MONTHS_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function getStatusColor(pct, theme) {
  if (pct >= 100) return theme.red;
  if (pct >= 70) return theme.orange;
  return theme.green;
}

export default function BudgetsList({ theme, onBack, onNavigate }) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showExpanded, setShowExpanded] = useState(false);

  const monthStart = selectedMonth + '-01';
  const monthEnd = selectedMonth + '-31';

  const monthlyBudget = useSetting('monthly_budget');
  const categories = useExpenseCategories();
  const budgets = useBudgets(selectedMonth);
  const expenses = useMonthExpenses(monthStart, monthEnd);

  const totalBudget = monthlyBudget || 0;
  const totalSpent = expenses?.reduce((s, e) => s + e.amount, 0) || 0;
  const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const categoryData = useMemo(() => {
    if (!categories || !expenses || !budgets) return null;

    // Spent per category
    const spentMap = {};
    expenses.forEach(e => {
      spentMap[e.category_id] = (spentMap[e.category_id] || 0) + e.amount;
    });

    // Merge with budgets
    return categories
      .map(cat => {
        const budget = budgets.find(b => b.category_id === cat.id);
        const spent = spentMap[cat.id] || 0;
        const limit = budget?.limit || 0;
        const pct = limit > 0 ? Math.round((spent / limit) * 100) : (spent > 0 ? 100 : 0);
        return { ...cat, spent, limit, pct, budgetId: budget?.id };
      })
      .filter(c => c.spent > 0 || c.limit > 0)
      .sort((a, b) => b.spent - a.spent);
  }, [categories, expenses, budgets]);

  const totalLimits = categoryData?.reduce((s, c) => s + c.limit, 0) || 0;
  const unallocated = totalBudget - totalLimits;

  const visibleCategories = showExpanded ? categoryData : categoryData?.slice(0, 5);

  const prevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const nextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleSaveLimit = async (cat) => {
    const newLimit = parseFloat(editValue) || 0;
    if (cat.budgetId) {
      await db.budgets.update(cat.budgetId, { limit: newLimit });
    } else {
      await db.budgets.add({ month: selectedMonth, category_id: cat.id, limit: newLimit });
    }
    setEditingId(null);
    setEditValue('');
  };

  const monthIdx = parseInt(selectedMonth.slice(5)) - 1;
  const monthLabel = MONTHS_FULL[monthIdx];

  if (!categoryData) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
        <NavHeader title="Бюджеты" onBack={onBack} left="Финансы" theme={theme} />
        <div className="p-4">
          <SkeletonList count={5} theme={theme} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader
        title="Бюджеты"
        onBack={onBack}
        left="Финансы"
        right={
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="text-base" style={{ color: theme.accent }}>◂</button>
            <span className="text-sm font-medium" style={{ color: theme.accent }}>{monthLabel}</span>
            <button onClick={nextMonth} className="text-base" style={{ color: theme.accent }}>▸</button>
          </div>
        }
        theme={theme}
      />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {/* Over-budget alert */}
        {totalPct >= 90 && totalBudget > 0 && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: (totalPct >= 100 ? theme.red : theme.orange) + '15' }}>
            <span className="text-lg">{totalPct >= 100 ? '🚨' : '⚠️'}</span>
            <span className="text-sm font-medium" style={{ color: totalPct >= 100 ? theme.red : theme.orange }}>
              {totalPct >= 100
                ? `Бюджет превышен на ${fmtMoney(totalSpent - totalBudget)}`
                : `${totalPct}% бюджета — осталось ${fmtMoney(totalBudget - totalSpent)}`}
            </span>
          </div>
        )}
        {/* Total budget — proto S9 */}
        <Card theme={theme} style={{ margin: '0 0 8px' }}>
          <div className="flex justify-between" style={{ marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: theme.gray1, letterSpacing: 0.3 }}>ОБЩИЙ БЮДЖЕТ</span>
            {totalBudget > 0 && <span style={{ fontSize: 12, color: theme.gray1 }}>{totalPct}%</span>}
          </div>
          <div className="tabular-nums" style={{ fontSize: 26, fontWeight: 700, color: theme.text }}>
            {fmtMoney(totalSpent)}
            {totalBudget > 0 && <span style={{ fontSize: 14, fontWeight: 400, color: theme.gray1 }}> из {fmtMoney(totalBudget)}</span>}
          </div>
          <div style={{ margin: '6px 0' }}>
            <ProgressBar value={totalSpent} max={totalBudget || 1} color={getStatusColor(totalPct, theme)} height={6} theme={theme} />
          </div>
          <div className="flex justify-between" style={{ marginTop: 6 }}>
            <div>
              <div style={{ fontSize: 10, color: theme.gray2 }}>Осталось</div>
              <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 600, color: theme.green || '#34C759' }}>{fmtMoney(Math.max(0, totalBudget - totalSpent))}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: theme.gray2 }}>Лимит/день</div>
              <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>
                {(() => { const d = new Date(); const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); const rem = Math.max(dim - d.getDate() + 1, 1); return fmtMoney(Math.round(Math.max(0, totalBudget - totalSpent) / rem)); })()}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: theme.gray2 }}>Дней осталось</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>
                {(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1; })()}
              </div>
            </div>
          </div>
        </Card>

        {/* By category */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide py-2" style={{ color: theme.gray1 }}>
            По категориям
          </div>

          {categoryData.length === 0 ? (
            <EmptyState
              icon="📊" title="Нет бюджетов" subtitle="Установите лимиты по категориям"
              theme={theme}
            />
          ) : (
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
              {visibleCategories?.map((cat, i, arr) => {
                const statusIcon = cat.pct >= 100 ? '🔴' : cat.pct >= 70 ? '🟡' : '🟢';
                return (
                  <div key={cat.id} onClick={() => onNavigate?.('budgetCategory', { detailId: cat.id, month: selectedMonth })}
                    className="cursor-pointer active:opacity-70"
                    style={{ padding: '10px 14px', borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                    <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
                      <div className="flex items-center" style={{ gap: 6 }}>
                        <span style={{ fontSize: 16 }}>{cat.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{cat.name}</span>
                        <span style={{ fontSize: 10 }}>{statusIcon}</span>
                      </div>
                      <div className="flex items-baseline tabular-nums" style={{ gap: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{cat.spent.toLocaleString('ru-RU')}₽</span>
                        <span style={{ fontSize: 12, color: theme.gray3 }}>/</span>
                        {editingId === cat.id ? (
                          <input type="number" inputMode="decimal" value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => handleSaveLimit(cat)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveLimit(cat)}
                            autoFocus
                            style={{ width: 80, fontSize: 13, textAlign: 'right', padding: '1px 6px', borderRadius: 4, background: theme.accent + '08', color: theme.accent, border: 'none', outline: 'none' }}
                          />
                        ) : (
                          <span onClick={(e) => { e.stopPropagation(); setEditingId(cat.id); setEditValue(String(cat.limit || '')); }}
                            className="cursor-pointer"
                            style={{ fontSize: 13, fontWeight: 500, color: theme.accent, padding: '1px 6px', borderRadius: 4, background: theme.accent + '08' }}>
                            {cat.limit ? cat.limit.toLocaleString('ru-RU') + '₽' : 'лимит'}
                          </span>
                        )}
                      </div>
                    </div>
                    <ProgressBar value={cat.spent} max={cat.limit || cat.spent || 1} color={getStatusColor(cat.pct, theme)} height={3} theme={theme} />
                    {cat.pct >= 100 && <div style={{ fontSize: 11, color: theme.red, marginTop: 2, fontWeight: 500 }}>Превышен на {(cat.spent - cat.limit).toLocaleString('ru-RU')}₽</div>}
                  </div>
                );
              })}

              {/* Show more */}
              {categoryData.length > 5 && !showExpanded && (
                <div className="px-4 py-3" style={{ borderTop: `0.5px solid ${theme.gray5}` }}>
                  <button
                    onClick={() => setShowExpanded(true)}
                    className="text-sm font-medium"
                    style={{ color: theme.accent }}
                  >
                    ··· Ещё {categoryData.length - 5} категорий
                  </button>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Dashed add — proto S9 */}
        <div onClick={() => onNavigate?.('budgetCategory', { month: selectedMonth })} className="cursor-pointer"
          style={{ padding: 12, borderRadius: 12, border: `1.5px dashed ${theme.gray3}`, textAlign: 'center', fontSize: 14, color: theme.gray2 }}>
          ＋ Добавить категорию
        </div>

        {totalBudget > 0 && unallocated > 0 && (
          <div style={{ fontSize: 12, textAlign: 'center', padding: '4px 0', color: theme.gray1 }}>
            Нераспределено: {fmtMoney(unallocated)}
          </div>
        )}
      </div>
    </div>
  );
}
