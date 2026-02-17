import {
  BarChart, Bar, XAxis, YAxis, Cell,
  ResponsiveContainer, LabelList,
} from 'recharts';

function getBarColor(pct, theme) {
  if (pct >= 1.0) return theme?.red || '#FF3B30';
  if (pct >= 0.7) return theme?.yellow || '#FFCC00';
  return theme?.green || '#34C759';
}

/**
 * BudgetBarsChart — горизонтальные бары бюджета по категориям.
 * Цвет: <70% зелёный, 70-99% жёлтый, ≥100% красный.
 * @param {Array} data - [{name, spent, limit, emoji}]
 * @param {object} theme
 */
export default function BudgetBarsChart({ data = [], theme }) {
  if (!data.length) return null;

  const chartData = data.map(d => ({
    ...d,
    pct: d.limit > 0 ? d.spent / d.limit : 0,
    label: `${d.emoji} ${d.name}`,
    display: Math.min(d.spent, d.limit * 1.1), // cap visual at 110%
  }));

  return (
    <div className="w-full" style={{ height: data.length * 44 + 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
          barSize={14}
        >
          <XAxis
            type="number"
            hide
            domain={[0, (dataMax) => Math.max(dataMax * 1.15, 1)]}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 12, fill: theme?.text }}
            axisLine={false}
            tickLine={false}
            width={100}
          />
          <Bar dataKey="display" radius={[0, 7, 7, 0]} background={{ fill: theme?.gray5, radius: 7 }}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={getBarColor(entry.pct, theme)} />
            ))}
            <LabelList
              dataKey="pct"
              position="right"
              formatter={v => `${Math.round(v * 100)}%`}
              style={{ fontSize: 11, fontWeight: 600, fill: theme?.gray1 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
