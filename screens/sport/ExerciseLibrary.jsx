import FormInput from '../../components/FormInput';
import { useState, useMemo } from 'react';
import { useExercises } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';

import SkeletonList from '../../components/SkeletonList';
import { MUSCLE_GROUPS, EQUIPMENT_TYPES } from '../../services/exercises';
import ScreenWrapper from '../../components/ScreenWrapper';

export default function ExerciseLibrary({ theme, onBack, onSelect, onNavigate, selectMode = false }) {
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState(null);
  const [equipFilter, setEquipFilter] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const exercises = useExercises();

  const filtered = useMemo(() => {
    if (!exercises) return null;
    let list = [...exercises];
    if (muscleFilter) list = list.filter(e => e.muscle_group === muscleFilter);
    if (equipFilter) list = list.filter(e => e.equipment === equipFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [exercises, muscleFilter, equipFilter, search]);

  // Group by muscle
  const grouped = useMemo(() => {
    if (!filtered || muscleFilter) return null;
    const g = {};
    filtered.forEach(e => {
      if (!g[e.muscle_group]) g[e.muscle_group] = [];
      g[e.muscle_group].push(e);
    });
    return MUSCLE_GROUPS.filter(mg => g[mg.id]?.length).map(mg => ({
      ...mg, items: g[mg.id],
    }));
  }, [filtered, muscleFilter]);

  if (!filtered) {
    return (
      <ScreenWrapper theme={theme}>
        <NavHeader title="Упражнения" onBack={onBack} theme={theme} />
        <div className="p-4">
          <SkeletonList count={5} theme={theme} />
        </div>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper theme={theme}>
      <NavHeader title={selectMode ? 'Выбрать упражнение' : 'Упражнения'} onBack={onBack} theme={theme} />

      {/* Search */}
      <div className="px-4 pb-2">
        <FormInput value={search} onChange={setSearch} placeholder="Поиск..." theme={theme} />
      </div>

      {/* Muscle group chips */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
        <button
          onClick={() => setMuscleFilter(null)}
          className="px-3 py-1.5 rounded-full whitespace-nowrap" style={{ fontSize: 12, fontWeight: 500, background: !muscleFilter ? theme.accent : theme.gray5, color: !muscleFilter ? '#fff' : theme.text }}
        >
          Все
        </button>
        {MUSCLE_GROUPS.map(mg => (
          <button
            key={mg.id}
            onClick={() => setMuscleFilter(muscleFilter === mg.id ? null : mg.id)}
            className="px-3 py-1.5 rounded-full whitespace-nowrap" style={{ fontSize: 12, fontWeight: 500, background: muscleFilter === mg.id ? theme.accent : theme.gray5, color: muscleFilter === mg.id ? '#fff' : theme.text }}
          >
            {mg.icon} {mg.label}
          </button>
        ))}
      </div>

      {/* Equipment chips */}
      <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
        {EQUIPMENT_TYPES.map(eq => (
          <button
            key={eq.id}
            onClick={() => setEquipFilter(equipFilter === eq.id ? null : eq.id)}
            className="px-3 py-1.5 rounded-full whitespace-nowrap" style={{ fontSize: 12, fontWeight: 500, background: equipFilter === eq.id ? theme.accent : theme.gray5, color: equipFilter === eq.id ? '#fff' : theme.text }}
          >
            {eq.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {filtered.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="Ничего не найдено"
            subtitle="Попробуйте другой запрос или фильтр"
            actionLabel="Сбросить фильтры"
            onAction={() => { setSearch(''); setMuscleFilter(null); setEquipFilter(null); }}
            theme={theme}
          />
        ) : muscleFilter || search ? (
          <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
            {filtered.map((ex, i) => (
              <div key={ex.id}>
                {i > 0 && <div className="mx-4" style={{ borderTop: `0.5px solid ${theme.gray5}` }} />}
                <div
                  className="flex items-center px-4 py-3 cursor-pointer active:opacity-70"
                  onClick={() => selectMode ? onSelect(ex) : onNavigate ? onNavigate('exerciseDetail', { exerciseId: ex.id }) : setExpandedId(expandedId === ex.id ? null : ex.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div style={{ color: theme.text, fontSize: 14, fontWeight: 500 }}>{ex.name}</div>
                    <div className="mt-0.5" style={{ color: theme.gray2, fontSize: 12 }}>
                      {MUSCLE_GROUPS.find(m => m.id === ex.muscle_group)?.label} · {EQUIPMENT_TYPES.find(e => e.id === ex.equipment)?.label}
                      {ex.is_compound && ' · Базовое'}
                    </div>
                  </div>
                  {selectMode ? (
                    <span style={{ color: theme.accent, fontSize: 16 }}>＋</span>
                  ) : (
                    <span style={{ color: theme.gray3, fontSize: 12 }}>{expandedId === ex.id ? '▼' : '›'}</span>
                  )}
                </div>
                {!selectMode && expandedId === ex.id && ex.instructions && (
                  <div className="px-4 pb-3 leading-relaxed" style={{ color: theme.gray1, fontSize: 12 }}>
                    {ex.instructions}
                  </div>
                )}
              </div>
            ))}
          </Card>
        ) : (
          grouped?.map(group => (
            <div key={group.id} className="mb-4">
              <div className="py-2" style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                {group.icon} {group.label}
              </div>
              <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
                {group.items.map((ex, i) => (
                  <div key={ex.id}>
                    {i > 0 && <div className="mx-4" style={{ borderTop: `0.5px solid ${theme.gray5}` }} />}
                    <div
                      className="flex items-center px-4 py-3 cursor-pointer active:opacity-70"
                      onClick={() => selectMode ? onSelect(ex) : onNavigate ? onNavigate('exerciseDetail', { exerciseId: ex.id }) : setExpandedId(expandedId === ex.id ? null : ex.id)}
                    >
                      <span className="flex-1" style={{ color: theme.text, fontSize: 14, fontWeight: 500 }}>{ex.name}</span>
                      {selectMode ? (
                        <span style={{ color: theme.accent }}>＋</span>
                      ) : (
                        <span style={{ color: theme.gray3, fontSize: 12 }}>{expandedId === ex.id ? '▼' : '›'}</span>
                      )}
                    </div>
                    {!selectMode && expandedId === ex.id && ex.instructions && (
                      <div className="px-4 pb-3 leading-relaxed" style={{ color: theme.gray1, fontSize: 12 }}>
                        {ex.instructions}
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            </div>
          ))
        )}
      </div>
    </ScreenWrapper>
  );
}
