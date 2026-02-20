/**
 * S1-S4: Экран целей — активные + завершённые.
 */
import { useState, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import ProgressBar from '../../components/ProgressBar';
import EmptyState from '../../components/EmptyState';
import ConfirmSheet from '../../components/ConfirmSheet';
import InputSheet from '../../components/InputSheet';
import SkeletonCard from '../../components/SkeletonCard';
import PullToRefresh from '../../components/PullToRefresh';
import {
  getGoals, refreshAllGoals, completeGoal, deleteGoal, getProgress, updateGoal,
} from '../../services/goals';

export default function GoalsScreen({ theme, onBack, onAdd }) {
  const [goals, setGoals] = useState(undefined);
  const [completed, setCompleted] = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [updateGoalSheet, setUpdateGoalSheet] = useState(null);

  const load = async () => {
    const active = await refreshAllGoals();
    setGoals(active);
    const done = await getGoals('completed');
    setCompleted(done);
  };

  useEffect(() => { load(); }, []);

  const handleComplete = async (id) => {
    await completeGoal(id);
    load();
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      await deleteGoal(confirmDelete);
      setConfirmDelete(null);
      load();
    }
  };

  const handleManualUpdate = (goal) => {
    setUpdateGoalSheet(goal);
  };

  const handleUpdateConfirm = async (value) => {
    if (!updateGoalSheet) return;
    const val = parseFloat(value);
    if (isNaN(val)) return;
    await updateGoal(updateGoalSheet.id, { current_value: val });
    setUpdateGoalSheet(null);
    load();
  };

  if (goals === undefined) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
        <NavHeader title="Цели" onBack={onBack} theme={theme} />
        <div className="px-4 pt-2 space-y-3">
          <SkeletonCard theme={theme} />
          <SkeletonCard variant="compact" theme={theme} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader
        title="Цели"
        onBack={onBack}
        right={<span onClick={onAdd} style={{ cursor: 'pointer', fontSize: 16 }}>＋</span>}
        theme={theme}
      />

      <PullToRefresh onRefresh={load} theme={theme}>
      <div className="px-4 pb-24 space-y-3">
        {goals.length === 0 && completed.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="Нет целей"
            subtitle="Поставьте первую цель"
            tip="Цели автоматически обновляются из ваших данных"
            actionLabel="＋ Новая цель"
            onAction={onAdd}
            theme={theme}
          />
        ) : (
          <>
            {/* Active goals */}
            {goals.map(goal => {
              const pct = getProgress(goal);
              const isOver = goal.type === 'finance_limit' && goal.current_value > goal.target_value;
              const deadlineDays = goal.deadline
                ? Math.ceil((new Date(goal.deadline) - new Date()) / 86400000)
                : null;

              return (
                <Card key={goal.id} theme={theme}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{goal.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold" style={{ color: theme.text }}>{goal.title}</span>
                        <span className="text-xs font-bold tabular-nums" style={{ color: pct >= 100 ? theme.green : theme.accent }}>
                          {pct}%
                        </span>
                      </div>

                      <ProgressBar
                        value={Math.min(goal.current_value, goal.target_value)}
                        max={goal.target_value}
                        color={isOver ? theme.red : pct >= 100 ? theme.green : theme.accent}
                        height={6}
                        theme={theme}
                      />

                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs tabular-nums" style={{ color: theme.gray2 }}>
                          {goal.current_value} / {goal.target_value} {goal.unit}
                        </span>
                        {deadlineDays !== null && (
                          <span className="text-[10px]" style={{ color: deadlineDays < 7 ? theme.red : theme.gray2 }}>
                            {deadlineDays > 0 ? `${deadlineDays} дн.` : deadlineDays === 0 ? 'Сегодня' : 'Просрочено'}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-2">
                        {(goal.type === 'custom' || goal.type === 'finance_save' || goal.type === 'reading_books') && (
                          <button onClick={() => handleManualUpdate(goal)}
                            className="text-xs px-3 py-1.5 rounded"
                            style={{ background: theme.accent + '15', color: theme.accent, border: 'none', cursor: 'pointer' }}>
                            ✏️ Обновить
                          </button>
                        )}
                        {pct >= 100 && (
                          <button onClick={() => handleComplete(goal.id)}
                            className="text-xs px-3 py-1.5 rounded"
                            style={{ background: theme.green + '15', color: theme.green, border: 'none', cursor: 'pointer' }}>
                            ✅ Завершить
                          </button>
                        )}
                        <button onClick={() => setConfirmDelete(goal.id)}
                          className="text-xs px-3 py-1.5 rounded"
                          style={{ color: theme.gray2, background: 'none', border: 'none', cursor: 'pointer' }}>
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}

            {/* Completed */}
            {completed.length > 0 && (
              <div>
                <button onClick={() => setShowCompleted(!showCompleted)}
                  className="text-xs font-medium mb-2 px-1"
                  style={{ color: theme.gray2, background: 'none', border: 'none', cursor: 'pointer' }}>
                  {showCompleted ? '▼' : '▶'} Завершённые ({completed.length})
                </button>
                {showCompleted && completed.map(g => (
                  <Card key={g.id} theme={theme} style={{ opacity: 0.6 }}>
                    <div className="flex items-center gap-2">
                      <span>{g.icon}</span>
                      <span className="text-sm" style={{ color: theme.gray1 }}>✅ {g.title}</span>
                      <span className="text-[10px] ml-auto" style={{ color: theme.gray2 }}>
                        {g.target_value} {g.unit}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      </PullToRefresh>

      <ConfirmSheet
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Удалить цель?"
        message="Цель и весь прогресс будут удалены"
        confirmLabel="Удалить"
        onConfirm={handleDelete}
        theme={theme}
      />
      <InputSheet
        open={!!updateGoalSheet}
        onClose={() => setUpdateGoalSheet(null)}
        title="Текущее значение"
        placeholder="Введите число"
        initialValue={updateGoalSheet ? String(updateGoalSheet.current_value) : ''}
        onSubmit={handleUpdateConfirm}
        submitLabel="Обновить"
        inputType="number"
        theme={theme}
      />
    </div>
  );
}
