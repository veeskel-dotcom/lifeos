import { useState, useEffect } from 'react';
import { useTemplates, useAllWorkouts } from '../../hooks/useDB';
import Card from '../../components/Card';
import { getStats } from '../../services/workouts';
import { getLatest, getTrend, getWeights } from '../../services/bodyweight';
import TutorialTip from '../../components/TutorialTip';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';
import ScreenWrapper from '../../components/ScreenWrapper';
import Ic from '../../components/Icon';

const TYPE_ICONS = { gym: '🏋️', tennis: '🎾', skiing: '⛷', run: '🏃', swim: '🏊', other: '💪' };
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const DAY_LABELS = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// Mini sparkline for weight
function WeightSparkline({ data, theme }) {
  if (!data || data.length < 2) return null;
  const weights = data.map(d => d.weight);
  const min = Math.min(...weights) - 0.5;
  const max = Math.max(...weights) + 0.5;
  const range = max - min || 1;
  const w = 120;
  const h = 30;
  const step = w / (data.length - 1);
  const points = data.map((d, i) => `${i * step},${h - ((d.weight - min) / range) * h}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: 120, height: 30 }}>
      <polyline points={points} fill="none" stroke={theme.accent} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function SportOverview({ theme, onNavigate, onBack, activeWorkoutId }) {
  const [stats, setStats] = useState({ totalWorkouts: 0, streak: 0, thisWeek: 0, avgDuration: 0 });
  const [latestWeight, setLatestWeight] = useState(null);
  const [weightTrend, setWeightTrend] = useState(null);
  const [recentWeights, setRecentWeights] = useState([]);
  const [showStartMenu, setShowStartMenu] = useState(false);

  const templates = useTemplates();
  const allWorkouts = useAllWorkouts();
  const recentWorkouts = allWorkouts
    ? allWorkouts.filter(w => w.status === 'done').slice(0, 5)
    : undefined;

  useEffect(() => {
    getStats().then(setStats);
    getLatest().then(setLatestWeight);
    getWeights(14).then(data => {
      setRecentWeights(data);
      setWeightTrend(getTrend(data));
    });
  }, [recentWorkouts]);

  return (
    <ScreenWrapper theme={theme}>
      {/* Header — proto S1 */}
      <div style={{ padding: '6px 20px 2px' }}>
        {onBack ? (
          <button onClick={onBack} style={{ color: theme.accent, fontSize: 15, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>← Назад</button>
        ) : (
          <>
            <div style={{ fontSize: 28, fontWeight: 700, color: theme.text }}>Спорт</div>
            <div style={{ fontSize: 13, color: theme.gray1 }}>
              {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {/* Active workout banner */}
        {activeWorkoutId && (
          <div
            onClick={() => onNavigate('activeWorkout')}
            className="mb-3 p-3 rounded-2xl flex items-center gap-3 cursor-pointer active:opacity-70"
            style={{ background: theme.red + '15', border: `1px solid ${theme.red}30` }}
          >
            <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: theme.red }} />
            <span className="text-sm font-semibold" style={{ color: theme.red }}>Активная тренировка</span>
            <span className="ml-auto text-xs font-medium" style={{ color: theme.red }}>Продолжить →</span>
          </div>
        )}

        <TutorialTip id="sport_intro" theme={theme} icon={<Ic name="gym" color={theme.red} size={20} r={5} raw />}>
          Создайте шаблон тренировки или начните пустую. Прогресс и рекорды отслеживаются автоматически.
        </TutorialTip>
        {templates === undefined ? (
          <div className="space-y-3">
            <SkeletonCard theme={theme} />
            <SkeletonCard variant="chart" theme={theme} />
            <SkeletonCard variant="compact" theme={theme} />
          </div>
        ) : (
        <>
        {/* Hero CTA — proto S1 */}
        <div style={{ background: 'linear-gradient(135deg, #FF3B30, #FF6B6B)', borderRadius: 16, padding: 16, color: '#fff', cursor: 'pointer' }}
          onClick={() => setShowStartMenu(!showStartMenu)}>
          <div className="flex items-center" style={{ gap: 10 }}>
            <Ic name="gym" color="rgba(255,255,255,0.3)" size={44} r={12} />
            <div className="flex-1">
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {templates?.[0] ? `Сегодня: ${templates[0].name}` : 'Начать тренировку'}
              </div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                {templates?.[0]?.exercises?.length
                  ? `~${templates[0].exercises.length * 10} мин · ${templates[0].exercises.length} упражнений · AI подготовил веса`
                  : 'Выберите шаблон или начните пустую'}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.2)', borderRadius: 10, textAlign: 'center', fontSize: 15, fontWeight: 600 }}>
            Начать тренировку →
          </div>
        </div>

        {/* Quick stats — proto S1 */}
        <div className="flex" style={{ gap: 8, padding: '4px 0 8px' }}>
          {[
            { v: latestWeight ? `${latestWeight.weight}` : '—', l: 'Вес, кг', c: theme.purple || '#AF52DE', d: weightTrend != null ? `${weightTrend > 0 ? '+' : ''}${weightTrend}` : '' },
            { v: String(stats.totalWorkouts), l: 'Тренировок', c: theme.red, d: stats.thisWeek ? `${stats.thisWeek} на неделе` : '' },
            { v: String(stats.avgDuration || '—'), l: 'Мин (ср.)', c: theme.green || '#34C759', d: '' },
          ].map(s => (
            <div key={s.l} className="flex-1" style={{ textAlign: 'center', background: theme.card, borderRadius: 12, padding: '10px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
              <div style={{ fontSize: 11, color: theme.gray2 }}>{s.l}</div>
              {s.d && <div style={{ fontSize: 10, color: s.c, fontWeight: 500 }}>{s.d}</div>}
            </div>
          ))}
        </div>

        {/* Start menu */}
        {showStartMenu && (
          <Card theme={theme}>
            <div className="space-y-2">
              {templates?.length > 0 && (
                <>
                  <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                    Из шаблона
                  </div>
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setShowStartMenu(false); onNavigate('startWorkout', { templateId: t.id }); }}
                      className="w-full text-left py-2 px-3 rounded-xl active:opacity-70" style={{ fontSize: 14, fontWeight: 500, background: theme.gray6, color: theme.text }}
                    >
                      {t.name}
                      {t.day_of_week ? ` (${DAY_LABELS[t.day_of_week]})` : ''}
                    </button>
                  ))}
                  <div className="h-1" />
                </>
              )}
              <button
                onClick={() => { setShowStartMenu(false); onNavigate('startWorkout', {}); }}
                className="w-full text-left py-2 px-3 rounded-xl active:opacity-70" style={{ fontSize: 14, fontWeight: 500, background: theme.gray6, color: theme.text }}
              >
                <Ic name="note" color={theme.text} size={16} r={4} raw /> Пустая тренировка
              </button>
            </div>
          </Card>
        )}

        {/* МОДУЛИ — proto S1 nav rows */}
        <div style={{ padding: '0 0 4px' }}><span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>МОДУЛИ</span></div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
          {[
            { i: 'bot', c: theme.purple || '#AF52DE', n: 'AI-тренер', d: 'Программа, веса, периодизация', t: 'aiTrainer' },
            { i: 'clock', c: theme.accent, n: 'История тренировок', d: `${stats.totalWorkouts} за месяц`, t: 'history' },
            { i: 'trend', c: theme.green || '#34C759', n: 'Прогрессия весов', d: 'Графики и рекорды', t: 'progress' },
            { i: 'weight', c: theme.purple || '#AF52DE', n: 'Вес тела', d: latestWeight ? `${latestWeight.weight} кг` : '— кг', t: 'bodyWeight' },
            { i: 'chart', c: theme.orange, n: 'Обмеры тела', d: '9 параметров', t: 'measurements' },
            { i: 'repeat', c: theme.teal || '#30B0C7', n: 'Шаблоны тренировок', d: `${templates?.length || 0} шаблонов`, t: 'templateList' },
          ].map((item, i, arr) => (
            <div key={item.t} onClick={() => onNavigate(item.t)}
              className="flex items-center cursor-pointer active:opacity-70"
              style={{ gap: 10, padding: '13px 14px', borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
              <Ic name={item.i} color={item.c} size={36} r={10} />
              <div className="flex-1">
                <div style={{ fontSize: 15, fontWeight: 500, color: theme.text }}>{item.n}</div>
                <div style={{ fontSize: 12, color: theme.gray2 }}>{item.d}</div>
              </div>
              <span style={{ color: theme.gray3, fontSize: 16 }}>→</span>
            </div>
          ))}
        </Card>

        {/* ПОСЛЕДНЯЯ ТРЕНИРОВКА — proto S1 */}
        <div>
          <div style={{ padding: '0 0 4px' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>ПОСЛЕДНЯЯ ТРЕНИРОВКА</span>
          </div>
          {(!recentWorkouts || recentWorkouts.length === 0) ? (
            <EmptyState
              icon={<Ic name="gym" color={theme.red} size={48} r={14} />} title="Нет тренировок" subtitle="Тренировок пока нет. Начните первую!"
              tip="Создайте шаблон — тренировка начнётся в 1 тап"
              actionLabel="Начать" onAction={() => setShowStartMenu(true)} theme={theme}
            />
          ) : (() => {
            const w = recentWorkouts[0];
            const d = new Date(w.date + 'T00:00:00');
            return (
              <Card theme={theme} style={{ padding: '12px 14px', cursor: 'pointer' }}
                onClick={() => onNavigate('workoutDetail', { workoutId: w.id })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{w.name}</div>
                    <div style={{ fontSize: 12, color: theme.gray2 }}>
                      {d.getDate()} {MONTHS_SHORT[d.getMonth()]}
                      {w.duration_min ? ` · ${w.duration_min} мин` : ''}
                      {w.sets?.length ? ` · ${w.sets.length} подходов` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>
                    {w.total_tonnage ? `${w.total_tonnage.toLocaleString('ru-RU')} кг` : ''}
                  </div>
                </div>
                {w.exercises_summary?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {w.exercises_summary.slice(0, 4).map(e => (
                      <div key={e} style={{ padding: '3px 8px', borderRadius: 6, background: theme.gray5, fontSize: 11, color: theme.gray2 }}>{e}</div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })()}
        </div>

      </>)}
      </div>
    </ScreenWrapper>
  );
}
