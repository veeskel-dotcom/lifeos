import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const RADIAN = Math.PI / 180;

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, emoji, percent }) {
  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.05) return null;
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="text-sm">
      {emoji}
    </text>
  );
}

/**
 * ExpensePieChart — круговая диаграмма расходов по категориям.
 * @param {Array} data - [{name, value, color, emoji}]
 * @param {object} theme
 */
export default function ExpensePieChart({ data = [], theme }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!data.length) return null;

  return (
    <div className="relative w-full" style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            label={renderCustomLabel}
            labelLine={false}
            stroke="none"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {/* Центр: общая сумма */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xl font-bold tabular-nums" style={{ color: theme.text }}>
          {total.toLocaleString('ru-RU')}
        </span>
        <span className="text-xs" style={{ color: theme.gray1 }}>₸</span>
      </div>
    </div>
  );
}
