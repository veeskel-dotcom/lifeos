import { useState, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import ProgressBar from '../../components/ProgressBar';
import EmptyState from '../../components/EmptyState';
import { getPortfolio, getBrokerMeta } from '../../services/portfolio';
import { fmtMoney as fmt } from '../../utils/currency';

function MiniSparkline({ up, theme }) {
  const pts = up
    ? '0,30 50,28 100,32 150,24 200,18 250,20 300,12'
    : '0,12 50,16 100,10 150,18 200,24 250,22 300,30';
  return (
    <svg width="100%" height={36} viewBox="0 0 300 36" style={{ marginTop: 8 }}>
      <polyline points={pts} fill="none" stroke={up ? theme.green : theme.red} strokeWidth="2" />
      <polyline points={`${pts} 300,36 0,36`} fill={(up ? theme.green : theme.red) + '10'} stroke="none" />
    </svg>
  );
}

export default function BrokerDetail({ broker, theme, onBack, onNavigate }) {
  const [assets, setAssets] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const all = await getPortfolio();
      setAssets(all.filter(a => (a.broker || 'Прочее') === broker));
      const m = await getBrokerMeta?.(broker).catch(() => null);
      setMeta(m);
      setLoading(false);
    })();
  }, [broker]);

  const totalValue = assets.reduce((s, a) => s + (a.value || 0), 0);
  const totalCost = assets.reduce((s, a) => s + (a.cost || 0), 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const isPnlUp = totalPnl >= 0;

  const divForecast = meta?.divForecast || assets.reduce((s, a) => s + (a.divYield || 0) * (a.value || 0) / 100, 0);
  const divReceived = meta?.divReceived || 0;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title={broker} onBack={onBack} right="⚙" theme={theme} />

      <div className="flex-1 overflow-auto px-4 pb-8 space-y-3">
        {/* Summary */}
        <Card theme={theme}>
          <div className="flex justify-between items-start">
            <div>
              {meta?.type && <div className="text-xs" style={{ color: theme.gray1 }}>{meta.type}</div>}
              <div className="font-bold tabular-nums" style={{ color: theme.text, fontSize: 28 }}>{fmt(totalValue)}</div>
              <div className="text-sm font-medium tabular-nums" style={{ color: isPnlUp ? theme.green : theme.red }}>
                {isPnlUp ? '+' : ''}{fmt(totalPnl)} ({totalPnlPct.toFixed(1)}%)
              </div>
            </div>
            <div className="text-xs text-right" style={{ color: theme.gray1 }}>{assets.length} активов</div>
          </div>
          <MiniSparkline up={isPnlUp} theme={theme} />
        </Card>

        {/* Margin / ГО */}
        {meta?.margin && (
          <Card theme={theme}>
            <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1, marginBottom: 6 }}>МАРЖА / ГО</div>
            <div className="flex justify-between" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: theme.gray1 }}>Использовано (ГО)</span>
              <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: theme.orange }}>{fmt(meta.margin.used)}</span>
            </div>
            <div className="flex justify-between" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: theme.gray1 }}>Доступно</span>
              <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: theme.green }}>{fmt(meta.margin.available)}</span>
            </div>
            <ProgressBar value={meta.margin.used} max={meta.margin.used + meta.margin.available}
              color={theme.orange} height={4} theme={theme} />
            {meta.margin.uds != null && (
              <div className="text-xs mt-1" style={{ color: theme.gray2 }}>
                УДС: {meta.margin.uds.toFixed(2)} (норма {'>'} 1.0)
              </div>
            )}
          </Card>
        )}

        {/* Positions */}
        <div style={{ padding: '0 0 4px' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>ПОЗИЦИИ ({assets.length})</span>
        </div>
        {assets.length === 0 && !loading && (
          <EmptyState icon="📈" title="Нет бумаг" subtitle="Добавьте сделку для этого брокера"
            actionLabel="+ Сделка" onAction={() => onNavigate('tradeForm')} theme={theme} />
        )}
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
          {assets.map((asset, i) => {
            const up = (asset.pnl || 0) >= 0;
            return (
              <div key={asset.id} onClick={() => onNavigate('assetDetail', asset.id)}
                className="flex items-center cursor-pointer active:opacity-70"
                style={{ gap: 10, padding: '12px 14px', borderBottom: i < assets.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                <div className="flex items-center justify-center shrink-0"
                  style={{ width: 36, height: 36, borderRadius: 10, background: (up ? theme.green : theme.red) + '15' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: up ? theme.green : theme.red }}>
                    {asset.ticker?.slice(0, 3)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{asset.name || asset.ticker}</div>
                  <div className="tabular-nums" style={{ fontSize: 12, color: theme.gray2 }}>{asset.quantity} шт × {fmt(asset.currentPrice)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{fmt(asset.value)}</div>
                  <div className="tabular-nums" style={{ fontSize: 12, color: up ? theme.green : theme.red }}>
                    {up ? '+' : ''}{(asset.pnlPct || 0).toFixed(1)}%
                  </div>
                </div>
              </div>
            );
          })}
        </Card>

        {/* Dividends */}
        {(divForecast > 0 || divReceived > 0) && (
          <>
            <div style={{ padding: '0 0 4px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>ДИВИДЕНДЫ</span>
            </div>
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              <div className="flex justify-between" style={{ padding: '12px 14px', borderBottom: `0.5px solid ${theme.gray5}` }}>
                <span style={{ fontSize: 14, color: theme.text }}>Прогноз на год</span>
                <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.green }}>{fmt(Math.round(divForecast))}</span>
              </div>
              <div className="flex justify-between" style={{ padding: '12px 14px' }}>
                <span style={{ fontSize: 14, color: theme.gray1 }}>Получено</span>
                <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{fmt(Math.round(divReceived))}</span>
              </div>
            </Card>
          </>
        )}

        {/* Import */}
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
          {[
            { icon: '📷', color: theme.orange || '#FF9500', label: 'Фото отчёта' },
            { icon: '📤', color: theme.accent, label: 'Загрузить PDF/Excel' },
            { icon: '📝', color: theme.purple || '#AF52DE', label: 'Добавить вручную' },
          ].map((item, i) => (
            <div key={item.label}
              className="flex items-center cursor-pointer active:opacity-70"
              style={{ gap: 10, padding: '12px 14px', borderBottom: i < 2 ? `0.5px solid ${theme.gray5}` : 'none' }}>
              <div className="flex items-center justify-center shrink-0"
                style={{ width: 24, height: 24, borderRadius: 6, background: item.color + '18' }}>
                <span style={{ fontSize: 12 }}>{item.icon}</span>
              </div>
              <span className="flex-1" style={{ fontSize: 14, color: theme.text }}>{item.label}</span>
              <span style={{ color: theme.gray3 }}>→</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
