import { useState, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import SkeletonCard from '../../components/SkeletonCard';
import { getAllTrades } from '../../services/trades';
import { fmtMoney } from '../../utils/currency';

const MONTH_NAMES = [
  'ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ',
  'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ',
];

export default function TradesList({ theme, onBack, onNavigate }) {
  const [trades, setTrades] = useState(undefined);
  const [filter, setFilter] = useState(0);

  useEffect(() => {
    getAllTrades().then(t => setTrades(t || []));
  }, []);

  if (trades === undefined) return (
    <div className="px-4 pt-2 space-y-3">
      <NavHeader title="Сделки" onBack={onBack} theme={theme} />
      <SkeletonCard theme={theme} />
      <SkeletonCard variant="compact" theme={theme} />
    </div>
  );

  // Unique brokers for filter chips
  const brokers = [...new Set(trades.map(t => t.broker).filter(Boolean))];
  const filterLabels = ['Все', '🟢 Покупки', '🔴 Продажи', ...brokers];

  // Apply filter
  const filtered = trades.filter(t => {
    if (filter === 0) return true;
    if (filter === 1) return t.type === 'buy';
    if (filter === 2) return t.type === 'sell';
    return t.broker === filterLabels[filter];
  });

  // Summary
  const buys = filtered.filter(t => t.type === 'buy');
  const sells = filtered.filter(t => t.type === 'sell');
  const turnover = filtered.reduce((s, t) => s + (t.quantity || 0) * (t.price || 0), 0);

  // Group by month
  const groups = (() => {
    const map = {};
    for (const t of filtered) {
      const key = (t.date || '').slice(0, 7);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, items]) => {
        const [y, m] = month.split('-');
        const mi = parseInt(m, 10) - 1;
        const label = `${MONTH_NAMES[mi] || month} ${y}`;
        return { label, items };
      });
  })();

  return (
    <div className="flex flex-col h-full" style={{ background: theme.bg }}>
      <NavHeader title="Сделки" right="Фильтр" onBack={onBack} theme={theme} />

      <div className="flex-1 overflow-auto">
        {/* Filter chips */}
        <div className="flex overflow-x-auto" style={{ padding: '0 16px 8px', gap: 6 }}>
          {filterLabels.map((f, i) => (
            <div key={f} onClick={() => setFilter(i)} className="cursor-pointer shrink-0"
              style={{
                padding: '5px 10px', borderRadius: 14, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                background: i === filter ? theme.accent + '15' : theme.gray5,
                color: i === filter ? theme.accent : theme.gray2,
                border: i === filter ? `1.5px solid ${theme.accent}` : '1.5px solid transparent',
              }}>{f}</div>
          ))}
        </div>

        {/* Summary cards */}
        <div className="flex" style={{ gap: 8, padding: '0 16px 8px' }}>
          {[
            { label: 'Покупок', value: String(buys.length), color: theme.green },
            { label: 'Продаж', value: String(sells.length), color: theme.red },
            { label: 'Оборот', value: fmtMoney(Math.round(turnover)), color: theme.text },
          ].map(s => (
            <div key={s.label} className="flex-1 text-center"
              style={{ background: theme.card, borderRadius: 12, padding: '8px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: theme.gray2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Trades by month */}
        {groups.length === 0 ? (
          <EmptyState
            icon="📊"
            title="Нет сделок"
            subtitle="Добавьте первую сделку"
            theme={theme}
          />
        ) : groups.map(group => (
          <div key={group.label}>
            <div style={{ padding: '8px 16px 4px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>{group.label}</span>
            </div>
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              {group.items.map((t, i) => {
                const total = (t.quantity || 0) * (t.price || 0);
                return (
                  <div key={t.id || i} className="flex items-center cursor-pointer"
                    onClick={() => onNavigate?.('assetDetail', t.assetId)}
                    style={{ gap: 10, padding: '10px 14px', borderBottom: i < group.items.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: t.type === 'buy' ? theme.green : theme.red }} />
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>
                        <span style={{ fontWeight: 600 }}>{t.ticker}</span>
                        <span style={{ color: theme.gray2, marginLeft: 4 }}>{t.name || ''}</span>
                      </div>
                      <div style={{ fontSize: 12, color: theme.gray2 }}>
                        {t.type === 'buy' ? 'Покупка' : 'Продажа'} · {t.quantity} × {fmtMoney(t.price)} · {formatDate(t.date)}{t.broker ? ` · ${t.broker}` : ''}
                      </div>
                    </div>
                    <span className="tabular-nums shrink-0" style={{ fontSize: 14, fontWeight: 600, color: t.type === 'buy' ? theme.text : theme.red }}>
                      {t.type === 'sell' ? '+' : ''}{fmtMoney(Math.round(total))}
                    </span>
                  </div>
                );
              })}
            </Card>
          </div>
        ))}
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
