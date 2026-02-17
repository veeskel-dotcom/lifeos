/**
 * E8: Налоговый калькулятор — НДФЛ 13% на реализованную прибыль.
 */
import { useState, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import { fmtMoney } from '../../utils/currency';
import { getTradeHistory } from '../../services/trades';

const TAX_RATE = 0.13;
const YEARS = (() => {
  const now = new Date().getFullYear();
  return [now, now - 1, now - 2];
})();

export default function TaxCalculator({ theme, onBack }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { calculate(); }, [year]);

  const calculate = async () => {
    setLoading(true);
    try {
      const trades = await getTradeHistory('all');
      const yearTrades = trades.filter(t => t.date?.startsWith(String(year)));

      // Считаем среднюю цену покупки по FIFO
      const buys = {}; // { ticker: [{ qty, price }] }
      const sells = [];

      // Собираем все покупки до конца года
      const allTradesBeforeYearEnd = trades.filter(t => t.date <= `${year}-12-31`);

      for (const t of allTradesBeforeYearEnd) {
        if (!buys[t.ticker]) buys[t.ticker] = [];
        if (t.type === 'buy') {
          buys[t.ticker].push({ qty: t.quantity, price: t.price, date: t.date });
        }
      }

      // Считаем реализованную прибыль по продажам текущего года (FIFO)
      let totalGain = 0;
      let totalSellVolume = 0;
      const details = [];

      for (const t of yearTrades.filter(tr => tr.type === 'sell')) {
        let remaining = t.quantity;
        let costBasis = 0;
        const queue = buys[t.ticker] || [];

        while (remaining > 0 && queue.length > 0) {
          const lot = queue[0];
          const take = Math.min(remaining, lot.qty);
          costBasis += take * lot.price;
          lot.qty -= take;
          remaining -= take;
          if (lot.qty <= 0) queue.shift();
        }

        const sellAmount = t.quantity * t.price;
        const gain = sellAmount - costBasis;
        totalGain += gain;
        totalSellVolume += sellAmount;

        details.push({
          ticker: t.ticker,
          date: t.date,
          qty: t.quantity,
          sellPrice: t.price,
          sellAmount,
          costBasis,
          gain,
        });
      }

      const tax = Math.max(0, Math.round(totalGain * TAX_RATE));

      setResult({
        year,
        sellCount: details.length,
        totalSellVolume,
        totalGain,
        tax,
        details,
      });
    } catch (e) {
      console.error('[TaxCalculator]', e);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Налоговый калькулятор" onBack={onBack} theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
        {/* Year selector */}
        <div className="flex gap-2 justify-center py-2">
          {YEARS.map(y => (
            <button key={y} onClick={() => setYear(y)}
              className="px-5 py-2 rounded-xl text-sm font-medium"
              style={{
                background: year === y ? theme.accent + '15' : theme.gray6,
                color: year === y ? theme.accent : theme.gray1,
                border: year === y ? `1.5px solid ${theme.accent}` : '1.5px solid transparent',
              }}>{y}</button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-8 text-sm" style={{ color: theme.gray2 }}>Расчёт...</div>
        )}

        {result && !loading && (
          <>
            {/* Summary */}
            <Card theme={theme}>
              <div className="text-center space-y-2">
                <div className="text-xs uppercase tracking-wide" style={{ color: theme.gray2 }}>
                  НДФЛ к уплате за {result.year}
                </div>
                <div className="text-3xl font-bold" style={{ color: result.tax > 0 ? theme.red : theme.green }}>
                  {fmtMoney(result.tax)}
                </div>
                <div className="text-xs" style={{ color: theme.gray2 }}>
                  Ставка: {(TAX_RATE * 100).toFixed(0)}%
                </div>
              </div>
            </Card>

            {/* Breakdown */}
            <Card theme={theme}>
              <div className="space-y-2">
                <Row label="Продаж" value={String(result.sellCount)} theme={theme} />
                <Row label="Объём продаж" value={fmtMoney(result.totalSellVolume)} theme={theme} />
                <Row
                  label="Реализованная прибыль"
                  value={fmtMoney(result.totalGain)}
                  color={result.totalGain >= 0 ? theme.green : theme.red}
                  theme={theme}
                />
              </div>
            </Card>

            {/* Details */}
            {result.details.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-2 px-1" style={{ color: theme.gray1 }}>
                  Детализация
                </div>
                <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
                  {result.details.map((d, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5"
                      style={{ borderBottom: i < result.details.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold" style={{ color: theme.text }}>
                          {d.ticker} × {d.qty}
                        </div>
                        <div className="text-[10px]" style={{ color: theme.gray2 }}>
                          {d.date} · Продажа {fmtMoney(d.sellAmount)} · Базис {fmtMoney(d.costBasis)}
                        </div>
                      </div>
                      <div className="text-sm font-medium tabular-nums"
                        style={{ color: d.gain >= 0 ? theme.green : theme.red }}>
                        {d.gain >= 0 ? '+' : ''}{fmtMoney(d.gain)}
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-[10px] text-center px-4" style={{ color: theme.gray3 }}>
              Расчёт приблизительный (FIFO). Не является налоговой консультацией.
              Учитывайте комиссии брокера и вычеты.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, color, theme }) {
  return (
    <div className="flex justify-between">
      <span className="text-xs" style={{ color: theme.gray2 }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: color || theme.text }}>{value}</span>
    </div>
  );
}
