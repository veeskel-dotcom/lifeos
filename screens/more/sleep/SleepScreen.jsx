import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer,
  ReferenceLine, LineChart, Line, Tooltip,
} from 'recharts';
import Card from '../../../components/Card';
import NavHeader from '../../../components/NavHeader';
import EmptyState from '../../../components/EmptyState';
import ProgressBar from '../../../components/ProgressBar';
import SkeletonCard from '../../../components/SkeletonCard';
import {
  getWeekData, getSleep, getTrend, getMonthData,
  getSleepTrend, getSleepAverage, getBedtimeRecommendation,
} from '../../../services/sleep';
import { getSetting } from '../../../db/helpers';
import Ic from '../../../components/Icon';

/* ── Helpers ── */

function fmtD(h) {
  if (h == null || h === 0) return '—';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}ч ${mins}м` : `${hrs}ч`;
}

function durationColor(hours, theme) {
  if (hours == null || hours === 0) return theme.gray3;
  if (hours < 6) return theme.red;
  if (hours < 7) return theme.orange;
  return theme.green;
}

/* ── Component ── */

export default function SleepScreen({ theme, onBack, onAdd }) {
  const [weekData, setWeekData] = useState(undefined);
  const [lastNight, setLastNight] = useState(null);
  const [trend, setTrend] = useState(null);
  const [monthData, setMonthData] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [sleepTarget, setSleepTarget] = useState(7);
  const [voiceOverlay, setVoiceOverlay] = useState(false);

  /* H1 — 30-day trend data */
  const [sleepTrend, setSleepTrend] = useState([]);
  /* H2 — average vs goal */
  const [sleepAvg, setSleepAvg] = useState(null);
  /* H3 — bedtime recommendation */
  const [bedtimeRec, setBedtimeRec] = useState(null);

  useEffect(() => {
    getSetting('sleep_target_hours').then(v => { if (v) setSleepTarget(v); });
  }, []);

  const load = useCallback(async () => {
    const [wd, tr, md, st, sa, br] = await Promise.all([
      getWeekData(),
      getTrend(),
      getMonthData(),
      getSleepTrend(30),
      getSleepAverage(7),
      getBedtimeRecommendation(),
    ]);
    setWeekData(wd);
    setTrend(tr);
    setMonthData(md);
    setSleepTrend(st);
    setSleepAvg(sa);
    setBedtimeRec(br);

    const y = new Date();
    y.setDate(y.getDate() - 1);
    setLastNight(
      await getSleep(y.toISOString().slice(0, 10)) ||
      await getSleep(new Date().toISOString().slice(0, 10))
    );
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasSleepData = weekData && weekData.some(d => d.duration > 0);

  /* ── Loading state ── */
  if (!loaded) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
        <NavHeader title="Сон" onBack={onBack} left theme={theme} />
        <div className="flex-1 px-4 pt-2 space-y-3">
          <SkeletonCard theme={theme} />
          <SkeletonCard variant="chart" theme={theme} />
          <SkeletonCard variant="compact" theme={theme} />
        </div>
      </div>
    );
  }

  /* ── Empty state ── */
  if (loaded && !hasSleepData && !lastNight) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
        <NavHeader title="Сон" onBack={onBack} left theme={theme} />
        <div className="flex-1 flex items-center justify-center px-4">
          <EmptyState
            iconName="sleep" iconColor={theme.purple || '#AF52DE'}
            title="Нет данных о сне"
            subtitle="Добавьте первую запись"
            tip="Отслеживайте качество сна — влияет на всё остальное"
            actionLabel="Добавить"
            onAction={onAdd}
            theme={theme}
          />
        </div>
      </div>
    );
  }

  /* ── Derived ── */
  const weekWithData = weekData?.filter(d => d.duration > 0) || [];
  const avg = weekWithData.length > 0
    ? weekWithData.reduce((s, d) => s + d.duration, 0) / weekWithData.length
    : 0;
  const debt = weekWithData.length > 0
    ? weekWithData.reduce((s, d) => s + Math.max(0, sleepTarget - d.duration), 0)
    : 0;

  /* H2 — ProgressBar color */
  const avgRatio = sleepAvg ? (sleepAvg.average / sleepAvg.goal) : 0;
  const avgBarColor = avgRatio >= 0.9 ? theme.green : avgRatio >= 0.75 ? theme.orange : theme.red;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg, position: 'relative' }}>
      <NavHeader
        title="Сон"
        onBack={onBack}
        left
        right={
          <span onClick={onAdd} style={{ cursor: 'pointer', fontSize: 16 }}>＋</span>
        }
        theme={theme}
      />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">

        {/* ── Hero: Last night (proto S2) ── */}
        <Card theme={theme} style={{ textAlign: 'center', padding: 16 }}>
          <div className="flex items-center justify-center">
            <div className="flex items-center justify-center shrink-0" style={{ width: 36, height: 36, borderRadius: 10, background: theme.purple || '#AF52DE' }}>
              <svg width={19} height={19} viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
          <div className="text-xs mt-1.5" style={{ color: theme.gray1 }}>Прошлая ночь</div>
          {lastNight ? (
            <>
              <div className="font-bold mt-1" style={{ color: theme.text, fontSize: 36 }}>
                {fmtD(lastNight.duration_hours)}
              </div>
              <div className="text-sm" style={{ color: theme.gray2 }}>
                {lastNight.bedtime && new Date(lastNight.bedtime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                {lastNight.bedtime && lastNight.waketime && ' → '}
                {lastNight.waketime && new Date(lastNight.waketime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="flex gap-3 justify-center mt-3">
                <div className="text-center">
                  <div className="font-bold" style={{ color: theme.purple || '#AF52DE', fontSize: 16 }}>
                    {lastNight.quality > 0 ? `${lastNight.quality * 10}%` : '—'}
                  </div>
                  <div className="text-[11px]" style={{ color: theme.gray2 }}>Качество</div>
                </div>
                <div className="text-center">
                  <div className="font-bold" style={{ color: theme.text, fontSize: 16 }}>
                    {lastNight.deep_hours ? fmtD(lastNight.deep_hours) : '—'}
                  </div>
                  <div className="text-[11px]" style={{ color: theme.gray2 }}>Глубокий</div>
                </div>
                <div className="text-center">
                  <div className="font-bold" style={{ color: theme.text, fontSize: 16 }}>
                    {lastNight.rem_hours ? fmtD(lastNight.rem_hours) : '—'}
                  </div>
                  <div className="text-[11px]" style={{ color: theme.gray2 }}>REM</div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm mt-2" style={{ color: theme.gray2 }}>Нет данных</div>
          )}
        </Card>

        {/* ── H2 — Average vs Goal (ProgressBar) ── */}
        {sleepAvg && (
          <Card theme={theme}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
                Среднее за 7 дней
              </span>
              <span className="text-xs tabular-nums" style={{ color: theme.gray2 }}>
                {sleepAvg.daysTracked} из {sleepAvg.totalDays} дней
              </span>
            </div>
            <div className="flex items-end gap-3 mb-2">
              <span className="text-2xl font-bold tabular-nums" style={{ color: theme.text }}>
                {sleepAvg.average}ч
              </span>
              <span className="text-sm mb-0.5" style={{ color: theme.gray2 }}>
                / {sleepAvg.goal}ч цель
              </span>
              <span className="text-sm font-semibold mb-0.5 tabular-nums" style={{ color: avgBarColor }}>
                {sleepAvg.diff > 0 ? '+' : ''}{sleepAvg.diff}ч
              </span>
            </div>
            <ProgressBar
              value={sleepAvg.average}
              max={sleepAvg.goal}
              color={avgBarColor}
              height={6}
              theme={theme}
            />
          </Card>
        )}

        {/* ── H3: Bedtime Recommendation ── */}
        {bedtimeRec?.bedtime && (
          <Card theme={theme}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: theme.gray1 }}>
                  <span className="inline-flex items-center gap-1"><Ic name="moon" color={theme.purple || '#AF52DE'} size={14} r={4} raw /> Рекомендация</span>
                </div>
                <div className="text-sm" style={{ color: theme.text }}>
                  Ложись в <span className="font-bold text-base">{bedtimeRec.bedtime}</span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: theme.gray2 }}>
                  Подъём ~{bedtimeRec.wakeAvg} · Цель {bedtimeRec.goalHours}ч сна
                </div>
              </div>
              <Ic name="sleep" color={theme.purple || '#AF52DE'} size={40} r={10} />
            </div>
          </Card>
        )}

        {/* ── Week BarChart ── */}
        {weekData && hasSleepData && (
          <Card theme={theme}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
                Неделя
              </span>
              <span className="text-sm font-medium tabular-nums" style={{ color: theme.text }}>
                {fmtD(avg)} <span style={{ color: theme.gray2, fontWeight: 400 }}>средний</span>
              </span>
            </div>
            <div style={{ width: '100%', height: 140 }}>
              <ResponsiveContainer>
                <BarChart data={weekData} barCategoryGap="20%">
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: theme.gray2 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide domain={[0, 12]} />
                  <ReferenceLine y={sleepTarget} stroke={theme.gray3} strokeDasharray="4 4" />
                  <Bar dataKey="duration" radius={[4, 4, 0, 0]}>
                    {weekData.map((d, i) => (
                      <Cell key={i} fill={durationColor(d.duration, theme)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
        {/* ── W14: Sleep phases ── */}
        {lastNight?.bedtime && lastNight?.waketime && (
          <Card theme={theme}>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
              Фазы сна
            </span>
            <div className="mt-2">
              {/* Phase bar visualization */}
              <div className="flex h-9 rounded-md overflow-hidden gap-px">
                {(lastNight.phases || [
                  { type: 'light', pct: 15 }, { type: 'deep', pct: 20 }, { type: 'light', pct: 10 },
                  { type: 'rem', pct: 25 }, { type: 'light', pct: 8 }, { type: 'deep', pct: 12 },
                  { type: 'light', pct: 10 },
                ]).map((p, i) => (
                  <div key={i} style={{
                    width: `${p.pct}%`,
                    background: p.type === 'deep' ? (theme.purple || '#AF52DE')
                      : p.type === 'rem' ? (theme.purple || '#AF52DE') + '80'
                      : (theme.purple || '#AF52DE') + '30',
                  }} />
                ))}
              </div>
              {/* Time labels */}
              <div className="flex justify-between mt-1 text-[10px]" style={{ color: theme.gray2 }}>
                <span>{new Date(lastNight.bedtime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                <span>{new Date(lastNight.waketime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {/* Legend */}
              <div className="flex gap-3 mt-1.5">
                {[
                  { label: 'Лёгкий', color: (theme.purple || '#AF52DE') + '30' },
                  { label: 'Глубокий', color: theme.purple || '#AF52DE' },
                  { label: 'REM', color: (theme.purple || '#AF52DE') + '80' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                    <span className="text-[11px]" style={{ color: theme.gray2 }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* ── H1 — 30-day LineChart with color dots ── */}
        {sleepTrend.length > 0 && (
          <Card theme={theme}>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
              Тренд (30 дней)
            </span>
            <div className="mt-2" style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer>
                <LineChart data={sleepTrend}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: theme.gray2 }}
                    axisLine={false}
                    tickLine={false}
                    interval={4}
                  />
                  <YAxis hide domain={[0, 12]} />
                  <Tooltip
                    formatter={(v) => v != null ? `${v}ч` : '—'}
                    labelFormatter={(l) => `${l} число`}
                    contentStyle={{ background: theme.card, border: 'none', borderRadius: 8, fontSize: 12, color: theme.text }}
                  />
                  <ReferenceLine
                    y={sleepTarget}
                    stroke={theme.accent}
                    strokeDasharray="4 4"
                    label={{ value: `${sleepTarget}ч`, position: 'right', fontSize: 10, fill: theme.gray2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke={theme.accent}
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (payload.hours == null) return null;
                      return (
                        <circle
                          key={props.key}
                          cx={cx}
                          cy={cy}
                          r={3}
                          fill={durationColor(payload.hours, theme)}
                          stroke="none"
                        />
                      );
                    }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex gap-4 mt-2 text-xs" style={{ color: theme.gray2 }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: theme.red, marginRight: 4 }} />{'<'}6ч</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: theme.orange, marginRight: 4 }} />6–7ч</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: theme.green, marginRight: 4 }} />≥7ч</span>
            </div>
          </Card>
        )}

        {/* ── Trend stats ── */}
        {trend && (
          <Card theme={theme}>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
              Статистика (30 дней)
            </span>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="text-center">
                <div className="text-lg font-bold tabular-nums" style={{ color: theme.text }}>{trend.avgDuration}ч</div>
                <div className="text-xs" style={{ color: theme.gray2 }}>Среднее</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold tabular-nums" style={{ color: theme.text }}>{trend.avgQuality}/10</div>
                <div className="text-xs" style={{ color: theme.gray2 }}>Качество</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold tabular-nums" style={{ color: theme.text }}>{trend.avgBedTime || '—'}</div>
                <div className="text-xs" style={{ color: theme.gray2 }}>Ложитесь</div>
              </div>
            </div>
          </Card>
        )}

        {/* ── Sleep debt ── */}
        {debt > 0 && (
          <Card theme={theme}>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
              Долг сна (7 дней)
            </span>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-2xl font-bold tabular-nums" style={{ color: theme.red }}>
                −{fmtD(debt)}
              </span>
            </div>
            <p className="text-xs mt-2" style={{ color: theme.gray2 }}>
              Недоспали {Math.round(debt * 10) / 10}ч за неделю. Попробуйте лечь раньше.
            </p>
          </Card>
        )}

        {/* ── Записать сон (proto S2) ── */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide px-1" style={{ color: theme.gray1 }}>
            Записать сон
          </span>
          <Card theme={theme} style={{ marginTop: 6, padding: '12px 14px' }}>
            <div className="flex gap-2">
              <button
                onClick={() => setVoiceOverlay(true)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl active:opacity-70"
                style={{ background: (theme.red || '#FF3B30') + '10' }}
              >
                <div className="flex items-center justify-center shrink-0" style={{ width: 24, height: 24, borderRadius: 7, background: theme.red || '#FF3B30' }}>
                  <svg width={13} height={13} viewBox="0 0 24 24"><g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></g></svg>
                </div>
                <span className="text-sm font-medium" style={{ color: theme.red || '#FF3B30' }}>Голосом</span>
              </button>
              <button
                onClick={onAdd}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl active:opacity-70"
                style={{ background: theme.gray5 || '#F2F2F7' }}
              >
                <div className="flex items-center justify-center shrink-0" style={{ width: 24, height: 24, borderRadius: 7, background: theme.purple || '#AF52DE' }}>
                  <svg width={13} height={13} viewBox="0 0 24 24"><g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></g></svg>
                </div>
                <span className="text-sm font-medium" style={{ color: theme.gray1 || '#8E8E93' }}>Вручную</span>
              </button>
            </div>
          </Card>
        </div>

      </div>

      {/* Voice overlay (proto S2) */}
      {voiceOverlay && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Говорите...</div>
          <div style={{ position: 'relative', marginBottom: 24 }}>
            <div style={{ position: 'absolute', inset: -12, borderRadius: 999, background: (theme.red || '#FF3B30') + '20', animation: 'voicePulse 1.5s infinite' }} />
            <div className="flex items-center justify-center"
              style={{ width: 80, height: 80, borderRadius: 40, background: theme.red || '#FF3B30', position: 'relative' }}>
              <svg width={36} height={36} viewBox="0 0 24 24">
                <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0014 0" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                </g>
              </svg>
            </div>
          </div>
          <div style={{ color: '#fff', fontSize: 13, opacity: 0.6, marginBottom: 24 }}>
            «лёг в двенадцать, встал в семь»
          </div>
          <div style={{ width: 280, background: theme.card, borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 6 }}>Распознано:</div>
            <div className="flex justify-between" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 14, color: theme.text }}>Лёг</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>00:00</span>
            </div>
            <div className="flex justify-between" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 14, color: theme.text }}>Встал</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>7:00</span>
            </div>
            <div className="flex justify-between" style={{ borderTop: `0.5px solid ${theme.gray5}`, paddingTop: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 14, color: theme.text }}>Итого</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: theme.purple || '#AF52DE' }}>7ч 00мин</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setVoiceOverlay(false)}
                className="flex-1 py-2.5 rounded-xl text-sm"
                style={{ background: theme.gray5, color: theme.gray1, textAlign: 'center' }}>
                Отмена
              </button>
              <button onClick={() => { setVoiceOverlay(false); onAdd?.(); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: theme.purple || '#AF52DE', textAlign: 'center' }}>
                Сохранить
              </button>
            </div>
          </div>
          <style>{`@keyframes voicePulse { 0%,100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.3); opacity: 0; } }`}</style>
        </div>
      )}
    </div>
  );
}
