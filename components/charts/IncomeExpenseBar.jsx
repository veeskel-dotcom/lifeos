import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

function CustomTooltip({ active, payload, label, theme }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: theme?.card || '#fff', color: theme?.text }}
    >
      <div className="font-semibold mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1 tabular-nums">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: {p.value.toLocaleString('ru-RU')}₸
        </div>
      ))}
    </div>
  );
}

/**
 * IncomeExpenseBar — доходы vs расходы за 6 месяцев.
 * @param {Array} data - [{month: 'Янв', income: 150000, expense: 65000}]
 * @param {object} theme
 */
export default function IncomeExpenseBar({ data = [], theme }) {
  if (!data.length) return null;

  return (
    <div className="w-full" style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barGap={2}>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: theme?.gray2 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: theme?.gray2 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}К` : v}
          />
          <Tooltip content={<CustomTooltip theme={theme} />} />
          <Bar
            dataKey="income"
            name="Доходы"
            fill={theme?.green || '#34C759'}
            radius={[4, 4, 0, 0]}
            barSize={16}
          />
          <Bar
            dataKey="expense"
            name="Расходы"
            fill={theme?.red || '#FF3B30'}
            radius={[4, 4, 0, 0]}
            barSize={16}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
