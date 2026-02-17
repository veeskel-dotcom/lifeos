import { useState, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import { DAY_LABELS } from '../../services/templates';
import ScreenWrapper from '../../components/ScreenWrapper';
import ConfirmSheet from '../../components/ConfirmSheet';
import FormInput from '../../components/FormInput';

export default function TemplateEditor({ template, onSave, onDelete, onClose, onPickExercise, theme }) {
  const isEdit = !!template;
  const [name, setName] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    if (template) {
      setName(template.name || '');
      setDayOfWeek(template.day_of_week);
      setExercises(template.exercises?.map(e => ({ ...e })) || []);
    }
  }, [template]);

  const handleAddExercise = () => {
    onPickExercise((ex) => {
      setExercises(prev => [...prev, {
        exercise_id: ex.id,
        name: ex.name,
        target_sets: 3,
        target_reps: 10,
      }]);
    });
  };

  const removeExercise = (idx) => {
    setExercises(prev => prev.filter((_, i) => i !== idx));
  };

  const updateExercise = (idx, field, value) => {
    setExercises(prev => prev.map((e, i) => i === idx ? { ...e, [field]: parseInt(value) || 0 } : e));
  };

  const moveExercise = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= exercises.length) return;
    const copy = [...exercises];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setExercises(copy);
  };

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(confirmDelete);
      setConfirmDelete(null);
    }
  };

  const handleSubmit = () => {
    if (!name || exercises.length === 0) return;
    onSave({
      ...(template?.id ? { id: template.id } : {}),
      name,
      day_of_week: dayOfWeek,
      exercises,
    });
  };

  const isValid = name && exercises.length > 0;

  return (
    <ScreenWrapper theme={theme}>
      <NavHeader
        title={isEdit ? 'Ред. шаблон' : 'Новый шаблон'}
        onBack={onClose}
        right={isEdit ? (
          <button onClick={() => setConfirmDelete(template.id)} style={{ color: theme.red, fontSize: 14, fontWeight: 500 }}>
            Удалить
          </button>
        ) : null}
        theme={theme}
      />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {/* Name */}
        <div>
          <label className="mb-1.5 block" style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
            Название
          </label>
          <FormInput value={name} onChange={setName} placeholder="Ноги (понедельник)" theme={theme} />
        </div>

        {/* Day of week */}
        <div>
          <label className="mb-2 block" style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
            День недели
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map(d => (
              <button
                key={d} onClick={() => setDayOfWeek(dayOfWeek === d ? null : d)}
                className="w-10 h-10 rounded-full flex items-center justify-center" style={{ fontSize: 12, fontWeight: 600, background: dayOfWeek === d ? theme.accent : theme.gray5, color: dayOfWeek === d ? '#fff' : theme.text }}
              >
                {DAY_LABELS[d]}
              </button>
            ))}
          </div>
        </div>

        {/* Exercises */}
        <div>
          <label className="mb-2 block" style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
            Упражнения ({exercises.length})
          </label>

          {exercises.length === 0 ? (
            <Card theme={theme}>
              <p className="py-4" style={{ color: theme.gray2, fontSize: 14, textAlign: 'center' }}>
                Добавьте упражнения
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {exercises.map((ex, i) => (
                <Card key={i} theme={theme}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex-1" style={{ color: theme.text, fontSize: 14, fontWeight: 500 }}>{ex.name}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => moveExercise(i, -1)} className="px-1" style={{ color: theme.gray2, fontSize: 12 }}>▲</button>
                      <button onClick={() => moveExercise(i, 1)} className="px-1" style={{ color: theme.gray2, fontSize: 12 }}>▼</button>
                      <button onClick={() => removeExercise(i)} className="px-1.5" style={{ color: theme.red, fontSize: 12 }}>✕</button>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="mb-0.5 block" style={{ color: theme.gray2, fontSize: 10 }}>Подходы</label>
                      <input
                        type="number" inputMode="numeric" value={ex.target_sets}
                        onChange={e => updateExercise(i, 'target_sets', e.target.value)}
                        className="w-full rounded-lg px-3 py-2 outline-none" style={{ fontSize: 14, textAlign: 'center', background: theme.gray6, color: theme.text }}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-0.5 block" style={{ color: theme.gray2, fontSize: 10 }}>Повторы</label>
                      <input
                        type="number" inputMode="numeric" value={ex.target_reps}
                        onChange={e => updateExercise(i, 'target_reps', e.target.value)}
                        className="w-full rounded-lg px-3 py-2 outline-none" style={{ fontSize: 14, textAlign: 'center', background: theme.gray6, color: theme.text }}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <button
            onClick={handleAddExercise}
            className="w-full py-3 rounded-xl mt-2" style={{ fontSize: 14, fontWeight: 500, background: theme.card, color: theme.accent, border: `1px dashed ${theme.gray4}` }}
          >
            ＋ Добавить упражнение
          </button>
        </div>

        <button
          onClick={handleSubmit} disabled={!isValid}
          className="w-full py-3.5 rounded-xl" style={{ fontWeight: 600, fontSize: 16, background: isValid ? theme.green : theme.gray4, color: '#fff', opacity: isValid ? 1 : 0.6 }}
        >
          💚 Сохранить шаблон
        </button>
      </div>
      <ConfirmSheet
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Удалить шаблон?"
        message="Шаблон тренировки будет удалён"
        confirmLabel="Удалить"
        onConfirm={handleDelete}
        theme={theme}
      />
    </ScreenWrapper>
  );
}
