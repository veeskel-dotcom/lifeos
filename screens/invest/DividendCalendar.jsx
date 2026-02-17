import { useState, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import SkeletonCard from '../../components/SkeletonCard';
import { getDividends, markReceived } from '../../services/dividends';
import { fmtMoney } from '../../utils/currency';
import { getPortfolioQuantities } from '../../services/portfolio';

export default function DividendCalendar({ theme, onBack }) {
  const [groups, setGroups] = useState([]);
  const [qtyMap, setQtyMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const all = await getDividends();
    all.sort((a, b) => (a.ex_date || '').localeCompare(b.ex_date || ''));

    // Группировка по месяцам
    const byMonth = {};
    for (const d of all) {
      const key = d.ex_date?.slice(0, 7) || 'unknown';
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(d);
    }

    setGroups(
      Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, items]) => ({ month, items }))
    );

    // Получить кол-во акций
    const qMap = await getPortfolioQuantities();
    setQtyMap(qMap);
    setLoading(false);
  };

  const handleMarkReceived = async (id) => {
    await markReceived(id);
    load();
  };

  const thisYear = new Date().getFullYear();

  // Split into upcoming vs received
  const upcoming = [];
  const received = [];
  for (const g of groups) {
    for (const d of g.items) {
      const qty = qtyMap[d.ticker] || 0;
      const total = d.amount_per_share * qty;
      const item = { ...d, qty, total };
      if (d.is_received) received.push(item);
      else upcoming.push(item);
    }
  }

  // Total forecast
  const totalForecast = [...upcoming, ...received].reduce((s, d) => s + d.total, 0);
  const totalReceived = received.reduce((s, d) => s + d.total, 0);
  const pct = totalForecast > 0 ? Math.round(totalReceived / totalForecast * 100) : 0;

  // By broker
  const byBroker = {};
  for (const g of groups) {
    for (const d of g.items) {
      const b = d.broker || 'Прочее';
      if (!byBroker[b]) byBroker[b] = { name: b, type: d.accountType || '', total: 0 };
      byBroker[b].total += d.amount_per_share * (qtyMap[d.ticker] || 0);
    }
  }
  const brokerList = Object.values(byBroker).sort((a, b) => b.total - a.total);

  return (
    <div className="flex flex-col h-full" style={{ background: theme.bg }}>
      <NavHeader title="Дивиденды" right={String(thisYear)} onBack={onBack} theme={theme} />

      <div className="flex-1 overflow-auto px-4 pb-8">
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard theme={theme} />
            <SkeletonCard variant="compact" theme={theme} />
          </div>
        ) : (<>

        {/* Forecast summary with PB */}
        <Card theme={theme} style={{ padding: 14, marginTop: 4, marginBottom: 8 }}>
          <div className="flex justify-between" style={{ marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 12, color: theme.gray2 }}>Прогноз {thisYear}</div>
              <div className="tabular-nums" style={{ fontSize: 26, fontWeight: 700, color: theme.green }}>
                {totalForecast > 0 ? `+${fmtMoney(totalForecast)}` : '—'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: theme.gray2 }}>Получено</div>
              <div className="tabular-nums" style={{ fontSize: 26, fontWeight: 700, color: theme.text }}>
                {fmtMoney(totalReceived)}
              </div>
            </div>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 6, background: theme.gray5 }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: theme.green }} />
          </div>
          <div style={{ fontSize: 12, color: theme.gray2, marginTop: 4 }}>
            {fmtMoney(totalReceived)} из {fmtMoney(totalForecast)} · {pct}%
          </div>
        </Card>

        {/* БЛИЖАЙШИЕ — with chip badges */}
        {upcoming.length > 0 && (
          <>
            <div style={{ padding: '0 0 4px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>БЛИЖАЙШИЕ</span>
            </div>
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              {upcoming.slice(0, 5).map((d, i) => {
                const yld = d.qty > 0 && d.amount_per_share > 0 ? ((d.amount_per_share / (d.currentPrice || d.amount_per_share * 10)) * 100).toFixed(1) : '—';
                return (
                  <div key={d.id} style={{ padding: '12px 14px', borderBottom: i < Math.min(upcoming.length, 5) - 1 ? `0.5px solid ${theme.gray5}` : 'none', cursor: 'pointer' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{d.ticker}</span>
                        <span style={{ fontSize: 13, color: theme.gray2, marginLeft: 6 }}>{d.name || ''}</span>
                      </div>
                      <span className="tabular-nums" style={{ fontSize: 15, fontWeight: 700, color: theme.green }}>+{fmtMoney(d.total)}</span>
                    </div>
                    <div className="flex flex-wrap" style={{ gap: 4 }}>
                      <span style={{ padding: '3px 8px', borderRadius: 6, background: theme.gray5, fontSize: 11, color: theme.gray2 }}>
                        {fmtMoney(d.amount_per_share)}/акцию × {d.qty}
                      </span>
                      <span style={{ padding: '3px 8px', borderRadius: 6, background: (theme.purple || '#AF52DE') + '10', fontSize: 11, color: theme.purple || '#AF52DE' }}>
                        {yld}%
                      </span>
                      {d.ex_date && (
                        <span style={{ padding: '3px 8px', borderRadius: 6, background: (theme.orange || '#FF9500') + '10', fontSize: 11, color: theme.orange || '#FF9500' }}>
                          Отсечка {formatDate(d.ex_date)}
                        </span>
                      )}
                      {d.broker && (
                        <span style={{ padding: '3px 8px', borderRadius: 6, background: theme.gray5, fontSize: 11, color: theme.gray2 }}>
                          {d.broker}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>
          </>
        )}

        {/* ПОЛУЧЕНО */}
        {received.length > 0 && (
          <>
            <div style={{ padding: '0 0 4px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>ПОЛУЧЕНО В {thisYear}</span>
            </div>
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              {received.map((d, i) => (
                <div key={d.id} className="flex items-center"
                  style={{ gap: 10, padding: '10px 14px', borderBottom: i < received.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: theme.green }} />
                  <div className="flex-1">
                    <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{d.ticker}{d.name ? ` · ${d.name}` : ''}</div>
                    <div style={{ fontSize: 12, color: theme.gray2 }}>{formatDate(d.payment_date || d.ex_date)}{d.broker ? ` · ${d.broker}` : ''}</div>
                  </div>
                  <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.green }}>+{fmtMoney(d.total)}</span>
                </div>
              ))}
            </Card>
          </>
        )}

        {/* ПО БРОКЕРАМ */}
        {brokerList.length > 0 && (
          <>
            <div style={{ padding: '0 0 4px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>ПО БРОКЕРАМ</span>
            </div>
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              {brokerList.map((b, i) => (
                <div key={b.name} className="flex items-center justify-between"
                  style={{ padding: '12px 14px', borderBottom: i < brokerList.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 400, color: theme.text }}>{b.name}</div>
                    {b.type && <div style={{ fontSize: 12, color: theme.gray2 }}>{b.type}</div>}
                  </div>
                  <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.green }}>{fmtMoney(Math.round(b.total))}</span>
                </div>
              ))}
            </Card>
          </>
        )}

        {groups.length === 0 && !loading && (
          <EmptyState
            icon="💰"
            title="Нет дивидендов"
            subtitle="Добавьте дивидендные акции в портфель"
            tip="Дивиденды рассчитываются автоматически по акциям в портфеле."
            theme={theme}
          />
        )}

        <div style={{ height: 8 }} />
        </>)}
      </div>
    </div>
  );
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
