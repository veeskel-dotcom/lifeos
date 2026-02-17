import { useState, useMemo } from 'react';
import { useLiveQuery } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import ProgressBar from '../../components/ProgressBar';

export default function ExerciseDetail({ exerciseId, theme, onBack, onNavigate }) {
  const data = useLiveQuery(async () => {
    if (!exerciseId) return null;
    const db = (await import('../../db')).default;

    const exercise = await db.exercises?.get(exerciseId);
    if (!exercise) return null;

    // Get all workouts that contain this exercise
    const allWorkouts = await db.workouts?.toArray() || [];
    const sessions = [];

    for (const w of allWorkouts) {
      const exSets = (w.exercises || []).find(e => e.exerciseId === exerciseId || e.name === exercise.name);
      if (!exSets) continue;
      const sets = exSets.sets || [];
      const volume = sets.reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0);
      const maxWeight = Math.max(...sets.map(s => s.weight || 0), 0);
      const maxReps = Math.max(...sets.map(s => s.reps || 0), 0);
      const best1RM = Math.max(...sets.map(s => {
        if (!s.weight || !s.reps) return 0;
        return Math.round(s.weight * (1 + s.reps / 30) * 10) / 10; // Epley
      }), 0);

      sessions.push({
        date: w.date || new Date(w.started_at || w.created_at).toISOString().split('T')[0],
        sets,
        volume,
        maxWeight,
        maxReps,
        best1RM,
      });
    }

    sessions.sort((a, b) => b.date.localeCompare(a.date));

    return { exercise, sessions };
  }, [exerciseId]);

  if (!data) return <div style={{ background: theme.bg, minHeight: '100vh' }} />;

  const { exercise, sessions } = data;
  const muscleGroups = exercise.muscles || exercise.muscle_groups || [];
  const last5 = sessions.slice(0, 5);

  // PRs
  const allTime1RM = Math.max(...sessions.map(s => s.best1RM), 0);
  const maxWeight = Math.max(...sessions.map(s => s.maxWeight), 0);
  const maxVolume = sessions.length > 0
    ? sessions.reduce((best, s) => {
        const bestSet = s.sets.reduce((b, set) => {
          const v = (set.weight || 0) * (set.reps || 0);
          return v > (b.weight || 0) * (b.reps || 0) ? set : b;
        }, {});
        const v = (bestSet.weight || 0) * (bestSet.reps || 0);
        return v > (best.weight || 0) * (best.reps || 0) ? bestSet : best;
      }, {})
    : null;

  // 1RM trend (last 10 sessions, oldest first)
  const trendData = sessions.slice(0, 10).reverse();
  const trendMax = Math.max(...trendData.map(s => s.best1RM), 1);

  const fmtDate = (d) => {
    const parts = d.split('-');
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]}`;
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Упражнение" right="Изменить" onBack={onBack}
        onRight={() => onNavigate?.('editExercise', { exerciseId })} theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {/* Exercise name + muscles */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: theme.text, fontSize: 22, fontWeight: 700 }}>{exercise.name}</div>
          {muscleGroups.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {muscleGroups.map(m => (
                <span key={m} style={{ padding: '4px 10px', borderRadius: 10, fontSize: 12, fontWeight: 500, background: (theme.purple || '#AF52DE') + '10', color: theme.purple || '#AF52DE' }}>
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* PR card */}
        {sessions.length > 0 && (
          <Card theme={theme} style={{
            marginBottom: 8,
            background: `linear-gradient(135deg, ${theme.orange}08, ${(theme.yellow || '#FFD60A')}06)`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: theme.orange, letterSpacing: 0.3, marginBottom: 4 }}>
              🏆 ЛИЧНЫЕ РЕКОРДЫ
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: '1RM', value: `${allTime1RM} кг`, sub: 'расчётный' },
                { label: 'Макс. вес', value: `${maxWeight} кг`, sub: 'рабочий' },
                ...(maxVolume ? [{
                  label: 'Макс. объём',
                  value: `${maxVolume.weight}×${maxVolume.reps}`,
                  sub: `${(maxVolume.weight || 0) * (maxVolume.reps || 0)} кг`,
                }] : []),
              ].map(pr => (
                <div key={pr.label} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ color: theme.gray2, fontSize: 10 }}>{pr.label}</div>
                  <div style={{ color: theme.text, fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{pr.value}</div>
                  <div style={{ color: theme.gray3, fontSize: 10 }}>{pr.sub}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Progress chart */}
        {trendData.length > 2 && (
          <>
            <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: 6 }}>
              Прогресс 1RM
            </div>
            <Card theme={theme} style={{ marginBottom: 8, padding: '12px 14px' }}>
              <svg width="100%" height={44} viewBox={`0 0 ${trendData.length * 40} 36`}
                preserveAspectRatio="none" style={{ display: 'block' }}>
                <polyline
                  points={trendData.map((s, i) =>
                    `${i * 40},${36 - (s.best1RM / trendMax) * 32}`
                  ).join(' ')}
                  fill="none" stroke={theme.green} strokeWidth="2" strokeLinejoin="round"
                />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: theme.gray3, fontSize: 11, marginTop: 2 }}>
                {trendData.map(s => (
                  <span key={s.date}>{Math.round(s.best1RM)}</span>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* Last 5 sessions */}
        {last5.length > 0 && (
          <>
            <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: 6 }}>
              Последние {Math.min(5, sessions.length)} тренировок
            </div>
            <Card theme={theme} style={{ padding: 0, marginBottom: 8 }}>
              {last5.map((s, i) => {
                const isPR = s.best1RM === allTime1RM && i === 0;
                return (
                  <div key={s.date} style={{ padding: '10px 14px', borderBottom: i < last5.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ color: theme.text, fontSize: 14, fontWeight: 500 }}>{fmtDate(s.date)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isPR && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 6, color: theme.orange, background: theme.orange + '12' }}>
                            💪 PR
                          </span>
                        )}
                        <span style={{ color: theme.gray2, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                          {s.volume.toLocaleString('ru-RU')} кг
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: theme.gray1 }}>
                      {s.sets.map(set => `${set.weight}×${set.reps}`).join(', ')}
                    </div>
                  </div>
                );
              })}
            </Card>
          </>
        )}

        {sessions.length === 0 && (
          <Card theme={theme}>
            <div style={{ color: theme.gray2, textAlign: 'center', paddingTop: 24, paddingBottom: 24, fontSize: 14 }}>
              Нет данных по этому упражнению
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
