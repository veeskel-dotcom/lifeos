import FormInput from '../../components/FormInput';
import { useState, useMemo } from 'react';
import { useExpenseCategories, useLiveQuery } from '../../hooks/useDB';
import { getAccounts } from '../../services/accounts';
import { getExpenses } from '../../services/expenses';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import ChipBar from '../../components/ChipBar';
import DateSectionHeader from '../../components/DateSectionHeader';
import SkeletonList from '../../components/SkeletonList';
import EmptyState from '../../components/EmptyState';
import { fmtMoney } from '../../utils/currency';
import { exportExpensesCSV } from '../../services/export';
import Ic from '../../components/Icon';

/* ── Constants ── */

const MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const DAYS_SHORT = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const PERIOD_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: '3m', label: '3 мес' },
  { id: 'custom', label: '📅' },
];

/* ── Helpers ── */

function formatDateHeader(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (dateStr === todayStr) return `Сегодня, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  if (dateStr === yesterdayStr) return `Вчера, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${DAYS_SHORT[d.getDay()]}`;
}

/* ── Main Component ── */

export default function ExpensesList({ theme, onBack, onNavigate, filterAccountId, filterCategoryId, filterMonth }) {
  const [periodFilter, setPeriodFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [limit, setLimit] = useState(50);

  /* ── Data ── */

  const categories = useExpenseCategories();
  const accounts = useLiveQuery(() => getAccounts().catch(() => []));
  const allExpenses = useLiveQuery(() => getExpenses({ limit }).catch(() => []), [limit]);

  /* ── A1.5 drilldown header label ── */
  const drilldownLabel = useMemo(() => {
    if (!filterCategoryId) return null;
    const cat = categories?.find(c => c.id === filterCategoryId);
    const monthLabel = filterMonth
      ? `${MONTHS_SHORT[Number(filterMonth.slice(5)) - 1]} ${filterMonth.slice(0, 4)}`
      : '';
    return `${cat?.icon || ''} ${cat?.name || 'Категория'}${monthLabel ? ` · ${monthLabel}` : ''}`;
  }, [filterCategoryId, filterMonth, categories]);

  /* ── Filtering ── */

  const filtered = useMemo(() => {
    if (!allExpenses) return null;
    let list = [...allExpenses];

    // Period filter
    const today = new Date().toISOString().split('T')[0];
    if (periodFilter === 'today') {
      list = list.filter(e => e.date === today);
    } else if (periodFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const cutoff = weekAgo.toISOString().split('T')[0];
      list = list.filter(e => e.date >= cutoff);
    } else if (periodFilter === 'month') {
      const monthStart = new Date().toISOString().slice(0, 7) + '-01';
      list = list.filter(e => e.date >= monthStart);
    } else if (periodFilter === '3m') {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      list = list.filter(e => e.date >= d.toISOString().split('T')[0]);
    } else if (periodFilter === 'custom') {
      if (customFrom) list = list.filter(e => e.date >= customFrom);
      if (customTo) list = list.filter(e => e.date <= customTo);
    }

    // Category filter (chip or prop-based drill-down)
    const activeCatId = filterCategoryId || categoryFilter;
    if (activeCatId) list = list.filter(e => e.category_id === activeCatId);

    // Month filter (prop-based drill-down A1.5)
    if (filterMonth) list = list.filter(e => e.date?.startsWith(filterMonth));

    // Account filter (prop-based)
    if (filterAccountId) list = list.filter(e => e.account_id === filterAccountId);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => (e.description || '').toLowerCase().includes(q));
    }

    return list;
  }, [allExpenses, periodFilter, customFrom, customTo, categoryFilter, filterAccountId, filterCategoryId, filterMonth, search]);

  /* ── Group by date ── */

  const grouped = useMemo(() => {
    if (!filtered) return null;
    const groups = {};
    filtered.forEach(e => {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  /* ── Lookups ── */

  const getCategoryForExpense = (e) => categories?.find(c => c.id === e.category_id);
  const getAccountForExpense = (e) => accounts?.find(a => a.id === e.account_id);

  /* ── CSV export ── */

  const handleExport = async () => {
    const blob = await exportExpensesCSV();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Loading ── */

  if (!grouped) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
        <NavHeader title="Расходы" onBack={onBack} left theme={theme} />
        <div className="p-4"><SkeletonList count={6} theme={theme} /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader
        title={drilldownLabel || 'Расходы'}
        onBack={onBack}
        left
        right={
          <div className="flex items-center gap-3">
            <span onClick={handleExport} style={{ cursor: 'pointer' }}><Ic name="share" color={theme.accent} size={20} r={5} raw /></span>
            <span onClick={() => setShowSearch(!showSearch)} style={{ cursor: 'pointer' }}><Ic name="target" color={theme.accent} size={20} r={5} raw /></span>
          </div>
        }
        theme={theme}
      />

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 pb-2">
          <FormInput value={search} onChange={setSearch} placeholder="Поиск..." theme={theme} />
        </div>
      )}

      {/* Period filter (hide if drill-down mode) */}
      {!filterCategoryId && (
        <div className="px-3 pb-1">
          <ChipBar chips={PERIOD_FILTERS} active={periodFilter} onChange={setPeriodFilter} theme={theme} />
          {periodFilter === 'custom' && (
            <div className="flex gap-2 mt-2">
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="flex-1 rounded-lg px-3 py-2 text-sm"
                style={{ background: theme.card, color: theme.text, border: `1px solid ${theme.gray5}` }}
              />
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="flex-1 rounded-lg px-3 py-2 text-sm"
                style={{ background: theme.card, color: theme.text, border: `1px solid ${theme.gray5}` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Category filter (hide if drill-down mode) */}
      {!filterCategoryId && categories?.length > 0 && (
        <div className="px-3 pb-3">
          <ChipBar
            chips={[
              { id: 'allcat', label: 'Все' },
              ...categories.map(c => ({ id: String(c.id), label: `${c.icon} ${c.name}`.trim() })),
            ]}
            active={categoryFilter ? String(categoryFilter) : 'allcat'}
            onChange={id => setCategoryFilter(id === 'allcat' ? null : Number(id))}
            theme={theme}
          />
        </div>
      )}

      {/* Hero total — proto S2 */}
      {filtered && !filterCategoryId && (
        <div className="flex justify-between items-baseline px-4 pb-2">
          <span className="tabular-nums" style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>
            {fmtMoney(filtered.reduce((s, e) => s + (e.amount || 0), 0))}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {/* Empty state */}
        {grouped.length === 0 ? (
          <EmptyState
            icon="💸"
            title="Нет расходов"
            subtitle="Расходы появятся здесь"
            tip="Быстрый ввод: нажмите ＋ на главном экране"
            actionLabel="Добавить"
            onAction={() => onNavigate('expense-form')}
            theme={theme}
          />
        ) : (
          grouped.map(([date, expenses]) => {
            const dayTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);
            return (
              <div key={date} className="mb-4">
                <DateSectionHeader dateStr={date} total={dayTotal} theme={theme} />

                <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
                  {expenses.map((e, i) => {
                    const cat = getCategoryForExpense(e);
                    const acc = getAccountForExpense(e);
                    return (
                      <div key={e.id || i}>
                        {i > 0 && <div className="mx-4" style={{ borderTop: `0.5px solid ${theme.gray5}` }} />}
                        <div
                          className="flex items-center cursor-pointer active:opacity-70"
                          style={{ gap: 10, padding: '12px 14px' }}
                          onClick={() => onNavigate('expenseForm', { edit: e })}
                        >
                          {/* Icon box 36×36 r10 — proto S2 */}
                          <div className="flex items-center justify-center shrink-0"
                            style={{ width: 36, height: 36, borderRadius: 10, background: (cat?.color || theme.gray5) + '15', fontSize: 16 }}>
                            {cat?.icon || '💰'}
                          </div>

                          {/* Description + meta */}
                          <div className="flex-1 min-w-0">
                            <div className="truncate" style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>
                              {e.description || cat?.name}
                            </div>
                            <div className="truncate" style={{ fontSize: 12, color: theme.gray2 }}>
                              {acc ? acc.name : ''}{e.time ? ` · ${e.time}` : ''}
                            </div>
                          </div>

                          {/* Amount */}
                          <span className="tabular-nums shrink-0" style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>
                            {fmtMoney(e.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            );
          })
        )}

        {/* Load more */}
        {allExpenses && allExpenses.length >= limit && (
          <button
            onClick={() => setLimit(prev => prev + 50)}
            className="w-full py-3 text-sm font-medium rounded-xl mt-2"
            style={{ color: theme.accent, background: theme.card }}
          >
            Загрузить ещё
          </button>
        )}
      </div>
    </div>
  );
}
