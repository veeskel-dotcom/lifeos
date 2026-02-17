import { useState, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { METRICS, LABELS, COLORS, addMeasurement, getMeasurements } from '../../services/measurements';
import ScreenWrapper from '../../components/ScreenWrapper';

// SVG body silhouette with measurement lines
function BodySilhouette({ theme }) {
  return (
    <svg width={80} height={160} viewBox="0 0 80 160">
      <ellipse cx="40" cy="14" rx="12" ry="14" fill="none" stroke={theme.gray3} strokeWidth="1.5" />
      <path
        d="M28 28 Q20 40 16 60 L18 90 L24 90 L28 70 L28 100 L24 140 L30 142 L36 100 L40 100 L44 100 L50 142 L56 140 L52 100 L52 70 L56 90 L62 90 L64 60 Q60 40 52 28 Z"
        fill="none" stroke={theme.gray3} strokeWidth="1.5"
      />
      <line x1="14" y1="50" x2="66" y2="50" stroke="#007AFF" strokeWidth="1" strokeDasharray="2,2" />
      <line x1="20" y1="72" x2="60" y2="72" stroke="#34C759" strokeWidth="1" strokeDasharray="2,2" />
      <line x1="18" y1="88" x2="62" y2="88" stroke="#AF52DE" strokeWidth="1" strokeDasharray="2,2" />
    </svg>
  );
}

// Detail view for a single measurement
function MeasurementDetail({ metric, measurements, theme, onBack }) {
  const label = LABELS[metric];
  const color = COLORS[metric];
  const entries = measurements
    .filter(m => m[metric] != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const current = entries.length > 0 ? entries[entries.length - 1][metric] : null;
  const first = entries.length > 0 ? entries[0][metric] : null;
  const totalDelta = current && first ? (current - first).toFixed(1) : null;

  const chartData = entries.map(m => ({ date: m.date, value: m[metric] }));

  return (
    <ScreenWrapper theme={theme}>
      <NavHeader title={label} onBack={onBack} theme={theme} />
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {/* Current value */}
        <Card theme={theme}>
          <div style={{ textAlign: 'center', paddingTop: 8, paddingBottom: 8 }}>
            <div style={{ color: theme.text, fontSize: 42, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {current ?? '—'}<span style={{ color: theme.gray2, fontSize: 18, fontWeight: 400 }}> см</span>
            </div>
            {totalDelta && (
              <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4, color: totalDelta === '0.0' ? theme.gray2
                  : parseFloat(totalDelta) < 0 ? theme.green : theme.accent }}>
                {totalDelta === '0.0' ? 'без изменений' : `${parseFloat(totalDelta) > 0 ? '+' : ''}${totalDelta} см за ${entries.length > 1 ? entries.length - 1 : 0} замеров`}
              </div>
            )}
          </div>
        </Card>

        {/* Chart */}
        {chartData.length >= 2 && (
          <>
            <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
              История
            </div>
            <Card theme={theme}>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: theme.gray2 }} axisLine={false} tickLine={false} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: theme.gray2 }} axisLine={false} tickLine={false} width={35} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: theme.card, border: 'none', borderRadius: 8, fontSize: 12, color: theme.text }} formatter={v => [`${v} см`, label]} />
                  <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </>
        )}

        {/* Log entries */}
        <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
          Записи
        </div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
          {[...entries].reverse().map((e, i) => {
            const prevEntry = [...entries].reverse()[i + 1];
            const diff = prevEntry ? (e[metric] - prevEntry[metric]).toFixed(1) : null;
            return (
              <div key={e.id || i}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: i < [...entries].reverse().length - 1 ? '0.5px solid ' + theme.gray5 : 'none' }}>
                  <span style={{ color: theme.gray2, fontSize: 13, width: 56 }}>
                    {e.date.slice(8, 10)}/{e.date.slice(5, 7)}
                  </span>
                  <span style={{ flex: 1, color: theme.text, fontSize: 15, fontWeight: 600 }}>
                    {e[metric]} см
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: diff === null ? theme.gray2
                      : parseFloat(diff) < 0 ? theme.green
                      : parseFloat(diff) > 0 ? theme.accent
                      : theme.gray2,
                    minWidth: 48, textAlign: 'right' }}>
                    {diff === null ? '—' : `${parseFloat(diff) > 0 ? '+' : ''}${diff}`}
                  </span>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </ScreenWrapper>
  );
}

export default function MeasurementsScreen({ theme, onBack }) {
  const [latest, setLatest] = useState(null);
  const [prev, setPrev] = useState(null);
  const [allMeasurements, setAllMeasurements] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [detailMetric, setDetailMetric] = useState(null);

  const load = async () => {
    try {
      const all = await getMeasurements(100);
      setAllMeasurements(all);
      if (all.length > 0) setLatest(all[0]);
      if (all.length > 1) setPrev(all[1]);
    } catch { /* тихая ошибка */ }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const hasValue = METRICS.some(m => form[m]);
    if (!hasValue) return;
    const data = {};
    METRICS.forEach(m => { if (form[m]) data[m] = parseFloat(form[m]); });
    await addMeasurement(data);
    setForm({});
    setShowForm(false);
    load();
  };

  const getDelta = (metric) => {
    if (!latest?.[metric] || !prev?.[metric]) return null;
    return (latest[metric] - prev[metric]).toFixed(1);
  };

  // Detail view
  if (detailMetric) {
    return (
      <MeasurementDetail
        metric={detailMetric}
        measurements={allMeasurements}
        theme={theme}
        onBack={() => setDetailMetric(null)}
      />
    );
  }

  // Key stats for hero grid
  const keyStats = [
    { m: 'chest', l: 'Грудь' },
    { m: 'waist', l: 'Талия' },
    { m: 'hips', l: 'Бёдра' },
    { m: 'biceps_r', l: 'Бицепс' },
  ];

  return (
    <ScreenWrapper theme={theme}>
      <div className="px-5" style={{ paddingTop: 12, paddingBottom: 12 }}>
        <div className="flex items-center justify-between">
          {onBack && <button onClick={onBack} style={{ color: theme.accent, fontSize: 16, fontWeight: 500 }}>← Спорт</button>}
          <span />
        </div>
        <div style={{ color: theme.text, fontSize: 28, fontWeight: 700 }}>Обмеры тела</div>
        <div style={{ color: theme.gray1, fontSize: 13 }}>
          {latest ? `Последние: ${latest.date}` : 'Нет данных'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
        {/* Body silhouette + key stats */}
        {latest && (
          <Card theme={theme} style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <BodySilhouette theme={theme} />
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {keyStats.map(s => {
                  const val = latest[s.m];
                  const d = getDelta(s.m);
                  const c = COLORS[s.m];
                  return (
                    <div key={s.m} style={{ cursor: 'pointer', borderRadius: 8, padding: '6px 8px', background: c + '08' }}
                      onClick={() => val && setDetailMetric(s.m)}>
                      <div style={{ color: theme.gray2, fontSize: 10 }}>{s.l}</div>
                      <div style={{ color: theme.text, fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {val ?? '—'}<span style={{ color: theme.gray2, fontSize: 10, fontWeight: 400 }}> см</span>
                      </div>
                      {d && (
                        <div style={{ fontSize: 10, fontWeight: 500, color: parseFloat(d) < 0 ? theme.green : parseFloat(d) > 0 ? theme.accent : theme.gray2 }}>
                          {parseFloat(d) > 0 ? '+' : ''}{d}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {/* Full list */}
        <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
          Все замеры
        </div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
          {METRICS.map((m, i) => {
            const val = latest?.[m];
            const d = getDelta(m);
            const c = COLORS[m];
            return (
              <div key={m} onClick={() => val && setDetailMetric(m)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: i < METRICS.length - 1 ? `0.5px solid ${theme.gray5}` : 'none',
                  cursor: val ? 'pointer' : 'default' }}>
                <div style={{ width: 6, height: 28, borderRadius: 3, background: c }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: theme.text, fontSize: 14, fontWeight: 500 }}>{LABELS[m]}</div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: val ? theme.text : theme.gray3, fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {val ?? '—'}
                    </span>
                    <span style={{ color: theme.gray2, fontSize: 12, marginLeft: 2 }}>см</span>
                  </div>
                  {d && (
                    <div style={{ fontSize: 12, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: parseFloat(d) < 0 ? theme.green : d === '0.0' ? theme.gray2 : theme.accent,
                      minWidth: 32, textAlign: 'right' }}>
                      {d === '0.0' ? '=' : `${parseFloat(d) > 0 ? '+' : ''}${d}`}
                    </div>
                  )}
                  {val && <span style={{ color: theme.gray3, fontSize: 14 }}>→</span>}
                </div>
              </div>
            );
          })}
        </Card>

        {/* Add buttons */}
        <div className="flex gap-2">
          <button onClick={() => setShowForm(true)}
            className="flex-1 flex items-center justify-center gap-1.5" style={{ paddingTop: 12, paddingBottom: 12, borderRadius: 12, background: theme.accent + '10' }}>
            <span style={{ fontSize: 14 }}>📏</span>
            <span style={{ color: theme.accent, fontSize: 14, fontWeight: 500 }}>Записать</span>
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <Card theme={theme}>
            <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: 12 }}>
              Новый замер
            </div>
            <div className="space-y-2">
              {METRICS.map(m => (
                <div key={m} style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 16, borderRadius: 3, background: COLORS[m], flexShrink: 0 }} />
                  <span style={{ width: 96, color: theme.gray1, fontSize: 14, flexShrink: 0 }}>{LABELS[m]}</span>
                  <div className="flex items-center flex-1" style={{ background: theme.gray6, borderRadius: 12, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={form[m] || ''}
                      onChange={e => setForm({ ...form, [m]: e.target.value })}
                      placeholder={latest?.[m] ? String(latest[m]) : '—'}
                      className="flex-1 bg-transparent outline-none" style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: theme.text }}
                    />
                    <span style={{ color: theme.gray3, fontSize: 12, marginLeft: 4 }}>см</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2" style={{ marginTop: 12 }}>
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5" style={{ borderRadius: 12, fontSize: 14, fontWeight: 500, background: theme.gray5, color: theme.text }}>
                Отмена
              </button>
              <button onClick={handleSave}
                className="flex-1 py-2.5" style={{ borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff', background: theme.accent }}>
                Сохранить
              </button>
            </div>
          </Card>
        )}

        {/* AI insight */}
        {latest && prev && (() => {
          const waistD = getDelta('waist');
          const bicepsD = getDelta('biceps_r') || getDelta('biceps_l');
          if (!waistD && !bicepsD) return null;
          const parts = [];
          if (waistD && parseFloat(waistD) < 0) parts.push(`Талия ${waistD} см`);
          if (bicepsD && parseFloat(bicepsD) > 0) parts.push(`бицепс +${bicepsD} см`);
          if (parts.length === 0) return null;
          return (
            <Card theme={theme} style={{ background: (theme.purple || '#AF52DE') + '06' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 12 }}>🤖</span>
                <span style={{ color: theme.purple || '#AF52DE', fontSize: 12, fontWeight: 600 }}>AI-анализ</span>
              </div>
              <div style={{ color: theme.gray1, fontSize: 13, lineHeight: '18px' }}>
                {parts.join(' при росте ')} — хороший признак рекомпозиции. Продолжайте текущий режим.
              </div>
            </Card>
          );
        })()}
      </div>
    </ScreenWrapper>
  );
}
