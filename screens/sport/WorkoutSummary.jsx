import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import { calculate1RM, getExerciseHistory, getAllWorkouts, updateWorkoutMeta } from '../../services/workouts';
import { shareText } from '../../utils/share';
import ScreenWrapper from '../../components/ScreenWrapper';

export default function WorkoutSummary({ workout, theme, onDone }) {
  if (!workout) return null;

  const exercises = workout.exercises || [];
  const [prs, setPrs] = useState([]);
  const [comparison, setComparison] = useState(null);

  // Detect PRs and find prev workout for comparison
  useEffect(() => {
    (async () => {
      const detectedPrs = [];
      let prevWorkout = null;
      try {
        const allWorkouts = await getAllWorkouts();
        const history = allWorkouts.filter(w => w.id !== workout.id && w.status === 'done');

        // Find most recent previous workout with same name
        prevWorkout = history.find(w => w.name === workout.name) || null;

        for (const ex of exercises) {
          const maxWeight = Math.max(...(ex.sets || []).map(s => s.weight || 0), 0);
          const max1RM = Math.max(...(ex.sets || []).map(s => {
            if (s.weight > 0 && s.reps > 0) return calculate1RM(s.weight, s.reps);
            return 0;
          }), 0);

          // Find historical max for this exercise
          let histMax = 0;
          let hist1RM = 0;
          for (const hw of history) {
            const hEx = (hw.exercises || []).find(e => e.exercise_id === ex.exercise_id);
            if (hEx) {
              for (const s of (hEx.sets || [])) {
                histMax = Math.max(histMax, s.weight || 0);
                if (s.weight > 0 && s.reps > 0) hist1RM = Math.max(hist1RM, calculate1RM(s.weight, s.reps));
              }
            }
          }

          if (maxWeight > histMax && histMax > 0) {
            detectedPrs.push({ name: ex.name || ex.exercise_id, type: 'weight', value: `${maxWeight} кг`, prev: `${histMax} кг` });
          } else if (max1RM > hist1RM && hist1RM > 0) {
            detectedPrs.push({ name: ex.name || ex.exercise_id, type: '1RM', value: `${Math.round(max1RM)} кг`, prev: `${Math.round(hist1RM)} кг` });
          }
        }
      } catch { /* PR detection not critical */ }
      setPrs(detectedPrs);

      // Compute comparison with prev workout
      if (prevWorkout) {
        const prevTonnage = prevWorkout.total_tonnage || 0;
        const currTonnage = workout.total_tonnage || 0;
        const prevTime = prevWorkout.duration_min || 0;
        const currTime = workout.duration_min || 0;
        const prevSets = prevWorkout.total_sets || (prevWorkout.exercises || []).reduce((s, e) => s + (e.sets?.length || 0), 0);
        const currSets = workout.total_sets || exercises.reduce((s, e) => s + (e.sets?.length || 0), 0);
        const pctChange = (curr, prev) => prev > 0 ? Math.round((curr - prev) / prev * 100) : 0;
        setComparison({
          tonnage: { prev: prevTonnage, curr: currTonnage, pct: pctChange(currTonnage, prevTonnage) },
          time: { prev: prevTime, curr: currTime, pct: pctChange(currTime, prevTime) },
          sets: { prev: prevSets, curr: currSets, pct: pctChange(currSets, prevSets) },
        });
      }
      // Persist PR count on workout for history display
      if (detectedPrs.length > 0 && workout.id) {
        try { await updateWorkoutMeta(workout.id, { pr_count: detectedPrs.length }); } catch {}
      }
    })();
  }, [workout]);

  const prCount = prs.length;

  return (
    <ScreenWrapper theme={theme}>
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {/* Hero */}
        <div style={{ textAlign: 'center', padding: '16px 16px 12px' }}>
          <div style={{ fontSize: 48, marginBottom: 4 }}>🏆</div>
          <h1 style={{ color: theme.text, fontSize: 22, fontWeight: 700 }}>
            Тренировка завершена!
          </h1>
          <p style={{ color: theme.gray2, fontSize: 14, marginTop: 2 }}>
            {workout.name} · {workout.date}
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 8, padding: '0 0 12px' }}>
          <Card theme={theme} style={{ flex: 1, textAlign: 'center', borderRadius: 14, padding: '12px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 2 }}>⏱</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: theme.accent }}>
              {workout.duration_min || 0}
            </div>
            <div style={{ color: theme.gray2, fontSize: 10 }}>
              минут
            </div>
          </Card>
          <Card theme={theme} style={{ flex: 1, textAlign: 'center', borderRadius: 14, padding: '12px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 2 }}>🏋️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: theme.purple || '#AF52DE' }}>
              {(workout.total_tonnage || 0).toLocaleString('ru-RU')}
            </div>
            <div style={{ color: theme.gray2, fontSize: 10 }}>
              кг
            </div>
          </Card>
          <Card theme={theme} style={{ flex: 1, textAlign: 'center', borderRadius: 14, padding: '12px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 2 }}>💪</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: theme.orange }}>
              {workout.total_sets || 0}
            </div>
            <div style={{ color: theme.gray2, fontSize: 10 }}>
              подходов
            </div>
          </Card>
        </div>

        {/* PR Badges */}
        {prCount > 0 && (
          <Card theme={theme} style={{ background: theme.orange + '15', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>🥇</span>
              <span style={{ color: theme.text, fontSize: 14, fontWeight: 700 }}>
                {prCount} {prCount === 1 ? 'личный рекорд' : prCount < 5 ? 'личных рекорда' : 'личных рекордов'}!
              </span>
            </div>
            {prs.map((pr, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}>
                <span style={{ color: theme.text, fontSize: 14 }}>
                  🏅 {pr.name}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: theme.green, fontSize: 14, fontWeight: 700 }}>{pr.value}</span>
                  <span style={{ color: theme.gray2, fontSize: 12, marginLeft: 4 }}>
                    ({pr.type === '1RM' ? '1RM' : 'вес'}, было {pr.prev})
                  </span>
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* Exercises breakdown */}
        <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: 8 }}>
          Упражнения
        </div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
          {exercises.map((ex, i) => {
            const exPr = prs.find(p => p.name === (ex.name || ex.exercise_id));
            return (
              <div key={i}>
                
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>
                      {ex.name}
                      {exPr && <span style={{ fontSize: 11, color: theme.orange, background: theme.orange + '12', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>💪 PR</span>}
                    </span>
                  </div>
                <div style={{ color: theme.gray1, fontSize: 13 }}>
                  {ex.sets?.filter(s => !s.is_warmup).map(s => `${s.weight}×${s.reps}`).join(', ') || 'нет подходов'}
                </div>
                {/* Show max 1RM */}
                {ex.sets?.length > 0 && (() => {
                  const best = ex.sets
                    .filter(s => !s.is_warmup)
                    .reduce((b, s) => calculate1RM(s.weight, s.reps) > calculate1RM(b.weight, b.reps) ? s : b, ex.sets[0]);
                  if (best) {
                    return (
                      <div style={{ color: theme.gray2, fontSize: 10, marginTop: 2 }}>
                        1RM ≈ {calculate1RM(best.weight, best.reps)} кг
                      </div>
                    );
                  }
                })()}
              </div>
            </div>
            );
          })}
        </Card>

        {/* Comparison with prev workout */}
        {comparison && (
          <Card theme={theme} style={{ marginTop: 16 }}>
            <div style={{ color: theme.gray2, fontSize: 12, marginBottom: 8 }}>
              Сравнение с прошлой тренировкой «{workout.name}»
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Тоннаж', prev: comparison.tonnage.prev.toLocaleString('ru-RU'), curr: comparison.tonnage.curr.toLocaleString('ru-RU'), pct: comparison.tonnage.pct },
                { label: 'Время', prev: `${comparison.time.prev} мин`, curr: `${comparison.time.curr} мин`, pct: comparison.time.pct },
                { label: 'Подходов', prev: String(comparison.sets.prev), curr: String(comparison.sets.curr), pct: comparison.sets.pct },
              ].map(c => (
                <div key={c.label} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ color: theme.gray2, fontSize: 10 }}>{c.label}</div>
                  <div style={{ color: theme.text, fontSize: 14, fontWeight: 700 }}>{c.curr}</div>
                  <div style={{ color: c.pct > 0 ? theme.green : c.pct < 0 ? theme.red : theme.gray2, fontSize: 11, fontWeight: 500 }}>
                    {c.pct > 0 ? '+' : ''}{c.pct}%
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Notes */}
        {workout.notes && (
          <div style={{ marginTop: 16 }}>
            <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: 4 }}>
              Заметки
            </div>
            <Card theme={theme}>
              <p style={{ color: theme.text, fontSize: 14 }}>{workout.notes}</p>
            </Card>
          </div>
        )}

        {/* Share + Done */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, padding: '0 0 16px' }}>
          <button
            onClick={async () => {
              const exLines = exercises.map(ex => {
                const sets = (ex.sets || []).map(s => `${s.weight || 0}кг×${s.reps || 0}`).join(', ');
                return `  ${ex.name || ex.exercise_id}: ${sets}`;
              }).join('\n');
              const prLines = prs.length > 0 ? `\n🏆 PR: ${prs.map(p => `${p.name} ${p.value}`).join(', ')}` : '';
              const text = `🏋️ ${workout.name} · ${workout.date}\n⏱ ${workout.duration_min || 0} мин · ${exercises.length} упр.\n\n${exLines}${prLines}`;
              const r = await shareText('LifeOS — Тренировка', text);
              if (r.copied) void 0;
            }}
            style={{ padding: '14px 20px', borderRadius: 14, fontWeight: 600, fontSize: 16, background: theme.accent + '15', color: theme.accent, border: 'none', cursor: 'pointer' }}
          >
            📤
          </button>
          <button
            onClick={onDone}
            style={{ flex: 1, padding: 14, borderRadius: 14, fontWeight: 600, fontSize: 16, background: theme.green, color: '#fff', border: 'none', cursor: 'pointer', textAlign: 'center' }}
          >
            💚 Готово
          </button>
        </div>
      </div>
    </ScreenWrapper>
  );
}
