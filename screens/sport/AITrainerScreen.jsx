import { useState, useEffect } from 'react';
import { useLiveQuery } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import SkeletonCard from '../../components/SkeletonCard';
import Ic from '../../components/Icon';
import { useToast } from '../../components/ToastProvider';
import { generateProgram, getTodaySession, getProgressInsights, getSavedProgram } from '../../services/aiTrainer';
import { startWorkout, addExerciseToWorkout, getWorkout } from '../../services/workouts';
import { getExercise } from '../../services/exercises';

const DAYS = [
  { day: 'Понедельник', short: 'Пн' },
  { day: 'Вторник', short: 'Вт' },
  { day: 'Среда', short: 'Ср' },
  { day: 'Четверг', short: 'Чт' },
  { day: 'Пятница', short: 'Пт' },
  { day: 'Суббота', short: 'Сб' },
  { day: 'Воскресенье', short: 'Вс' },
];

function ChipBar({ items, active, onSelect, theme }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '0 16px 10px' }}>
      {items.map(t => (
        <div key={t.key} onClick={() => onSelect(t.key)}
          style={{ flex: 1, padding: '7px 0', borderRadius: 10, textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: active === t.key ? theme.accent : theme.card,
            color: active === t.key ? '#fff' : theme.gray1,
            boxShadow: active === t.key ? 'none' : theme.shadow,
          }}>
          {t.label}
        </div>
      ))}
    </div>
  );
}

/* ═══ Chip selector for SetupSheet ═══ */
function ChipGroup({ options, value, onChange, theme }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => (
        <div key={o.value} onClick={() => onChange(o.value)}
          style={{
            padding: '6px 12px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: value === o.value ? theme.accent + '15' : theme.gray5,
            color: value === o.value ? theme.accent : theme.gray1,
            border: value === o.value ? `1.5px solid ${theme.accent}` : '1.5px solid transparent',
          }}>
          {o.label}
        </div>
      ))}
    </div>
  );
}

/* ═══ SetupSheet — настройка параметров программы ═══ */
function SetupSheet({ theme, onGenerate, onClose, existing }) {
  const [goal, setGoal] = useState(existing?.goal || 'Масса + сила');
  const [split, setSplit] = useState(existing?.split || 'Push / Pull / Legs');
  const [days, setDays] = useState(existing?.daysPerWeek || '4');
  const [experience, setExperience] = useState(existing?.experience || 'Средний');
  const [equipment, setEquipment] = useState(existing?.equipment || 'Полный зал');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await onGenerate({ goal, split, daysPerWeek: parseInt(days), experience, equipment });
      onClose();
    } catch (e) {
      console.error('[SetupSheet]', e);
      // Error handled by parent (toast)
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 448, borderRadius: '16px 16px 0 0', padding: '16px 20px 32px', background: theme.bg, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 9999, margin: '0 auto 16px', background: theme.gray4 }} />
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: theme.text }}>Параметры программы</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray2, marginBottom: 6 }}>ЦЕЛЬ</div>
            <ChipGroup theme={theme} value={goal} onChange={setGoal} options={[
              { value: 'Масса + сила', label: 'Масса + сила' },
              { value: 'Сила', label: 'Сила' },
              { value: 'Гипертрофия', label: 'Гипертрофия' },
              { value: 'Выносливость', label: 'Выносливость' },
            ]} />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray2, marginBottom: 6 }}>СПЛИТ</div>
            <ChipGroup theme={theme} value={split} onChange={setSplit} options={[
              { value: 'Push / Pull / Legs', label: 'PPL' },
              { value: 'Upper / Lower', label: 'Upper-Lower' },
              { value: 'Full Body', label: 'Full Body' },
            ]} />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray2, marginBottom: 6 }}>ДНЕЙ В НЕДЕЛЮ</div>
            <ChipGroup theme={theme} value={days} onChange={setDays} options={[
              { value: '3', label: '3' }, { value: '4', label: '4' },
              { value: '5', label: '5' }, { value: '6', label: '6' },
            ]} />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray2, marginBottom: 6 }}>ОПЫТ</div>
            <ChipGroup theme={theme} value={experience} onChange={setExperience} options={[
              { value: 'Новичок', label: 'Новичок' },
              { value: 'Средний', label: 'Средний' },
              { value: 'Продвинутый', label: 'Продвинутый' },
            ]} />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray2, marginBottom: 6 }}>ОБОРУДОВАНИЕ</div>
            <ChipGroup theme={theme} value={equipment} onChange={setEquipment} options={[
              { value: 'Полный зал', label: 'Полный зал' },
              { value: 'Гантели', label: 'Только гантели' },
              { value: 'Дома', label: 'Дома' },
            ]} />
          </div>
        </div>

        <button onClick={handleGenerate} disabled={loading}
          style={{
            width: '100%', padding: 14, borderRadius: 12, textAlign: 'center', fontSize: 16, fontWeight: 600,
            color: '#fff', border: 'none', cursor: loading ? 'wait' : 'pointer', marginTop: 16,
            background: loading ? theme.gray3 : (theme.purple || '#AF52DE'),
            opacity: loading ? 0.7 : 1,
          }}>
          {loading ? 'Генерирую программу...' : '🤖 Сгенерировать'}
        </button>
        {!loading && (
          <button onClick={onClose}
            style={{ width: '100%', padding: 8, textAlign: 'center', fontSize: 14, marginTop: 8, color: theme.gray2, background: 'none', border: 'none', cursor: 'pointer' }}>
            Отмена
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══ ProgramView ═══ */
function ProgramView({ program, theme, onRegenerate, onEdit, onStartWorkout }) {
  const todayIdx = new Date().getDay(); // 0=Sun
  const todayKey = todayIdx === 0 ? 6 : todayIdx - 1; // 0=Mon

  if (!program || !program.schedule) {
    return (
      <div style={{ padding: '0 16px' }}>
        <EmptyState
          icon={<Ic name="bot" color={theme.purple || '#AF52DE'} size={48} r={14} />}
          title="Нет программы"
          subtitle="AI создаст персональную программу тренировок"
          actionLabel="🤖 Создать программу"
          onAction={onRegenerate}
          theme={theme}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px' }}>
      {/* Current program card */}
      <Card theme={theme} style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: (theme.purple || '#AF52DE') + '15' }}>🤖</div>
          <div>
            <div style={{ color: theme.text, fontSize: 15, fontWeight: 600 }}>Ваша программа</div>
            <div style={{ color: theme.gray2, fontSize: 12 }}>
              Сгенерирована AI · {program.updatedAt || 'нет данных'}
            </div>
          </div>
        </div>

        <div style={{ background: (theme.purple || '#AF52DE') + '08', borderRadius: 10, padding: 12, marginBottom: 8 }}>
          {[
            { label: 'Цель', value: program.goal || 'Не задана' },
            { label: 'Сплит', value: program.split || '—' },
            { label: 'Дней в неделю', value: program.daysPerWeek || '—' },
            { label: 'Фаза', value: program.phase || '—', color: theme.accent },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: theme.gray1, fontSize: 13 }}>{row.label}</span>
              <span style={{ color: row.color || theme.text, fontSize: 13, fontWeight: 600 }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Periodization */}
        {program.totalWeeks && (
          <>
            <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>ПЕРИОДИЗАЦИЯ</div>
            <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
              {Array.from({ length: program.totalWeeks }, (_, i) => (
                <div key={i} style={{ flex: 1, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: i < (program.currentWeek || 0) ? theme.accent : theme.gray4 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: i < (program.currentWeek || 0) ? '#fff' : theme.gray2 }}>{i + 1}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Weekly split */}
      <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em', marginTop: 8, marginBottom: 4 }}>
        Расписание недели
      </div>
      <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
        {(program.schedule || []).map((s, i) => {
          const isToday = i === todayKey;
          const colors = { push: theme.red, pull: theme.accent, legs: theme.purple, upper: theme.orange, lower: theme.green, full: theme.accent, rest: theme.gray3 };
          const barColor = colors[s.type] || theme.gray3;
          return (
            <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                borderBottom: i < 6 ? `0.5px solid ${theme.gray5}` : 'none',
                background: isToday ? theme.accent + '06' : 'transparent',
              }}>
              <div style={{ width: 6, height: 28, borderRadius: 3, background: s.rest ? theme.gray4 : barColor }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: isToday ? 600 : 400, color: theme.text, fontSize: 14 }}>{DAYS[i].day}</span>
                  {isToday && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, color: theme.accent, background: theme.accent + '12' }}>СЕГОДНЯ</span>
                  )}
                </div>
                <div style={{ color: theme.gray2, fontSize: 12 }}>
                  {s.name}{s.exercises > 0 ? ` · ${s.exercises} упр · ${s.duration}` : ` · ${s.duration || 'Восстановление'}`}
                </div>
              </div>
              {s.done && (
                <div style={{ width: 22, height: 22, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.green }}>
                  <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>✓</span>
                </div>
              )}
              {isToday && !s.done && !s.rest && (
                <button style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', background: theme.accent, border: 'none', cursor: 'pointer' }}
                  onClick={onStartWorkout}>Начать</button>
              )}
            </div>
          );
        })}
      </Card>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button style={{ flex: 1, padding: 12, borderRadius: 12, textAlign: 'center', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
          background: (theme.purple || '#AF52DE') + '10', color: theme.purple || '#AF52DE' }} onClick={onRegenerate}>
          🤖 Пересоздать
        </button>
        <button style={{ flex: 1, padding: 12, borderRadius: 12, textAlign: 'center', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
          background: theme.gray5, color: theme.gray1 }} onClick={onEdit}>
          ✏️ Редактировать
        </button>
      </div>

      {/* AI recommendation */}
      {program.aiHint && (
        <div style={{ borderRadius: 12, padding: 12, marginTop: 8, background: (theme.purple || '#AF52DE') + '06', border: '1px solid ' + (theme.purple || '#AF52DE') + '15' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 12 }}>🤖</span>
            <span style={{ color: theme.purple, fontSize: 12, fontWeight: 600 }}>AI рекомендация</span>
          </div>
          <div style={{ color: theme.gray1, fontSize: 13, lineHeight: '18px' }}>{program.aiHint}</div>
        </div>
      )}
    </div>
  );
}

/* ═══ SessionView — сегодняшняя тренировка с прогрессией ═══ */
function SessionView({ program, theme, onStartWorkout }) {
  const [session, setSession] = useState(undefined); // undefined=loading, null=rest, []=no data

  useEffect(() => {
    if (!program?.exercisePlan) { setSession([]); return; }
    getTodaySession(program).then(setSession).catch(() => setSession([]));
  }, [program]);

  if (session === undefined) {
    return (
      <div style={{ padding: '0 16px' }}>
        <SkeletonCard theme={theme} />
        <SkeletonCard variant="compact" theme={theme} />
      </div>
    );
  }

  if (session === null) {
    return (
      <div style={{ padding: '0 16px' }}>
        <EmptyState
          icon="🧘"
          title="Сегодня отдых"
          subtitle="Восстановление важно для прогресса"
          theme={theme}
        />
      </div>
    );
  }

  if (session.length === 0) {
    return (
      <div style={{ padding: '0 16px' }}>
        <EmptyState
          icon={<Ic name="bot" color={theme.purple || '#AF52DE'} size={48} r={14} />}
          title="Нет программы"
          subtitle="Создайте программу во вкладке «Программа»"
          theme={theme}
        />
      </div>
    );
  }

  const HINT_COLORS = { up: theme.green, keep: theme.orange, down: theme.red };

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ background: theme.accent + '08', borderRadius: 12, padding: 12, marginBottom: 8 }}>
        <div style={{ color: theme.accent, fontSize: 14, fontWeight: 600 }}>Progressive Overload</div>
        <div style={{ color: theme.gray2, fontSize: 12, marginTop: 4 }}>
          AI анализирует ваш прогресс и предлагает целевые показатели
        </div>
      </div>

      {session.map((ex, i) => (
        <Card key={i} theme={theme} style={{ padding: '12px 14px' }}>
          <div style={{ color: theme.text, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{ex.name}</div>
          {ex.last && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: theme.gray2, fontSize: 12 }}>Прошлый раз</span>
              <span style={{ color: theme.gray1, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{ex.last}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: ex.hint ? 6 : 0 }}>
            <span style={{ color: theme.accent, fontSize: 12, fontWeight: 500 }}>Цель сегодня</span>
            <span style={{ color: theme.accent, fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {ex.target || `${ex.targetSets}×${ex.targetReps}`}
            </span>
          </div>
          {ex.hint && (
            <div style={{ color: HINT_COLORS[ex.hintType] || theme.green, fontSize: 12 }}>
              💡 {ex.hint}
            </div>
          )}
        </Card>
      ))}

      <button onClick={onStartWorkout}
        style={{
          width: '100%', padding: 14, borderRadius: 12, textAlign: 'center', fontSize: 16, fontWeight: 600,
          color: '#fff', border: 'none', cursor: 'pointer', marginTop: 8,
          background: theme.accent,
        }}>
        Начать тренировку
      </button>
    </div>
  );
}

/* ═══ HintsView — тренды + статические советы ═══ */
function HintsView({ theme }) {
  const [insights, setInsights] = useState(undefined);

  useEffect(() => {
    getProgressInsights().then(setInsights).catch(() => setInsights([]));
  }, []);

  const tips = [
    { icon: '🎯', title: 'Техника жима', text: 'Сведи лопатки, упрись ногами. Снаряд опускай до груди, не отбивай.' },
    { icon: '⏱', title: 'Отдых между подходами', text: 'Базовые: 2-3 мин. Изолирующие: 60-90 сек. Не больше 5 мин.' },
    { icon: '🍗', title: 'Питание после', text: 'В течение 2ч: 30-40г белка + быстрые углеводы для восстановления.' },
    { icon: '😴', title: 'Восстановление', text: 'Минимум 7ч сна. Мышцы растут во время отдыха, не в зале.' },
  ];

  const DIRECTION_ICONS = { up: '↑', flat: '→', down: '↓' };
  const DIRECTION_COLORS = { up: theme.green, flat: theme.orange, down: theme.red };

  return (
    <div style={{ padding: '0 16px' }}>
      {/* Data-driven insights */}
      {insights === undefined ? (
        <SkeletonCard theme={theme} />
      ) : insights.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1, marginBottom: 6 }}>ПРОГРЕССИЯ ВЕСОВ</div>
          {insights.map((ins, i) => (
            <Card key={i} theme={theme} style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{ins.name}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: DIRECTION_COLORS[ins.direction] }}>
                  {ins.currentWeight} кг {DIRECTION_ICONS[ins.direction]}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {ins.weights.map((w, j) => (
                  <span key={j} style={{ fontSize: 11, color: j === ins.weights.length - 1 ? theme.text : theme.gray2 }}>
                    {w}{j < ins.weights.length - 1 ? ' →' : ''}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: DIRECTION_COLORS[ins.direction] }}>
                🤖 {ins.hint}
              </div>
            </Card>
          ))}
          <div style={{ height: 8 }} />
        </>
      )}

      {/* Static tips */}
      <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1, marginBottom: 6 }}>СОВЕТЫ</div>
      {tips.map((tip, i) => (
        <Card key={i} theme={theme} style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 18, marginTop: 2 }}>{tip.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: theme.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{tip.title}</div>
              <div style={{ color: theme.gray1, fontSize: 13, lineHeight: '18px' }}>{tip.text}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ═══ Main Component ═══ */
export default function AITrainerScreen({ theme, onBack, onStartWorkout }) {
  const [tab, setTab] = useState('program');
  const [showSetup, setShowSetup] = useState(false);
  const { showToast } = useToast();

  // Load saved program
  const program = useLiveQuery(async () => {
    return getSavedProgram();
  });

  const handleGenerate = async (params) => {
    try {
      await generateProgram(params);
      showToast('Программа создана!');
    } catch (e) {
      console.error('[AITrainer] generate error:', e);
      const msg = e.message === 'AI_PARSE_ERROR' ? 'AI вернул некорректный ответ. Попробуйте ещё раз.'
        : e.message?.startsWith('LIMIT_REACHED') ? 'Достигнут лимит AI. Попробуйте позже.'
        : 'Не удалось сгенерировать. Попробуйте ещё раз.';
      showToast(msg);
      throw e; // re-throw so SetupSheet knows
    }
  };

  const handleStartFromProgram = async () => {
    if (!program?.exercisePlan) { onStartWorkout?.(); return; }

    const todayIdx = new Date().getDay();
    const dayKey = String(todayIdx === 0 ? 6 : todayIdx - 1);
    const dayPlan = program.exercisePlan[dayKey];

    if (!dayPlan || dayPlan.length === 0) {
      onStartWorkout?.();
      return;
    }

    let workoutId;
    try {
      workoutId = await startWorkout(null);
      for (const item of dayPlan) {
        const exId = typeof item.exerciseId === 'string' ? parseInt(item.exerciseId, 10) : item.exerciseId;
        const ex = await getExercise(exId);
        if (ex) {
          await addExerciseToWorkout(workoutId, { id: ex.id, name: ex.name });
        }
      }
      onStartWorkout?.(workoutId);
    } catch (e) {
      console.error('[AITrainer] start workout error:', e);
      // If workout was created but exercises failed, use partial workout
      if (workoutId) {
        onStartWorkout?.(workoutId);
      } else {
        onStartWorkout?.();
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="AI-тренер" onBack={onBack} theme={theme} />

      <ChipBar
        items={[
          { key: 'program', label: 'Программа' },
          { key: 'session', label: 'Тренировка' },
          { key: 'hint', label: 'Подсказки' },
        ]}
        active={tab}
        onSelect={setTab}
        theme={theme}
      />

      <div className="flex-1 overflow-y-auto pb-24">
        {tab === 'program' && (
          <ProgramView
            program={program}
            theme={theme}
            onStartWorkout={handleStartFromProgram}
            onRegenerate={() => setShowSetup(true)}
            onEdit={() => setShowSetup(true)}
          />
        )}
        {tab === 'session' && (
          <SessionView program={program} theme={theme} onStartWorkout={handleStartFromProgram} />
        )}
        {tab === 'hint' && <HintsView theme={theme} />}
      </div>

      {showSetup && (
        <SetupSheet
          theme={theme}
          existing={program}
          onGenerate={handleGenerate}
          onClose={() => setShowSetup(false)}
        />
      )}
    </div>
  );
}
