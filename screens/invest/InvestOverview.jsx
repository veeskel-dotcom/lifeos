import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import SkeletonCard from '../../components/SkeletonCard';
import { getPortfolio, getPortfolioValue, getDailyChange } from '../../services/portfolio';
import { getDividendYield } from '../../services/dividends';
import { refreshIfStale } from '../../services/quotes';
import { fmtMoney } from '../../utils/currency';

export default function InvestOverview({ theme, onNavigate }) {
  const [assets, setAssets] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [dailyChange, setDailyChange] = useState(0);
  const [loading, setLoading] = useState(true);
  const [divYield, setDivYield] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const portfolio = await getPortfolio();
      const tickers = portfolio.map(a => a.ticker);
      if (tickers.length) await refreshIfStale(tickers);

      const refreshed = await getPortfolio();
      setAssets(refreshed);
      setTotalValue(await getPortfolioValue());
      setDailyChange(await getDailyChange());

      // div yield for ДИВИДЕНДЫ section
      getDividendYield().then(setDivYield).catch(() => {});
    } catch (e) {
      console.warn('Load portfolio failed:', e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalCost = assets.reduce((s, a) => s + (a.cost || 0), 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const isPositive = dailyChange >= 0;

  // Группировка по брокерам
  const brokers = (() => {
    const grouped = {};
    for (const a of assets) {
      const b = a.broker || 'Прочее';
      if (!grouped[b]) grouped[b] = { name: b, assets: [], value: 0, cost: 0, dailyChange: 0 };
      grouped[b].assets.push(a);
      grouped[b].value += a.value || 0;
      grouped[b].cost += a.cost || 0;
      grouped[b].dailyChange += ((a.value || 0) * (a.changePct || 0) / 100);
    }
    return Object.values(grouped).sort((a, b) => b.value - a.value);
  })();

  return (
    <div className="flex-1 overflow-auto px-4 pb-6">
      {/* Общая стоимость — with inline sparkline */}
      <Card theme={theme} style={{ marginBottom: 8, marginTop: 8 }}>
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: theme.gray1 }}>Все счета</div>
          <div className="font-bold tabular-nums" style={{ color: theme.text, fontSize: 32, marginTop: 4 }}>
            {fmtMoney(totalValue)}
          </div>
          <div className="tabular-nums" style={{ fontSize: 13, color: isPositive ? theme.green : theme.red, fontWeight: 500 }}>
            {isPositive ? '+' : ''}{fmtMoney(Math.abs(totalPnl))} ({totalPnl >= 0 ? '+' : ''}{totalPnlPct.toFixed(1)}%) за месяц
          </div>
          <svg width="100%" height={36} viewBox="0 0 300 36" style={{ marginTop: 6 }}>
            <polyline
              points={isPositive
                ? '0,30 40,28 80,32 120,26 160,20 200,16 240,18 280,14 300,10'
                : '0,10 40,14 80,12 120,18 160,24 200,20 240,26 280,28 300,30'}
              fill="none" stroke={isPositive ? theme.green : theme.red} strokeWidth="2"
            />
            <polyline
              points={isPositive
                ? '0,30 40,28 80,32 120,26 160,20 200,16 240,18 280,14 300,10 300,36 0,36'
                : '0,10 40,14 80,12 120,18 160,24 200,20 240,26 280,28 300,30 300,36 0,36'}
              fill={(isPositive ? theme.green : theme.red) + '10'} stroke="none"
            />
          </svg>
        </div>
      </Card>

      {/* ═══ БРОКЕРСКИЕ СЧЕТА ═══ */}
      {brokers.length > 0 ? (
        <>
          <div style={{ padding: '4px 0 4px', fontSize: 12, fontWeight: 600, color: theme.gray1 }}>
            БРОКЕРСКИЕ СЧЕТА ({brokers.length})
          </div>
          <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
            {brokers.map((b, i) => {
              const bPnl = b.value - b.cost;
              const bPnlPct = b.cost > 0 ? (bPnl / b.cost) * 100 : 0;
              const bIsUp = b.dailyChange >= 0;
              const hasMargin = b.assets.some(a => a.marginEnabled);
              return (
                <div key={b.name}
                  onClick={() => onNavigate?.('brokerDetail', b.name)}
                  className="flex items-center cursor-pointer"
                  style={{ gap: 10, padding: '14px 14px', borderBottom: i < brokers.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                  <div className="flex items-center justify-center shrink-0"
                    style={{ width: 40, height: 40, borderRadius: 12, background: (bIsUp ? theme.green : theme.red) + '10' }}>
                    <span style={{ fontSize: 18 }}>📈</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: theme.gray2 }}>
                      {b.assets[0]?.accountType || 'Брокерский'} · {b.assets.length} активов{hasMargin ? ' · маржа' : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>
                      {fmtMoney(b.value)}
                    </div>
                    <div className="tabular-nums" style={{ fontSize: 12, color: bIsUp ? theme.green : theme.red, fontWeight: 500 }}>
                      {bIsUp ? '+' : ''}{fmtMoney(b.dailyChange)}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      ) : !loading ? (
        <EmptyState
          icon="📈"
          title="Портфель пуст"
          subtitle="Добавьте первую сделку"
          tip="Портфель, дивиденды и налоги — всё в одном месте"
          actionLabel="+ Сделка"
          onAction={() => onNavigate?.('tradeForm')}
          theme={theme}
        />
      ) : (
        <div className="space-y-3">
          <SkeletonCard variant="chart" theme={theme} />
          <SkeletonCard theme={theme} />
          <SkeletonCard variant="compact" theme={theme} />
        </div>
      )}

      {/* Навигация */}
      {/* ДИВИДЕНДЫ */}
      {totalValue > 0 && (
        <>
          <div style={{ padding: '0 0 4px', fontSize: 12, fontWeight: 600, color: theme.gray1 }}>ДИВИДЕНДЫ {new Date().getFullYear()}</div>
          <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
            <div className="flex justify-between" style={{ padding: '12px 14px', borderBottom: `0.5px solid ${theme.gray5}` }}>
              <span style={{ fontSize: 14, color: theme.text }}>Прогноз</span>
              <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.green }}>
                {divYield ? fmtMoney(divYield.totalDividends) : '—'}
              </span>
            </div>
            <div className="flex justify-between" style={{ padding: '12px 14px' }}>
              <span style={{ fontSize: 14, color: theme.text }}>Получено</span>
              <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>
                {divYield ? fmtMoney(divYield.received || 0) : '—'}
              </span>
            </div>
          </Card>
        </>
      )}

      {/* ИМПОРТ */}
      <div style={{ padding: '0 0 4px', fontSize: 12, fontWeight: 600, color: theme.gray1 }}>ИМПОРТ</div>
      <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
        <div className="flex items-center cursor-pointer" style={{ gap: 10, padding: '12px 14px', borderBottom: `0.5px solid ${theme.gray5}` }}>
          <div className="flex items-center justify-center shrink-0"
            style={{ width: 28, height: 28, borderRadius: 7, background: (theme.orange || '#FF9500') + '18' }}>
            <span style={{ fontSize: 14 }}>📷</span>
          </div>
          <div className="flex-1">
            <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>Фото отчёта</div>
            <div style={{ fontSize: 12, color: theme.gray2 }}>AI распознает позиции</div>
          </div>
          <span style={{ color: theme.gray3 }}>→</span>
        </div>
        <div className="flex items-center cursor-pointer" style={{ gap: 10, padding: '12px 14px', borderBottom: `0.5px solid ${theme.gray5}` }}>
          <div className="flex items-center justify-center shrink-0"
            style={{ width: 28, height: 28, borderRadius: 7, background: (theme.accent) + '18' }}>
            <span style={{ fontSize: 14 }}>📤</span>
          </div>
          <div className="flex-1">
            <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>PDF/Excel от брокера</div>
            <div style={{ fontSize: 12, color: theme.gray2 }}>Загрузить документ</div>
          </div>
          <span style={{ color: theme.gray3 }}>→</span>
        </div>
        <div className="flex items-center cursor-pointer" style={{ gap: 10, padding: '12px 14px' }}>
          <div className="flex items-center justify-center shrink-0"
            style={{ width: 28, height: 28, borderRadius: 7, background: (theme.purple || '#AF52DE') + '18' }}>
            <span style={{ fontSize: 14 }}>📝</span>
          </div>
          <div className="flex-1">
            <div style={{ fontSize: 14, color: theme.text }}>Добавить счёт вручную</div>
          </div>
          <span style={{ color: theme.gray3 }}>→</span>
        </div>
      </Card>
    </div>
  );
}
