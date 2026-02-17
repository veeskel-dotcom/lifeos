import { useState, useMemo } from 'react';
import { useMonthIncomes, useIncomeSources } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import SkeletonList from '../../components/SkeletonList';
import { fmtMoney } from '../../utils/currency';

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const PERIOD_CHIPS = [
  { id: 'today', l: 'Сегодня' }, { id: 'week', l: 'Неделя' },
  { id: 'month', l: 'Месяц' }, { id: 'year', l: 'Год' },
];

const SOURCE_CHIPS = [
  { id: 'all', l: 'Все' }, { id: 'salary', l: '💼 Зарплата' },
  { id: 'freelance', l: '💻 Фриланс' }, { id: 'dividends', l: '📈 Дивиденды' },
  { id: 'cashback', l: '↩️ Кэшбэк' }, { id: 'other', l: '📦 Прочее' },
];

const SOURCE_ICONS = { salary: '💼', freelance: '💻', dividends: '📈', cashback: '🎁', other: '📦' };

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]}`.toUpperCase();
}

export default function IncomeList({ theme, onBack, onNavigate }) {
  const [period, setPeriod] = useState(2);
  const [sourceFilter, setSourceFilter] = useState('all');

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const incomes = useMonthIncomes(month + '-01', month + '-31');

  // Filter
  const filtered = useMemo(() => {
    if (!incomes) return null;
    let list = [...incomes];
    if (sourceFilter !== 'all') list = list.filter(i => i.source === sourceFilter || i.category === sourceFilter);
    return list;
  }, [incomes, sourceFilter]);

  const total = filtered?.reduce((s, i) => s + (i.amount || 0), 0) || 0;

  // Group by date
  const grouped = useMemo(() => {
    if (!filtered) return [];
    const map = {};
    filtered.forEach(i => {
      const d = i.date || 'unknown';
      if (!map[d]) map[d] = { items: [], total: 0 };
      map[d].items.push(i);
      map[d].total += i.amount || 0;
    });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, data]) => ({ date, label: fmtDate(date), ...data }));
  }, [filtered]);

  if (!incomes) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
        <NavHeader title="Доходы" onBack={onBack}
          right={<span style={{ fontSize: 22, color: theme.accent, cursor: 'pointer' }} onClick={() => onNavigate?.('incomeForm')}>＋</span>}
          theme={theme} />
        <div className="p-4"><SkeletonList count={5} theme={theme} /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Доходы" onBack={onBack}
        right={<span style={{ fontSize: 22, color: theme.accent, cursor: 'pointer' }} onClick={() => onNavigate?.('incomeForm')}>＋</span>}
        theme={theme} />

      <div className="flex-1 overflow-auto">
        {/* Period chips */}
        <div className="flex" style={{ gap: 4, padding: '0 16px 6px' }}>
          {PERIOD_CHIPS.map((p, i) => (
            <div key={p.id} onClick={() => setPeriod(i)} className="flex-1 text-center cursor-pointer"
              style={{
                padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: i === period ? (theme.green || '#34C759') + '12' : theme.gray5,
                color: i === period ? (theme.green || '#34C759') : theme.gray2,
              }}>{p.l}</div>
          ))}
        </div>

        {/* Total + trend card */}
        <Card theme={theme} style={{ margin: '0 16px 8px', padding: '12px 14px' }}>
          <div className="flex justify-between items-baseline" style={{ marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: theme.gray2 }}>{MONTHS_FULL[now.getMonth()]} {now.getFullYear()}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: theme.green || '#34C759' }}>+{fmtMoney(total)}</div>
            </div>
          </div>
        </Card>

        {/* Source filter chips */}
        <div className="flex overflow-x-auto" style={{ gap: 6, padding: '0 16px 8px' }}>
          {SOURCE_CHIPS.map(f => (
            <div key={f.id} onClick={() => setSourceFilter(f.id)} className="cursor-pointer shrink-0"
              style={{
                padding: '5px 10px', borderRadius: 14, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                background: sourceFilter === f.id ? (theme.green || '#34C759') + '15' : theme.gray5,
                color: sourceFilter === f.id ? (theme.green || '#34C759') : theme.gray2,
                border: sourceFilter === f.id ? `1.5px solid ${theme.green || '#34C759'}` : '1.5px solid transparent',
              }}>{f.l}</div>
          ))}
        </div>

        {/* Day groups */}
        {grouped.length === 0 ? (
          <EmptyState icon="💵" title="Нет доходов" subtitle="Добавьте первый доход"
            actionLabel="＋ Доход" onAction={() => onNavigate?.('incomeForm')} theme={theme} />
        ) : grouped.map(group => (
          <div key={group.date}>
            <div className="flex justify-between" style={{ padding: '8px 16px 4px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>{group.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: theme.green || '#34C759' }}>+{fmtMoney(group.total)}</span>
            </div>
            <Card theme={theme} style={{ margin: '0 16px 8px', padding: 0, overflow: 'hidden' }}>
              {group.items.map((item, i) => (
                <div key={item.id || i} className="flex items-center cursor-pointer"
                  onClick={() => onNavigate?.('incomeForm', { edit: item })}
                  style={{ gap: 10, padding: '12px 14px', borderBottom: i < group.items.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                  <div className="flex items-center justify-center shrink-0"
                    style={{ width: 36, height: 36, borderRadius: 10, background: (theme.green || '#34C759') + '12', fontSize: 18 }}>
                    {SOURCE_ICONS[item.source || item.category] || '💰'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate" style={{ fontSize: 15, fontWeight: 500, color: theme.text }}>
                      {item.description || item.source || 'Доход'}
                    </div>
                    <div className="truncate" style={{ fontSize: 12, color: theme.gray2 }}>
                      {item.account_name || ''}{item.account_name && item.source ? ' · ' : ''}{item.source || ''}
                    </div>
                  </div>
                  <span className="tabular-nums shrink-0" style={{ fontSize: 15, fontWeight: 600, color: theme.green || '#34C759' }}>
                    +{fmtMoney(item.amount)}
                  </span>
                </div>
              ))}
            </Card>
          </div>
        ))}
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
