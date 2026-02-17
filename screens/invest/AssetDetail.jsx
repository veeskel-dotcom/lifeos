import { useState, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import ConfirmSheet from '../../components/ConfirmSheet';
import SkeletonCard from '../../components/SkeletonCard';
import { getAsset, removeAsset } from '../../services/portfolio';
import { getQuote } from '../../services/quotes';
import { getTrades } from '../../services/trades';
import { getDividends } from '../../services/dividends';
import { fmtMoneyFrac as fmt } from '../../utils/currency';

export default function AssetDetail({ assetId, theme, onBack, onNavigate }) {
  const [asset, setAsset] = useState(null);
  const [quote, setQuote] = useState(null);
  const [trades, setTrades] = useState([]);
  const [dividends, setDividends] = useState([]);
  const [period, setPeriod] = useState('1М');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!assetId) return;
    load();
  }, [assetId]);

  const load = async () => {
    const a = await getAsset(assetId);
    if (!a) return;
    setAsset(a);
    const q = await getQuote(a.ticker);
    setQuote(q);
    setTrades(await getTrades(a.ticker));
    setDividends(await getDividends(a.ticker));
  };

  const handleDelete = async () => {
    await removeAsset(assetId);
    setConfirmDelete(false);
    onBack();
  };

  if (!asset) return (
    <div style={{ background: theme.bg, minHeight: '100vh' }}>
      <NavHeader title="Актив" onBack={onBack} theme={theme} />
      <div className="px-4 space-y-3">
        <SkeletonCard theme={theme} />
        <SkeletonCard variant="compact" theme={theme} />
      </div>
    </div>
  );

  const currentPrice = quote?.price || asset.avg_price;
  const changePct = quote?.change_pct || 0;
  const value = asset.quantity * currentPrice;
  const pnl = value - asset.quantity * asset.avg_price;
  const pnlPct = asset.avg_price > 0 ? ((currentPrice - asset.avg_price) / asset.avg_price) * 100 : 0;
  const isUp = pnl >= 0;

  const changeMoney = quote?.change || (currentPrice - asset.avg_price);
  const PERIOD_LABELS = ['1Д', '1Н', '1М', '3М', '1Г', 'Всё'];

  return (
    <div className="flex flex-col h-full" style={{ background: theme.bg }}>
      <NavHeader title={asset.ticker} rightAction={{ label: '⋯', onClick: () => setConfirmDelete(true) }} onBack={onBack} theme={theme} />

      <div className="flex-1 overflow-auto px-4 pb-8">
        {/* Ticker header — LEFT aligned */}
        <div style={{ padding: '0 0 8px' }}>
          <div className="flex items-baseline" style={{ gap: 8 }}>
            <span className="tabular-nums" style={{ fontSize: 28, fontWeight: 700, color: theme.text }}>{fmt(currentPrice)}</span>
            <span className="tabular-nums" style={{ fontSize: 15, color: isUp ? theme.green : theme.red, fontWeight: 600 }}>
              {isUp ? '+' : ''}{fmt(Math.abs(changeMoney))} ({isUp ? '+' : ''}{changePct.toFixed(1)}%)
            </span>
          </div>
          <div style={{ fontSize: 13, color: theme.gray2 }}>
            {asset.name || asset.ticker} · {asset.exchange || 'МосБиржа'} · {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Period selector — BEFORE chart, green style */}
        <div className="flex" style={{ gap: 4, padding: '0 0 8px' }}>
          {PERIOD_LABELS.map((p, i) => (
            <div key={p} onClick={() => setPeriod(p)}
              className="cursor-pointer"
              style={{
                flex: 1, padding: '6px 0', borderRadius: 8, textAlign: 'center',
                fontSize: 12, fontWeight: 600,
                background: period === p ? (isUp ? theme.green : theme.red) + '12' : theme.gray5,
                color: period === p ? (isUp ? theme.green : theme.red) : theme.gray2,
              }}>{p}</div>
          ))}
        </div>

        {/* Chart area — SVG sparkline */}
        <div style={{ padding: '0 0 12px' }}>
          <svg width="100%" height={50} viewBox="0 0 280 35" preserveAspectRatio="none" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isUp ? theme.green : theme.red} stopOpacity="0.2" />
                <stop offset="100%" stopColor={isUp ? theme.green : theme.red} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={`0,35 ${generateSparkPoints(isUp)} 280,35`} fill="url(#cg)" />
            <polyline points={generateSparkPoints(isUp)} fill="none" stroke={isUp ? theme.green : theme.red} strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>

        {/* МОЯ ПОЗИЦИЯ — 3-column grid */}
        <div style={{ padding: '0 0 4px' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>МОЯ ПОЗИЦИЯ</span>
        </div>
        <Card theme={theme} style={{ padding: 14, marginBottom: 8 }}>
          <div className="flex justify-between" style={{ marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: theme.gray2 }}>Количество</div>
              <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>{asset.quantity} шт</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: theme.gray2 }}>Средняя</div>
              <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>{fmt(asset.avg_price)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: theme.gray2 }}>Стоимость</div>
              <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>{fmt(value)}</div>
            </div>
          </div>
          <div className="flex justify-between"
            style={{ padding: '8px 12px', background: (isUp ? theme.green : theme.red) + '08', borderRadius: 10 }}>
            <span className="tabular-nums" style={{ fontSize: 14, color: isUp ? theme.green : theme.red, fontWeight: 600 }}>
              P&L: {isUp ? '+' : ''}{fmt(pnl)}
            </span>
            <span className="tabular-nums" style={{ fontSize: 14, color: isUp ? theme.green : theme.red, fontWeight: 600 }}>
              {isUp ? '+' : ''}{pnlPct.toFixed(1)}%
            </span>
          </div>
        </Card>

        {/* ДИВИДЕНДЫ — with badges */}
        {dividends.length > 0 && (
          <>
            <div style={{ padding: '0 0 4px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>ДИВИДЕНДЫ</span>
            </div>
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              {dividends.map((d, i) => {
                const total = d.amount_per_share * asset.quantity;
                const yld = currentPrice > 0 ? (d.amount_per_share / currentPrice * 100).toFixed(1) : 0;
                return (
                  <div key={d.id} style={{ padding: '10px 14px', borderBottom: i < dividends.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                    <div className="flex justify-between" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{fmt(d.amount_per_share)} / акция</span>
                      <span style={{ fontSize: 14, color: theme.green, fontWeight: 600 }}>{yld}% доходность</span>
                    </div>
                    <div className="flex flex-wrap" style={{ gap: 4 }}>
                      {d.ex_date && (
                        <span style={{ padding: '3px 8px', borderRadius: 6, background: (theme.purple || '#AF52DE') + '12', fontSize: 11, color: theme.purple || '#AF52DE', fontWeight: 500 }}>
                          Отсечка {formatDate(d.ex_date)}
                        </span>
                      )}
                      <span style={{ padding: '3px 8px', borderRadius: 6, background: theme.green + '12', fontSize: 11, color: theme.green, fontWeight: 500 }}>
                        Выплата ~{fmt(total)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </Card>
          </>
        )}

        {/* МОИ СДЕЛКИ — dot + detail */}
        <div style={{ padding: '0 0 4px' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>МОИ СДЕЛКИ</span>
        </div>
        {trades.length === 0 ? (
          <div style={{ fontSize: 13, color: theme.gray2, padding: '4px 0 8px' }}>Нет сделок</div>
        ) : (
          <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
            {trades.map((t, i) => (
              <div key={t.id} className="flex items-center"
                style={{ gap: 10, padding: '10px 14px', borderBottom: i < trades.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: t.type === 'buy' ? theme.green : theme.red }} />
                <div className="flex-1">
                  <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>
                    {t.type === 'buy' ? 'Покупка' : 'Продажа'} · {t.quantity} шт × {fmt(t.price)}
                  </div>
                  <div style={{ fontSize: 12, color: theme.gray2 }}>
                    {formatDate(t.date)}{t.broker ? ` · ${t.broker}` : ''}
                  </div>
                </div>
                <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>
                  {fmt(t.quantity * t.price)}
                </span>
              </div>
            ))}
          </Card>
        )}

        {/* ПОКАЗАТЕЛИ */}
        <div style={{ padding: '0 0 4px' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>ПОКАЗАТЕЛИ</span>
        </div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
          {[
            { label: 'P/E', value: asset.pe ? asset.pe.toFixed(1) : '—' },
            { label: 'Капитализация', value: asset.market_cap || '—' },
            { label: 'Макс. 52 нед', value: asset.high_52w ? fmt(asset.high_52w) : '—' },
            { label: 'Мин. 52 нед', value: asset.low_52w ? fmt(asset.low_52w) : '—' },
            { label: 'Сектор', value: asset.sector || '—' },
          ].map((r, i, arr) => (
            <div key={r.label} className="flex justify-between"
              style={{ padding: '12px 14px', borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
              <span style={{ fontSize: 15, fontWeight: 400, color: theme.text }}>{r.label}</span>
              <span style={{ fontSize: 14, fontWeight: 400, color: theme.gray1 }}>{r.value}</span>
            </div>
          ))}
        </Card>

        <div style={{ height: 8 }} />
      </div>
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Удалить актив?"
        message="Актив будет удалён из портфеля"
        confirmLabel="Удалить"
        onConfirm={handleDelete}
        theme={theme}
      />
    </div>
  );
}


function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function generateSparkPoints(up) {
  if (up) return '0,28 15,25 30,30 50,22 65,18 80,24 100,20 120,15 140,18 160,12 180,14 200,8 220,10 240,6 260,10 275,5';
  return '0,5 15,10 30,6 50,14 65,18 80,12 100,16 120,22 140,18 160,24 180,22 200,28 220,26 240,30 260,26 275,30';
}
