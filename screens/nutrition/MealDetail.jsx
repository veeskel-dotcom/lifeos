import { useState, useMemo } from 'react';
import { useLiveQuery } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import ProgressBar from '../../components/ProgressBar';
import ConfirmSheet from '../../components/ConfirmSheet';

const MEAL_NAMES = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус' };

export default function MealDetail({ mealType, date, onClose, onNavigate, theme }) {
  const [deleteTarget, setDeleteTarget] = useState(null);

  const entries = useLiveQuery(async () => {
    const db = (await import('../../db')).default;
    return db.food_log.where({ date, meal: mealType }).toArray();
  }, [date, mealType]);

  const totals = useMemo(() => {
    if (!entries?.length) return { cal: 0, p: 0, f: 0, c: 0 };
    return entries.reduce((a, e) => ({
      cal: a.cal + (e.calories || 0),
      p: a.p + (e.protein || 0),
      f: a.f + (e.fat || 0),
      c: a.c + (e.carbs || 0),
    }), { cal: 0, p: 0, f: 0, c: 0 });
  }, [entries]);

  const handleDelete = async (id) => {
    const db = (await import('../../db')).default;
    await db.food_log.delete(id);
    setDeleteTarget(null);
  };

  const timeStr = entries?.[0]?.time || '';
  const macroPcts = totals.cal > 0
    ? { p: Math.round(totals.p * 4 / totals.cal * 100), f: Math.round(totals.f * 9 / totals.cal * 100), c: Math.round(totals.c * 4 / totals.cal * 100) }
    : { p: 0, f: 0, c: 0 };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title={MEAL_NAMES[mealType] || mealType} onBack={onClose}
        right="＋" onRightClick={() => onNavigate?.('food-search', { meal: mealType, date })}
        theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {/* Time + total cal */}
        <div className="mb-2">
          {timeStr && <div className="text-sm" style={{ color: theme.gray2 }}>Сегодня, {timeStr}</div>}
          <div className="text-3xl font-bold" style={{ color: theme.orange }}>{totals.cal} ккал</div>
        </div>

        {/* КБЖУ cards */}
        <div className="flex gap-2 mb-3">
          {[
            { label: 'Белки', val: totals.p.toFixed(1) + ' г', color: theme.red, pct: macroPcts.p },
            { label: 'Жиры', val: totals.f.toFixed(1) + ' г', color: '#FFCC00', pct: macroPcts.f },
            { label: 'Углев.', val: totals.c.toFixed(1) + ' г', color: theme.accent, pct: macroPcts.c },
          ].map(m => (
            <div key={m.label} className="flex-1 rounded-xl p-2.5 text-center"
              style={{ background: theme.card, boxShadow: theme.shadow }}>
              <div className="text-base font-bold" style={{ color: m.color }}>{m.val}</div>
              <div className="text-[10px]" style={{ color: theme.gray2 }}>{m.label} · {m.pct}%</div>
              <div className="mt-1"><ProgressBar value={m.pct} max={100} color={m.color} height={3} theme={theme} /></div>
            </div>
          ))}
        </div>

        {/* Food items */}
        <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: theme.gray1 }}>
          Продукты
        </div>
        <Card theme={theme} style={{ padding: 0, marginBottom: 8 }}>
          {entries?.length ? entries.map((food, i) => (
            <div key={food.id} className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer"
              style={{ borderBottom: i < entries.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}
              onClick={() => setDeleteTarget(food)}>
              <span className="text-lg w-7 text-center">{food.emoji || '🍽'}</span>
              <div className="flex-1">
                <div className="text-sm font-medium" style={{ color: theme.text }}>{food.name}</div>
                <div className="flex gap-1.5 text-xs mt-0.5">
                  <span className="font-semibold" style={{ color: theme.orange }}>{food.calories}</span>
                  <span style={{ color: theme.gray3 }}>·</span>
                  <span style={{ color: theme.gray2 }}>Б <b style={{ color: theme.red }}>{food.protein?.toFixed(1)}</b></span>
                  <span style={{ color: theme.gray2 }}>Ж <b style={{ color: '#FFCC00' }}>{food.fat?.toFixed(1)}</b></span>
                  <span style={{ color: theme.gray2 }}>У <b style={{ color: theme.accent }}>{food.carbs?.toFixed(1)}</b></span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium" style={{ color: theme.accent }}>{food.grams || food.amount} г</div>
              </div>
            </div>
          )) : (
            <div className="py-8 text-center text-sm" style={{ color: theme.gray3 }}>
              Нет записей
            </div>
          )}
        </Card>

        <div className="text-center text-xs" style={{ color: theme.gray3 }}>
          ← свайп для удаления продукта
        </div>
      </div>

      <ConfirmSheet
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Удалить продукт?"
        message={`«${deleteTarget?.name}» будет удалён из приёма пищи`}
        confirmLabel="Удалить"
        onConfirm={() => handleDelete(deleteTarget?.id)}
        theme={theme}
      />
    </div>
  );
}
