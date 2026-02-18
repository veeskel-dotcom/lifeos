import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import Ic from '../../components/Icon';
import { getNetWorth, getNetWorthHistory, saveSnapshot } from '../../services/networth';
import { fmtMoney as fmt } from '../../utils/currency';

export default function NetWorthScreen({ theme, onBack }) {
  const [nw, setNw] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const data = await getNetWorth();
    setNw(data);
    await saveSnapshot();
    setHistory(await getNetWorthHistory(12));
  };

  if (!nw) return (
    <div className="flex flex-col h-full">
      <NavHeader title="Чистый капитал" onBack={onBack} theme={theme} />
      <div className="px-4 pt-8">
        <EmptyState
          icon={<Ic name="chart" color={theme.accent} size={48} r={14} />}
          title="Нет данных"
          subtitle="Добавьте счета и активы"
          tip="Добавьте счета и брокеров для расчёта"
          theme={theme}
        />
      </div>
    </div>
  );

  const assetsTotal = nw.assets.accounts + nw.assets.investments + nw.assets.savings + nw.assets.cash;
  const liabTotal = nw.liabilities.credits + nw.liabilities.creditCards;
  const isPositive = nw.total >= 0;

  return (
    <div className="flex flex-col h-full">
      <NavHeader title="Чистый капитал" onBack={onBack} theme={theme} />

      <div className="flex-1 overflow-auto px-4 pb-8">
        {/* Total */}
        <div className="text-center mb-4">
          <div className="text-3xl font-bold" style={{ color: isPositive ? theme.green : theme.red }}>
            {fmt(nw.total)}
          </div>
        </div>

        {/* History chart */}
        {history.length > 1 && (
          <Card theme={theme} style={{ padding: 8, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={history}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: theme.gray2 }}
                  tickFormatter={d => d.slice(5)}
                />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: theme.card, border: 'none', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [fmt(v), 'Чистый капитал']}
                />
                <Line type="monotone" dataKey="value" stroke={theme.accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Assets */}
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-semibold uppercase" style={{ color: theme.gray1 }}>Активы</span>
          <span className="text-sm font-semibold" style={{ color: theme.green }}>+{fmt(assetsTotal)}</span>
        </div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <NwRow theme={theme} label="Счета" value={nw.assets.accounts} border />
          <NwRow theme={theme} label="Инвестиции" value={nw.assets.investments} border />
          <NwRow theme={theme} label="Накопительные" value={nw.assets.savings} border />
          <NwRow theme={theme} label="Наличные" value={nw.assets.cash} />
        </Card>

        {/* Liabilities */}
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-semibold uppercase" style={{ color: theme.gray1 }}>Пассивы</span>
          <span className="text-sm font-semibold" style={{ color: theme.red }}>−{fmt(liabTotal)}</span>
        </div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <NwRow theme={theme} label="Кредиты" value={nw.liabilities.credits} isNeg border />
          <NwRow theme={theme} label="Кредитные карты" value={nw.liabilities.creditCards} isNeg />
        </Card>

        {/* Bottom line */}
        <Card theme={theme} style={{ padding: 16 }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: theme.text }}>=  Чистый капитал</span>
            <span className="text-lg font-bold" style={{ color: isPositive ? theme.green : theme.red }}>
              {fmt(nw.total)}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function NwRow({ theme, label, value, isNeg, border }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5"
      style={{ borderBottom: border ? `0.5px solid ${theme.gray5}` : 'none' }}
    >
      <span className="text-sm" style={{ color: theme.gray1 }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: isNeg ? theme.red : theme.text }}>
        {fmt(value)}
      </span>
    </div>
  );
}
