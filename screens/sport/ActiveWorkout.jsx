import { useState, useEffect, useRef, useCallback } from 'react';
import Card from '../../components/Card';
import ProgressBar from '../../components/ProgressBar';
import ActionSheet from '../../components/ActionSheet';
import { addSet, addExerciseToWorkout, removeSet, finishWorkout, getLastWorkoutForExercise, detectPR } from '../../services/workouts';
import Ic from '../../components/Icon';

const REST_OPTIONS = [60, 90, 120, 180];

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ActiveWorkout({ workoutId, workout: initialWorkout, theme, onFinish, onCancel, onAddExercise }) {
  const [workout, setWorkout] = useState(initialWorkout);
  const [elapsed, setElapsed] = useState(0);
  const [restTime, setRestTime] = useState(0);
  const [restDuration, setRestDuration] = useState(90);
  const [isResting, setIsResting] = useState(false);
  const [activeExIdx, setActiveExIdx] = useState(0);
  const [inputWeight, setInputWeight] = useState('');
  const [inputReps, setInputReps] = useState('');
  /* D1.5: cardio inputs */
  const [inputDistance, setInputDistance] = useState('');
  const [inputDuration, setInputDuration] = useState('');
  const [lastData, setLastData] = useState({}); // { exerciseId: { sets: [...] } }
  const [prFlags, setPrFlags] = useState({}); // { exerciseId: true }
  const [completedSets, setCompletedSets] = useState(new Set());
  const [exNotes, setExNotes] = useState({}); // { exIdx: 'text' }
  const [exRestTimers, setExRestTimers] = useState({}); // { exIdx: seconds }
  const [showCardioSheet, setShowCardioSheet] = useState(false);
  const wakeLockRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  // Wake Lock
  useEffect(() => {
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch (e) { /* ignore */ }
    };
    acquire();
    const handler = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', handler);
    return () => {
      wakeLockRef.current?.release();
      document.removeEventListener('visibilitychange', handler);
    };
  }, []);

  // Main timer
  useEffect(() => {
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Rest timer
  useEffect(() => {
    if (!isResting) return;
    if (restTime <= 0) {
      setIsResting(false);
      try { navigator.vibrate?.(200); } catch (e) { /* ignore */ }
      return;
    }
    const iv = setInterval(() => setRestTime(prev => prev - 1), 1000);
    return () => clearInterval(iv);
  }, [isResting, restTime]);

  // Load "last time" data for exercises
  useEffect(() => {
    if (!workout?.exercises) return;
    workout.exercises.forEach(async (ex) => {
      if (lastData[ex.exercise_id]) return;
      const last = await getLastWorkoutForExercise(ex.exercise_id);
      if (last) {
        setLastData(prev => ({ ...prev, [ex.exercise_id]: last }));
        // Prefill input from last workout
        if (last.sets.length > 0 && !inputWeight) {
          setInputWeight(String(last.sets[0].weight));
          setInputReps(String(last.sets[0].reps));
        }
      }
    });
  }, [workout?.exercises]);

  const refreshWorkout = useCallback(async () => {
    const { getWorkout } = await import('../../services/workouts');
    const w = await getWorkout(workoutId);
    setWorkout(w);
  }, [workoutId]);

  const handleAddSet = async (exIdx) => {
    const ex = workout.exercises[exIdx];
    /* D1.5: cardio mode */
    if (ex.type === 'cardio') {
      if (!inputDistance && !inputDuration) return;
      await addSet(workoutId, exIdx, {
        distance_km: parseFloat(inputDistance) || 0,
        time_min: parseFloat(inputDuration) || 0,
        pace: (parseFloat(inputDuration) || 0) / (parseFloat(inputDistance) || 1),
      });
      await refreshWorkout();
      return;
    }
    if (!inputWeight || !inputReps) return;
    const weight = parseFloat(inputWeight);
    const reps = parseInt(inputReps);

    await addSet(workoutId, exIdx, { weight, reps, isWarmup: false });

    // Check PR
    const isPR = await detectPR(ex.exercise_id, weight);
    if (isPR) setPrFlags(prev => ({ ...prev, [ex.exercise_id]: true }));

    await refreshWorkout();

    // D1.1: If in a superset, skip to partner instead of resting
    const currentEx = workout.exercises[exIdx];
    if (currentEx?.supersetGroup) {
      const partnerIdx = exercises.findIndex((e, i) =>
        i !== exIdx && e.supersetGroup === currentEx.supersetGroup
      );
      if (partnerIdx >= 0) {
        switchExercise(partnerIdx);
        return; // Skip rest timer
      }
    }

    // Start rest timer (per-exercise or global)
    const exRest = exRestTimers[exIdx];
    const duration = exRest || restDuration;
    setIsResting(true);
    setRestTime(duration);
    setRestDuration(duration);

    // Prefill from last data for next set (keep same weight/reps)
  };

  const handleRemoveSet = async (exIdx, setIdx) => {
    await removeSet(workoutId, exIdx, setIdx);
    await refreshWorkout();
  };

  const handleFinish = async () => {
    const result = await finishWorkout(workoutId);
    onFinish(result);
  };

  const skipRest = () => {
    setIsResting(false);
    setRestTime(0);
  };

  // When switching active exercise, prefill from last data
  const switchExercise = (idx) => {
    setActiveExIdx(idx);
    const ex = workout?.exercises[idx];
    if (ex) {
      const last = lastData[ex.exercise_id];
      const currentSetCount = ex.sets?.length || 0;
      if (last?.sets[currentSetCount]) {
        setInputWeight(String(last.sets[currentSetCount].weight));
        setInputReps(String(last.sets[currentSetCount].reps));
      } else if (last?.sets[0]) {
        setInputWeight(String(last.sets[0].weight));
        setInputReps(String(last.sets[0].reps));
      } else {
        setInputWeight('');
        setInputReps('');
      }
    }
  };

  if (!workout) return null;

  const exercises = workout.exercises || [];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      {/* Header — proto S2 */}
      <div style={{ padding: '6px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onCancel} style={{ color: theme.red, fontSize: 15, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
          Завершить
        </button>
        <span style={{ fontSize: 17, fontWeight: 600, color: theme.text }}>
          Тренировка
        </span>
        <span style={{ fontSize: 17, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>
          {formatTimer(elapsed)}
        </span>
      </div>

      {/* Workout name — proto S2 */}
      <div style={{ padding: '0 16px 6px' }}>
        <span style={{ fontSize: 14, color: theme.gray1 }}>{workout.name}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
        {exercises.map((ex, exIdx) => {
          const isActive = exIdx === activeExIdx;
          const isDone = ex.sets?.length >= (ex.target_sets || 3);
          const last = lastData[ex.exercise_id];
          const hasPR = prFlags[ex.exercise_id];
          /* D1.1: superset indicator */
          const nextEx = exercises[exIdx + 1];
          const isSuperset = ex.superset_group && nextEx?.superset_group === ex.superset_group;
          const supersetStart = ex.superset_group && (!exercises[exIdx - 1]?.superset_group || exercises[exIdx - 1]?.superset_group !== ex.superset_group);

          return (
            <div key={exIdx}>
              {/* D1.1: Superset header */}
              {supersetStart && (
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span style={{ color: theme.orange, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ic name="repeat" color={theme.orange} size={14} r={3} raw /> Суперсет</span>
                  <div className="flex-1 h-px" style={{ background: theme.orange + '40' }} />
                </div>
              )}
              <Card
                theme={theme}
                onClick={() => !isActive && switchExercise(exIdx)}
                style={{
                  cursor: isActive ? 'default' : 'pointer',
                  border: isActive ? '2px solid ' + theme.accent + '20' : 'none',
                  marginBottom: 8,
                  padding: 14,
                }}
              >
              {/* Exercise header — proto S2: icon 24 r7, gap:8 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isActive ? 10 : 8, cursor: 'pointer' }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, background: isDone ? (theme.green || '#34C759') : isActive ? theme.accent : theme.gray3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isDone ? <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span> : <Ic name="gym" color="transparent" size={16} r={4} raw />}
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: theme.text, flex: 1 }}>
                  {ex.name}
                </span>
                {isDone && <span style={{ fontSize: 11, color: theme.green || '#34C759', fontWeight: 600, marginLeft: 'auto' }}>✓ Готово</span>}
                {isActive && !isDone && <span style={{ fontSize: 11, color: theme.accent, fontWeight: 500, marginLeft: 'auto' }}>Текущее</span>}
                {hasPR && <span style={{ fontSize: 11, color: theme.green || '#34C759', fontWeight: 600, marginLeft: 4, display: 'inline-flex', alignItems: 'center', gap: 2 }}><Ic name="star" color={theme.green || '#34C759'} size={12} r={3} raw /> PR</span>}
              </div>

              {/* Completed sets — proto S2 */}
              {ex.sets?.map((s, si) => (
                <div key={si} style={{ display: 'flex', alignItems: 'center', padding: '5px 0', fontSize: 13, color: theme.gray1 }}>
                  <span style={{ width: 60 }}>{ex.type === 'cardio' ? `Заход ${si + 1}` : `Подход ${si + 1}`}</span>
                  <span style={{ flex: 1, fontWeight: 500, color: theme.text }}>
                    {s.distance_km != null
                      ? `${s.distance_km} км · ${s.time_min} мин`
                      : `${s.weight} кг × ${s.reps}`
                    }
                  </span>
                  <span style={{ color: theme.green || '#34C759' }}>✓</span>
                  {isActive && (
                    <button onClick={(e) => { e.stopPropagation(); handleRemoveSet(exIdx, si); }}
                      style={{ fontSize: 12, color: theme.red, marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  )}
                </div>
              ))}

              {/* Input row — proto S2: #N w:40, weight w:56, reps w:40, check 24×24 r12 */}
              {isActive && !isDone && ex.type === 'cardio' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0' }}>
                  <span style={{ width: 40, fontSize: 13, color: theme.gray1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic name="flame" color={theme.orange} size={18} r={4} raw /></span>
                  <input type="number" inputMode="decimal" placeholder="км" value={inputDistance}
                    onChange={e => setInputDistance(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{ width: 56, padding: '6px 8px', background: theme.card, borderRadius: 8, border: '1px solid ' + (theme.gray4 || '#D1D1D6'), fontSize: 14, textAlign: 'center', color: inputDistance ? theme.text : theme.gray3, outline: 'none' }} />
                  <span style={{ fontSize: 12, color: theme.gray2 }}>·</span>
                  <input type="number" inputMode="numeric" placeholder="мин" value={inputDuration}
                    onChange={e => setInputDuration(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{ width: 40, padding: '6px 8px', background: theme.card, borderRadius: 8, border: '1px solid ' + (theme.gray4 || '#D1D1D6'), fontSize: 14, textAlign: 'center', color: inputDuration ? theme.text : theme.gray3, outline: 'none' }} />
                  <div onClick={(e) => { e.stopPropagation(); handleAddSet(exIdx); }}
                    style={{ width: 24, height: 24, borderRadius: 12, background: theme.green || '#34C759', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>
                  </div>
                </div>
              ) : isActive && !isDone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0' }}>
                  <span style={{ width: 40, fontSize: 13, color: theme.gray1 }}>{'#' + ((ex.sets?.length || 0) + 1)}</span>
                  <input type="number" inputMode="decimal" placeholder="кг" value={inputWeight}
                    onChange={e => setInputWeight(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{ width: 56, padding: '6px 8px', background: theme.card, borderRadius: 8, border: '1px solid ' + (theme.gray4 || '#D1D1D6'), fontSize: 14, textAlign: 'center', color: inputWeight ? theme.text : theme.gray3, outline: 'none' }} />
                  <span style={{ fontSize: 12, color: theme.gray2 }}>×</span>
                  <input type="number" inputMode="numeric" placeholder="повт" value={inputReps}
                    onChange={e => setInputReps(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{ width: 40, padding: '6px 8px', background: theme.card, borderRadius: 8, border: '1px solid ' + (theme.gray4 || '#D1D1D6'), fontSize: 14, textAlign: 'center', color: inputReps ? theme.text : theme.gray3, outline: 'none' }} />
                  <div onClick={(e) => { e.stopPropagation(); handleAddSet(exIdx); }}
                    style={{ width: 24, height: 24, borderRadius: 12, background: theme.card, border: '2px solid ' + (theme.gray3 || '#C7C7CC'), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  </div>
                </div>
              )}

              {/* Last time reference — proto S2 */}
              {last && (
                <div style={{ fontSize: 12, color: theme.gray2, marginTop: 4 }}>
                  Прошлый: {last.sets.map(s => `${s.weight} кг × ${s.reps}`).join(', ')}
                  {last.sets.length > 0 && (() => {
                    const currentBest = ex.sets?.length > 0 ? Math.max(...ex.sets.filter(s => s.weight).map(s => s.weight)) : 0;
                    const lastBest = Math.max(...last.sets.map(s => s.weight));
                    const diff = currentBest - lastBest;
                    if (diff > 0) return <span style={{ color: theme.green || '#34C759' }}>{` · +${diff} кг`}</span>;
                    return null;
                  })()}
                </div>
              )}

              {/* + Подход — proto S2 */}
              {isActive && !isDone && (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <span style={{ color: theme.accent, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ Подход</span>
                </div>
              )}

              {/* Per-exercise settings (active only) */}
              {isActive && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `0.5px solid ${theme.gray5}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, flexShrink: 0, color: theme.gray2 }}>⏱ Отдых:</span>
                    {REST_OPTIONS.map(sec => (
                      <button key={sec}
                        onClick={(e) => { e.stopPropagation(); setExRestTimers(prev => ({ ...prev, [exIdx]: sec })); }}
                        style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, border: 'none', cursor: 'pointer',
                          background: (exRestTimers[exIdx] || restDuration) === sec ? theme.accent : (theme.gray6 || '#F2F2F7'),
                          color: (exRestTimers[exIdx] || restDuration) === sec ? '#fff' : theme.gray1 }}
                      >{sec}с</button>
                    ))}
                  </div>
                  <input type="text" placeholder="Заметка к упражнению..."
                    value={exNotes[exIdx] || ''}
                    onChange={(e) => setExNotes(prev => ({ ...prev, [exIdx]: e.target.value }))}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: '100%', marginTop: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, border: 'none', outline: 'none', background: theme.gray6 || '#F2F2F7', color: theme.text }} />
                </div>
              )}
            </Card>
            </div>
          );
        })}

        {/* Add exercise */}
        <div className="flex gap-2">
          <button
            onClick={onAddExercise}
            className="flex-1 py-3 rounded-xl" style={{ fontSize: 14, fontWeight: 500, background: theme.card, color: theme.accent, border: `1px dashed ${theme.gray4}` }}
          >
            ＋ Силовое
          </button>
          {/* D1.5: Cardio exercise */}
          <button
            onClick={() => setShowCardioSheet(true)}
            className="flex-1 py-3 rounded-xl" style={{ fontSize: 14, fontWeight: 500, background: theme.card, color: theme.orange, border: `1px dashed ${theme.gray4}` }}
          >
            <Ic name="flame" color={theme.orange} size={16} r={4} raw /> Кардио
          </button>
        </div>
        {/* D1.1: Link as superset */}
        {exercises.length >= 2 && (
          <button
            onClick={() => {
              const last2 = exercises.slice(-2);
              const group = `ss_${Date.now()}`;
              last2.forEach((ex, i) => { exercises[exercises.length - 2 + i].superset_group = group; });
              refreshWorkout();
            }}
            className="w-full py-2 rounded-xl" style={{ fontSize: 12, fontWeight: 500, color: theme.orange, background: theme.orange + '10' }}
          >
            <Ic name="repeat" color={theme.orange} size={14} r={3} raw /> Объединить последние 2 в суперсет
          </button>
        )}

        {/* Rest timer */}
        {isResting && (
          <Card theme={theme} style={{ background: theme.orange + '08' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: theme.orange, fontWeight: 600 }}>
                ОТДЫХ
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, color: theme.text, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                {formatTimer(restTime)}
              </div>
              <div style={{ marginTop: 6 }}>
                <ProgressBar value={restDuration - restTime} max={restDuration} color={theme.orange} height={5} theme={theme} />
              </div>
              <div className="flex items-center justify-center gap-3 mt-3">
                {REST_OPTIONS.map(sec => (
                  <button
                    key={sec}
                    onClick={() => { setRestDuration(sec); setRestTime(sec); }}
                    className="px-2 py-1 rounded" style={{ fontSize: 12, background: restDuration === sec ? theme.accent : theme.gray5, color: restDuration === sec ? '#fff' : theme.text }}
                  >
                    {sec}с
                  </button>
                ))}
              </div>
              <button onClick={skipRest} style={{ fontSize: 13, fontWeight: 500, color: theme.accent, marginTop: 8, background: 'none', border: 'none', cursor: 'pointer' }}>
                Пропустить
              </button>
            </div>
          </Card>
        )}

        {/* Finish — proto S2 */}
        <div onClick={handleFinish}
          style={{ padding: 14, background: theme.red, borderRadius: 14, textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
          Завершить тренировку
        </div>
      </div>

      <ActionSheet
        open={showCardioSheet}
        onClose={() => setShowCardioSheet(false)}
        title="Тип кардио"
        theme={theme}
        actions={[
          { icon: <Ic name="flame" color={theme.accent} size={20} r={5} raw />, label: 'Бег', onClick: () => addExerciseToWorkout(workoutId, { name: '🏃 Бег', type: 'cardio', target_sets: 1 }).then(refreshWorkout) },
          { icon: <Ic name="transport" color={theme.accent} size={20} r={5} raw />, label: 'Велосипед', onClick: () => addExerciseToWorkout(workoutId, { name: '🚴 Велосипед', type: 'cardio', target_sets: 1 }).then(refreshWorkout) },
          { icon: <Ic name="drop" color={theme.accent} size={20} r={5} raw />, label: 'Плавание', onClick: () => addExerciseToWorkout(workoutId, { name: '🏊 Плавание', type: 'cardio', target_sets: 1 }).then(refreshWorkout) },
          { icon: <Ic name="gym" color={theme.accent} size={20} r={5} raw />, label: 'Ходьба', onClick: () => addExerciseToWorkout(workoutId, { name: '🚶 Ходьба', type: 'cardio', target_sets: 1 }).then(refreshWorkout) },
          { icon: <Ic name="clock" color={theme.accent} size={20} r={5} raw />, label: 'Скакалка', onClick: () => addExerciseToWorkout(workoutId, { name: '⏱ Скакалка', type: 'cardio', target_sets: 1 }).then(refreshWorkout) },
        ]}
      />
    </div>
  );
}
