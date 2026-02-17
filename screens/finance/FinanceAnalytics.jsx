import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import ChipBar from '../../components/ChipBar';
import SkeletonCard from '../../components/SkeletonCard';
import { getMonthlyStats, getYearlyStats } from '../../services/expenses';
import { fmtMoney } from '../../utils/currency';
import { shareText } from '../../utils/share';
import ScreenWrapper from '../../components/ScreenWrapper';

const MONTH_NAMES = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const PIE_COLORS = [
  '#007AFF','#34C759','#FF9500','#FF3B30','#AF52DE',
  '#5AC8FA','#FF2D55','#FFD60A','#30D158','#BF5AF2',
];

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function prevMonthStr(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthIndex(m) {
  return Number(m.split('-')[1]) - 1;
}

export default function FinanceAnalytics({ theme, onBack, onNavigate }) {
  const [month, setMonth] = useState(currentMonth());
  const [stats, setStats] = useState(null);
  const [prevStats, setPrevStats] = useState(null);
  const [view, setView] = useState('pie');

  /* A1.4 — year view */
  const [yearData, setYearData] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    (async () => {
      const [s, ps] = await Promise.all([
        getMonthlyStats(month),
        getMonthlyStats(prevMonthStr(month)),
      ]);
      setStats(s);
      setPrevStats(ps);
    })();
  }, [month]);

  useEffect(() => {
    if (view === 'year') {
      getYearlyStats(selectedYear).then(setYearData);
    }
  }, [view, selectedYear]);

  const shiftMonth = (dir) => {
    const [y, mo] = month.split('-').map(Number);
    const d = new Date(y, mo - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const mo = getMonthIndex(month);
  const yr = Number(month.split('-')[0]);
  const monthLabel = `${MONTH_NAMES[mo]} ${yr}`;
  const prevMo = getMonthIndex(prevMonthStr(month));
  const isCurrentMonth = month === currentMonth();

  const VIEWS = [
    { id: 'pie', label: 'Категории' },
    { id: 'trend', label: 'Тренд' },
    { id: 'compare', label: 'Сравнение' },
    { id: 'year', label: 'Год' },
  ];

  if (!stats) return (
    <ScreenWrapper theme={theme}>
      <NavHeader title="Аналитика" onBack={onBack} theme={theme} />
      <div className="px-4 space-y-3">
        <SkeletonCard theme={theme} />
        <SkeletonCard variant="chart" theme={theme} />
        <SkeletonCard variant="compact" theme={theme} />
      </div>
    </ScreenWrapper>
  );

  return (
    <ScreenWrapper theme={theme}>
      <NavHeader title="Аналитика" onBack={onBack} left theme={theme}
        right={stats && (
          <button onClick={async () => {
            const top3 = (stats.byCategory || []).slice(0, 3).map(c => `  ${c.category?.icon || '•'} ${c.category?.name}: ${fmtMoney(c.total)}`).join('\n');
            const text = `📊 Аналитика: ${monthLabel}\n💰 Итого: ${fmtMoney(stats.total)}\n\nТоп категории:\n${top3}`;
            const r = await shareText('LifeOS — Аналитика', text);
            if (r.copied) void 0;
          }} style={{ color: theme.accent, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>📤</button>
        )}
      />

      {/* Month nav */}
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => shiftMonth(-1)} className="text-lg px-2" style={{ color: theme.accent, background: 'none', border: 'none', cursor: 'pointer' }}>‹</button>
        <button onClick={() => !isCurrentMonth && setMonth(currentMonth())} className="text-base font-semibold" style={{ color: theme.text, background: 'none', border: 'none', cursor: isCurrentMonth ? 'default' : 'pointer' }}>{monthLabel}</button>
        <button onClick={() => shiftMonth(1)} className="text-lg px-2" style={{ color: isCurrentMonth ? theme.gray4 : theme.accent, background: 'none', border: 'none', cursor: isCurrentMonth ? 'default' : 'pointer' }} disabled={isCurrentMonth}>›</button>
      </div>

      {/* Total */}
      <div className="text-center mb-2">
        <span className="text-2xl font-bold" style={{ color: theme.text }}>{fmtMoney(stats.total)}</span>
        {prevStats && prevStats.total > 0 && (
          <div className="text-xs mt-0.5" style={{ color: stats.total <= prevStats.total ? theme.green : theme.red }}>
            {stats.total <= prevStats.total ? '↓' : '↑'} {Math.abs(Math.round(((stats.total - prevStats.total) / prevStats.total) * 100))}%
          </div>
        )}
      </div>

      {/* View toggle */}
      <div className="px-3">
        <ChipBar chips={VIEWS} active={view} onChange={setView} theme={theme} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3 mt-2">

        {/* ── A1.1 Pie chart ── */}
        {view === 'pie' && stats?.byCategory && (
          <Card theme={theme}>
            <div className="flex justify-center">
              <PieChart width={200} height={200}>
                <Pie
                  data={stats.byCategory}
                  dataKey="sum"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                  paddingAngle={2}
                >
                  {stats.byCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={v => fmtMoney(v)} contentStyle={{ background: theme.card, border: 'none', borderRadius: 8, fontSize: 12, color: theme.text }} />
              </PieChart>
            </div>

            <div className="space-y-2 mt-3">
              {stats.byCategory.map((cat, i) => (
                <div
                  key={cat.id || i}
                  className="flex items-center justify-between cursor-pointer active:opacity-70"
                  onClick={() => onNavigate?.('expenses-by-category', { categoryId: cat.id, month, categoryName: cat.name })}
                >
                  <div className="flex items-center gap-2">
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-sm" style={{ color: theme.text }}>{cat.icon} {cat.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium tabular-nums" style={{ color: theme.text }}>{fmtMoney(cat.sum)}</span>
                    <span className="text-xs ml-1" style={{ color: theme.gray2 }}>{cat.percent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── A1.2 Daily trend line ── */}
        {view === 'trend' && stats?.byDay && (
          <Card theme={theme}>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>Расходы по дням</span>
            <div className="mt-2" style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <LineChart data={stats.byDay}>
                  <XAxis dataKey="date" tickFormatter={d => d.slice(8, 10)} tick={{ fontSize: 10, fill: theme.gray2 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    formatter={v => fmtMoney(v)}
                    labelFormatter={d => { const dt = new Date(`${d}T12:00:00`); return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); }}
                    contentStyle={{ background: theme.card, border: 'none', borderRadius: 8, fontSize: 12, color: theme.text }}
                  />
                  {stats.byDay.length > 1 && (() => {
                    const avg = stats.byDay.reduce((s, d) => s + d.sum, 0) / stats.byDay.length;
                    return <ReferenceLine y={avg} stroke={theme.gray3} strokeDasharray="4 4" />;
                  })()}
                  <Line type="monotone" dataKey="sum" stroke={theme.accent} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Avg & max */}
            {stats.byDay.length > 0 && (() => {
              const avg = stats.byDay.reduce((s, d) => s + d.sum, 0) / stats.byDay.length;
              const maxDay = stats.byDay.reduce((m, d) => d.sum > m.sum ? d : m, stats.byDay[0]);
              return (
                <div className="flex gap-4 mt-3 text-xs" style={{ color: theme.gray1 }}>
                  <span>Ср. <b style={{ color: theme.text }}>{fmtMoney(avg)}</b>/день</span>
                  <span>Макс <b style={{ color: theme.red }}>{fmtMoney(maxDay.sum)}</b> ({maxDay.date.slice(8, 10)})</span>
                </div>
              );
            })()}

            {/* Cumulative */}
            {stats.byDay.length > 0 && (() => {
              let cum = 0;
              const cumData = stats.byDay.map(d => { cum += d.sum; return { date: d.date, cumulative: cum }; });
              return (
                <>
                  <span className="text-xs font-semibold uppercase tracking-wide mt-4 block" style={{ color: theme.gray1 }}>Накопительный</span>
                  <div className="mt-1" style={{ width: '100%', height: 120 }}>
                    <ResponsiveContainer>
                      <LineChart data={cumData}>
                        <XAxis dataKey="date" tickFormatter={d => d.slice(8, 10)} tick={{ fontSize: 10, fill: theme.gray2 }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Line type="monotone" dataKey="cumulative" stroke={theme.green} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              );
            })()}
          </Card>
        )}

        {/* ── T5 Compare ── */}
        {view === 'compare' && stats && prevStats && prevStats.total > 0 && (
          <Card theme={theme}>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
              {MONTH_NAMES[mo]} vs {MONTH_NAMES[prevMo]}
            </span>

            <CompareRow label="Расходы" current={stats.total || 0} previous={prevStats.total || 0} invertColor theme={theme} />

            {stats.income != null && prevStats.income != null && (
              <CompareRow label="Доходы" current={stats.income || 0} previous={prevStats.income || 0} theme={theme} />
            )}

            {stats.income != null && prevStats.income != null && (() => {
              const curSaving = (stats.income || 0) - (stats.total || 0);
              const prevSaving = (prevStats.income || 0) - (prevStats.total || 0);
              return <CompareRow label="Накопления" current={curSaving} previous={prevSaving} theme={theme} />;
            })()}

            {/* Overall badge */}
            {(() => {
              const diff = (stats.total || 0) - (prevStats.total || 0);
              const saved = diff < 0;
              return (
                <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl mt-4" style={{ background: (saved ? theme.green : theme.red) + '15' }}>
                  <span className="text-sm">{saved ? '📉' : '📈'}</span>
                  <span className="text-sm font-semibold" style={{ color: saved ? theme.green : theme.red }}>
                    {saved ? 'Экономия' : 'Перерасход'} {fmtMoney(Math.abs(diff))}
                  </span>
                </div>
              );
            })()}
          </Card>
        )}

        {/* T5 compare — top-3 growth categories */}
        {view === 'compare' && stats && prevStats && prevStats.total > 0 && (() => {
          const curCats = stats.byCategory;
          const prevCats = prevStats.byCategory;
          const growth = curCats
            .map(cat => {
              const prev = prevCats.find(c => c.id === cat.id);
              const prevSum = prev?.sum || 0;
              const diff = (cat.sum || 0) - prevSum;
              const pct = prevSum > 0 ? Math.round((diff / prevSum) * 100) : (cat.sum > 0 ? 100 : 0);
              return { ...cat, prevSum, diff, pct };
            })
            .filter(c => c.diff > 0)
            .sort((a, b) => b.diff - a.diff)
            .slice(0, 3);

          if (growth.length === 0) return null;

          return (
            <Card theme={theme}>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>Рост категорий</span>
              <div className="space-y-3 mt-3">
                {growth.map((cat, i) => {
                  const maxVal = Math.max(cat.sum, cat.prevSum, 1);
                  return (
                    <div key={cat.id || i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm" style={{ color: theme.text }}>{cat.icon} {cat.name}</span>
                        <span className="text-xs font-semibold" style={{ color: theme.red }}>
                          +{fmtMoney(cat.diff)} {cat.pct > 0 ? `+${cat.pct}%` : ''}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div style={{ height: 4, borderRadius: 2, background: theme.gray5 }}>
                          <div style={{ height: 4, borderRadius: 2, background: theme.gray3, width: `${(cat.prevSum / maxVal) * 100}%`, transition: 'width 0.3s' }} />
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: theme.gray5 }}>
                          <div style={{ height: 4, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], width: `${(cat.sum / maxVal) * 100}%`, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] mt-0.5" style={{ color: theme.gray2 }}>
                        <span>{MONTH_NAMES[prevMo]} {fmtMoney(cat.prevSum)}</span>
                        <span>{MONTH_NAMES[mo]} {fmtMoney(cat.sum)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })()}

        {/* T5 compare fallback */}
        {view === 'compare' && stats && (!prevStats || prevStats.total === 0) && (
          <Card theme={theme}>
            <div className="text-center py-8">
              <div className="text-4xl mb-3">📊</div>
              <div className="text-sm" style={{ color: theme.gray1 }}>Нет данных за прошлый месяц</div>
            </div>
          </Card>
        )}

        {/* ── A1.4 Year view ── */}
        {view === 'year' && (
          <Card theme={theme}>
            {/* Year nav */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setSelectedYear(y => y - 1)} className="text-lg" style={{ color: theme.accent, background: 'none', border: 'none', cursor: 'pointer' }}>‹</button>
              <span className="text-base font-semibold" style={{ color: theme.text }}>{selectedYear}</span>
              <button
                onClick={() => selectedYear < new Date().getFullYear() && setSelectedYear(y => y + 1)}
                className="text-lg"
                style={{ color: selectedYear >= new Date().getFullYear() ? theme.gray4 : theme.accent, background: 'none', border: 'none', cursor: selectedYear >= new Date().getFullYear() ? 'default' : 'pointer' }}
                disabled={selectedYear >= new Date().getFullYear()}
              >›</button>
            </div>

            {yearData && (
              <>
                {/* Year total + avg */}
                <div className="text-center mb-3">
                  <span className="text-2xl font-bold" style={{ color: theme.text }}>
                    {fmtMoney(yearData.reduce((s, m) => s + m.total, 0))}
                  </span>
                  <div className="text-xs mt-0.5" style={{ color: theme.gray1 }}>
                    Ср. {fmtMoney(yearData.reduce((s, m) => s + m.total, 0) / 12)}/мес
                  </div>
                </div>

                {/* BarChart */}
                <div style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer>
                    <BarChart data={yearData}>
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: theme.gray2 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip formatter={v => fmtMoney(v)} contentStyle={{ background: theme.card, border: 'none', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        {yearData.map((entry, i) => (
                          <Cell key={i} fill={entry.month === month ? theme.accent : theme.gray3} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </Card>
        )}

      </div>
    </ScreenWrapper>
  );
}

/* ── Compare Row helper ── */

function CompareRow({ label, current, previous, invertColor, theme }) {
  const diff = current - previous;
  const pct = previous > 0 ? Math.round((Math.abs(diff) / previous) * 100) : 0;
  const isGood = invertColor ? diff < 0 : diff > 0;
  const color = diff === 0 ? theme.gray2 : (isGood ? theme.green : theme.red);
  const arrow = diff < 0 ? '↓' : (diff > 0 ? '↑' : '');

  return (
    <div className="flex items-center justify-between mt-3">
      <span className="text-sm" style={{ color: theme.gray1 }}>{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs tabular-nums" style={{ color: theme.gray2 }}>{fmtMoney(previous)}</span>
        <span className="text-sm" style={{ color: theme.gray3 }}>→</span>
        <span className="text-sm font-semibold tabular-nums" style={{ color: theme.text }}>{fmtMoney(current)}</span>
        {pct > 0 && <span className="text-xs font-semibold tabular-nums" style={{ color }}>{arrow}{pct}%</span>}
      </div>
    </div>
  );
}
