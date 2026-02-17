import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';

function CustomTooltip({ active, payload, theme }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: theme?.card || '#fff', color: theme?.text }}
    >
      <div className="font-semibold">{d.date}</div>
      <div className="tabular-nums" style={{ color: theme?.accent }}>
        {d.amount.toLocaleString('ru-RU')}₸
      </div>
    </div>
  );
}

/**
 * MonthlyLineChart — расходы по дням месяца.
 * @param {Array} data - [{date: '02-01', amount: 3200}]
 * @param {object} theme
 */
export default function MonthlyLineChart({ data = [], theme }) {
  if (!data.length) return null;

  const accentColor = theme?.accent || '#007AFF';

  return (
    <div className="w-full" style={{ height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gradientArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={accentColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: theme?.gray2 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: theme?.gray2 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}К` : v}
          />
          <Tooltip content={<CustomTooltip theme={theme} />} />
          <Area
            type="monotone"
            dataKey="amount"
            stroke={accentColor}
            strokeWidth={2}
            fill="url(#gradientArea)"
            dot={false}
            activeDot={{ r: 4, fill: accentColor, stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
