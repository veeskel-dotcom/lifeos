import { useWorkout } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';

import SkeletonList from '../../components/SkeletonList';
import { calculate1RM } from '../../services/workouts';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export default function WorkoutDetail({ workoutId, theme, onBack }) {
  const workout = useWorkout(workoutId);

  if (!workout) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
        <NavHeader title="Тренировка" onBack={onBack} theme={theme} />
        <div className="p-4">
          <SkeletonList count={5} theme={theme} />
        </div>
      </div>
    );
  }

  const d = new Date(workout.date + 'T00:00:00');
  const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title={workout.name} onBack={onBack} left="История" theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {/* Summary */}
        <Card theme={theme}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: theme.gray2, fontSize: 14 }}>{dateStr}</div>
            <div className="flex justify-center gap-6 mt-3">
              {workout.duration_min > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: theme.text, fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{workout.duration_min}</div>
                  <div style={{ color: theme.gray2, fontSize: 10, textTransform: 'uppercase' }}>мин</div>
                </div>
              )}
              {workout.total_tonnage > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: theme.text, fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {workout.total_tonnage.toLocaleString('ru-RU')}
                  </div>
                  <div style={{ color: theme.gray2, fontSize: 10, textTransform: 'uppercase' }}>кг</div>
                </div>
              )}
              {workout.total_sets > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: theme.text, fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{workout.total_sets}</div>
                  <div style={{ color: theme.gray2, fontSize: 10, textTransform: 'uppercase' }}>подходов</div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Exercises */}
        {workout.exercises?.map((ex, i) => (
          <Card key={i} theme={theme}>
            <div className="mb-2" style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>{ex.name}</div>
            {ex.sets?.length > 0 ? (
              <div className="space-y-1">
                {ex.sets.map((s, si) => (
                  <div key={si} className="flex justify-between" style={{ fontSize: 14 }}>
                    <span style={{ color: theme.gray1 }}>
                      {s.is_warmup ? '🔥 Разминка' : `Подход ${si + 1}`}
                    </span>
                    <span style={{ color: theme.text, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                      {s.weight} кг × {s.reps}
                    </span>
                  </div>
                ))}
                <div className="pt-1 mt-1" style={{ fontSize: 12, color: theme.gray2, borderTop: `0.5px solid ${theme.gray5}` }}>
                  Макс: {Math.max(...ex.sets.filter(s => !s.is_warmup).map(s => s.weight))} кг
                  {' · '}1RM ≈ {(() => {
                    const best = ex.sets
                      .filter(s => !s.is_warmup)
                      .reduce((b, s) => calculate1RM(s.weight, s.reps) > calculate1RM(b.weight, b.reps) ? s : b, ex.sets[0]);
                    return calculate1RM(best.weight, best.reps);
                  })()} кг
                </div>
              </div>
            ) : (
              <p style={{ color: theme.gray2, fontSize: 12 }}>Нет подходов</p>
            )}
          </Card>
        ))}

        {/* Notes */}
        {workout.notes && (
          <Card theme={theme}>
            <div className="mb-1" style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Заметки</div>
            <p style={{ color: theme.text, fontSize: 14 }}>{workout.notes}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
