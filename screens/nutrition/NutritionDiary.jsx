/**
 * NutritionDiary — Главный экран дневника питания.
 * ккал + БЖУ прогресс, 4 приёма пищи, вода, навигация по дням.
 * Wave 1: C1.3 копирование, C2.2 график, C2.3 streak, C2.4 рекомендация
 * Wave 2: C1.2 настройка целей, C2.1 недельный отчёт
 */

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import ProgressRing from '../../components/ProgressRing';
import ProgressBar from '../../components/ProgressBar';
import ConfirmSheet from '../../components/ConfirmSheet';
import ActionSheet from '../../components/ActionSheet';
import InputSheet from '../../components/InputSheet';
import SelectSheet from '../../components/SelectSheet';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import WaterTracker from './WaterTracker';
import {
  getMealsForDay,
  getDailyTotals,
  getGoals,
  removeMealItem,
  updateMealItem,
  copyMealsFromDay,
  getWeekCalories,
  getLoggingStreak,
  getRemainingCalories,
  getWeeklyNutritionReport,
  getMealPresets,
  saveMealPreset,
  applyMealPreset,
} from '../../services/nutrition';
import { setSetting } from '../../db/helpers';
import { useToast } from '../../components/ToastProvider';
import TutorialTip from '../../components/TutorialTip';
import SkeletonCard from '../../components/SkeletonCard';

const MEALS = [
  { key: 'breakfast', icon: '🌅', label: 'Завтрак' },
  { key: 'lunch',     icon: '☀️', label: 'Обед' },
  { key: 'dinner',    icon: '🌙', label: 'Ужин' },
  { key: 'snack',     icon: '🍪', label: 'Перекус' },
];

function formatDate(date) {
  const d = new Date(date + 'T12:00:00');
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ── C1.2: Bottom sheet для редактирования целей КБЖУ ── */
function GoalSheet({ goals, theme, onSave, onClose }) {
  const [localGoals, setLocalGoals] = useState({ ...goals });

  const fields = [
    { key: 'calories', label: 'Калории', unit: 'ккал' },
    { key: 'protein', label: 'Белки', unit: 'г' },
    { key: 'fat', label: 'Жиры', unit: 'г' },
    { key: 'carbs', label: 'Углеводы', unit: 'г' },
    { key: 'fiber', label: 'Клетчатка', unit: 'г' },
    { key: 'sugar', label: 'Сахар', unit: 'г' },
    { key: 'sodium', label: 'Натрий', unit: 'мг' },
  ];

  const save = async () => {
    await setSetting('daily_calorie_goal', localGoals.calories);
    await setSetting('daily_protein_goal', localGoals.protein);
    await setSetting('daily_fat_goal', localGoals.fat);
    await setSetting('daily_carbs_goal', localGoals.carbs);
    await setSetting('daily_fiber_goal', localGoals.fiber);
    await setSetting('daily_sugar_goal', localGoals.sugar);
    await setSetting('daily_sodium_goal', localGoals.sodium);
    onSave();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
      <div style={{ width: "100%", maxWidth: 448, borderRadius: "16px 16px 0 0", padding: "16px 20px 32px", background: theme.bg }}>
        <div style={{ width: 40, height: 4, borderRadius: 9999, margin: "0 auto 16px", background: theme.gray4 }} />
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: theme.text }}>Цели питания</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {fields.map(f => (
            <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, color: theme.text }}>{f.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number"
                  inputMode="numeric"
                  value={localGoals[f.key]}
                  onChange={e => setLocalGoals({ ...localGoals, [f.key]: parseInt(e.target.value) || 0 })}
                  style={{ width: 80, textAlign: "right", borderRadius: 8, padding: "6px 8px", fontSize: 14, outline: "none", background: theme.gray6, color: theme.text, border: "none" }}
                />
                <span style={{ fontSize: 12, color: theme.gray2 }}>{f.unit}</span>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={save}
          style={{ width: "100%", padding: 12, borderRadius: 12, color: "#fff", fontWeight: 600, fontSize: 16, marginTop: 16, background: theme.accent, border: 'none', cursor: 'pointer' }}
        >
          Сохранить
        </button>
        <button
          onClick={onClose}
          style={{ width: "100%", padding: 8, textAlign: "center", fontSize: 14, marginTop: 8, color: theme.gray2, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

export default function NutritionDiary({ theme, onOpenSearch, onOpenManual, onMealDetail }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [meals, setMeals] = useState([]);
  const [totals, setTotals] = useState({ calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0, water_ml: 0 });
  const [goals, setGoals] = useState({ calories: 2200, protein: 120, fat: 80, carbs: 250, fiber: 25, sugar: 50, sodium: 2300, water: 2000 });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(true);

  /* C1.2 — goal sheet */
  const [showGoalSheet, setShowGoalSheet] = useState(false);
  /* C2.1 — weekly report */
  const [weeklyReport, setWeeklyReport] = useState(null);
  /* C2.2 — weekly calories bar chart */
  const [weekCalories, setWeekCalories] = useState([]);
  /* C2.3 — streak */
  const [streak, setStreak] = useState(0);
  /* C2.4 — remaining calories */
  const [remaining, setRemaining] = useState(null);
  const [activeActionMeal, setActiveActionMeal] = useState(null);
  const [presetSaveMeal, setPresetSaveMeal] = useState(null);
  const [presetPickMeal, setPresetPickMeal] = useState(null);
  const [presetOptions, setPresetOptions] = useState([]);

  const { showToast } = useToast();

  const load = useCallback(async () => {
    const [m, t, g, wc, s, rem, wr] = await Promise.all([
      getMealsForDay(date),
      getDailyTotals(date),
      getGoals(),
      getWeekCalories(date),
      getLoggingStreak(),
      getRemainingCalories(),
      getWeeklyNutritionReport().catch(() => null),
    ]);
    setMeals(m);
    setTotals(t);
    setGoals(g);
    setWeekCalories(wc);
    setStreak(s);
    setRemaining(rem);
    setWeeklyReport(wr);
    setEditingItem(null);
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  /* ── Handlers ── */

  const handleRemoveItem = (logId, itemIndex) => {
    setConfirmDelete({ logId, itemIndex });
  };

  const executeRemoveItem = async () => {
    if (!confirmDelete) return;
    await removeMealItem(confirmDelete.logId, confirmDelete.itemIndex);
    setConfirmDelete(null);
    load();
  };

  /* ── Derived ── */

  const getMealData = (mealKey) => meals.filter(m => m.meal_type === mealKey);
  const getMealTotal = (mealKey) =>
    getMealData(mealKey).reduce((s, m) => s + (m.total_calories || 0), 0);

  const calPercent = goals.calories > 0
    ? Math.round((totals.calories / goals.calories) * 100)
    : 0;

  const isEmpty = meals.length === 0 && totals.calories === 0;

  /* ═══ EMPTY STATE (today only) ═══ */

  if (isEmpty && date === today) {
    return (
      <div style={{ paddingBottom: 16 }}>
        {/* Header */}
        <div style={{ padding: "6px 20px 2px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: theme.text }}>Питание</span>
            {streak >= 1 && (
              <span
                style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, background: theme.orange + '20', color: theme.orange }}
              >
                🔥 {streak}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: theme.gray1, marginTop: 2 }}>{formatDate(date)}</div>
        </div>

        <EmptyState
          icon="🥗"
          title="Начните вести дневник"
          subtitle="Добавьте первый приём пищи"
          actionLabel="Добавить завтрак"
          onAction={() => onOpenSearch?.('breakfast')}
          theme={theme}
        />

        {/* C1.3 — Copy yesterday */}
        <div style={{ margin: "0 16px", marginBottom: 12 }}>
          <button
            onClick={async () => {
              const yesterday = shiftDate(date, -1);
              const count = await copyMealsFromDay(yesterday, date);
              if (count > 0) { load(); showToast(`Скопировано ${count} записей`); }
              else { showToast('Вчера нет записей'); }
            }}
            style={{ width: "100%", padding: 12, borderRadius: 16, fontSize: 14, fontWeight: 500, textAlign: "center", cursor: "pointer", background: theme.card, color: theme.accent, border: `1px solid ${theme.accent}30` }}
          >
            📋 Скопировать вчерашний день
          </button>
        </div>

        {/* Date nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 16px", paddingTop: 8 }}>
          <button
            onClick={() => setDate(d => shiftDate(d, -1))}
            style={{ padding: "8px 16px", fontSize: 14, fontWeight: 500, color: theme.accent, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ‹ {shiftDate(date, -1).slice(5)}
          </button>
          <span />
          <button
            onClick={() => setDate(d => shiftDate(d, 1))}
            style={{ padding: "8px 16px", fontSize: 14, fontWeight: 500,
              color: date >= today ? theme.gray3 : theme.accent,
              background: 'none', border: 'none', cursor: 'pointer',
              pointerEvents: date >= today ? 'none' : 'auto',
            }}
          >
            {shiftDate(date, 1).slice(5)} ›
          </button>
        </div>
      </div>
    );
  }

  /* ═══ MAIN RETURN ═══ */

  return (
    <div style={{ paddingBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── Header ── */}
      <div style={{ padding: "6px 20px 2px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: theme.text }}>Питание</span>
            {streak >= 1 && (
              <span
                style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, background: theme.orange + '20', color: theme.orange }}
              >
                🔥 {streak}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowGoalSheet(true)}
            style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: theme.accent + '15', color: theme.accent, border: 'none', cursor: 'pointer' }}
          >
            ⚙️ Цели
          </button>
        </div>
        <div style={{ fontSize: 13, color: theme.gray1, marginTop: 2 }}>{formatDate(date)}</div>
      </div>

      <TutorialTip id="nutrition_intro" theme={theme} icon="🍽">
        Добавляйте приёмы пищи кнопкой +. Свайпните запись для удаления. Нажмите «Цели» чтобы настроить КБЖУ.
      </TutorialTip>

      {loading ? (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <SkeletonCard variant="chart" theme={theme} />
          <SkeletonCard theme={theme} />
          <SkeletonCard variant="compact" theme={theme} />
        </div>
      ) : (
      <>
      {/* ── Calories + Macros ring ── */}
      <div style={{ borderRadius: 16, margin: "0 16px", padding: 16, background: theme.card }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <ProgressRing
            value={totals.calories}
            max={goals.calories}
            size={120}
            strokeWidth={8}
            color={calPercent > 100 ? theme.red : theme.green}
            theme={theme}
          >
            <span style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>{totals.calories}</span>
            <span style={{ fontSize: 11, color: theme.gray2 }}>из {goals.calories}</span>
          </ProgressRing>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Protein */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                <span style={{ color: theme.gray1 }}>Белки</span>
                <span style={{ color: theme.text }}>{totals.protein} / {goals.protein}г</span>
              </div>
              <ProgressBar value={totals.protein} max={goals.protein} color={theme.red} height={4} theme={theme} />
            </div>
            {/* Fat */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                <span style={{ color: theme.gray1 }}>Жиры</span>
                <span style={{ color: theme.text }}>{totals.fat} / {goals.fat}г</span>
              </div>
              <ProgressBar value={totals.fat} max={goals.fat} color={theme.orange} height={4} theme={theme} />
            </div>
            {/* Carbs */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                <span style={{ color: theme.gray1 }}>Углеводы</span>
                <span style={{ color: theme.text }}>{totals.carbs} / {goals.carbs}г</span>
              </div>
              <ProgressBar value={totals.carbs} max={goals.carbs} color={theme.accent} height={4} theme={theme} />
            </div>

            {/* C1.1 — Micronutrients */}
            {(totals.fiber > 0 || totals.sugar > 0 || totals.sodium > 0) && (
              <div style={{ paddingTop: 8, marginTop: 8, display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${theme.gray5}` }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: theme.gray2 }}>Микронутриенты</div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                    <span style={{ color: theme.gray1 }}>Клетчатка</span>
                    <span style={{ color: theme.text }}>{totals.fiber} / {goals.fiber}г</span>
                  </div>
                  <ProgressBar value={totals.fiber} max={goals.fiber} color={theme.green} height={3} theme={theme} />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                    <span style={{ color: theme.gray1 }}>Сахар</span>
                    <span style={{ color: totals.sugar > goals.sugar ? theme.red : theme.text }}>{totals.sugar} / {goals.sugar}г</span>
                  </div>
                  <ProgressBar value={totals.sugar} max={goals.sugar} color={totals.sugar > goals.sugar ? theme.red : theme.purple} height={3} theme={theme} />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                    <span style={{ color: theme.gray1 }}>Натрий</span>
                    <span style={{ color: totals.sodium > goals.sodium ? theme.red : theme.text }}>{totals.sodium} / {goals.sodium}мг</span>
                  </div>
                  <ProgressBar value={totals.sodium} max={goals.sodium} color={totals.sodium > goals.sodium ? theme.red : theme.yellow} height={3} theme={theme} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* C2.4 — Remaining calories recommendation */}
        {remaining && (() => {
          const r = remaining.remaining;
          if (r > 200) return (
            <p style={{ fontSize: 12, marginTop: 8, color: theme.gray1 }}>
              Осталось {r} ккал — {r > 500 ? 'полноценный приём пищи' : 'лёгкий перекус'}
            </p>
          );
          if (r < 0) return (
            <p style={{ fontSize: 12, marginTop: 8, color: theme.red }}>
              Превышение на {Math.abs(r)} ккал
            </p>
          );
          if (r >= 0 && r <= 200) return (
            <p style={{ fontSize: 12, marginTop: 8, color: theme.green }}>
              ✅ Цель почти достигнута!
            </p>
          );
          return null;
        })()}
      </div>

      {/* ── C1.3 — Copy yesterday (when no meals yet) ── */}
      {meals.length === 0 && date === today && (
        <div style={{ margin: "0 16px" }}>
          <button
            onClick={async () => {
              const yesterday = shiftDate(date, -1);
              const count = await copyMealsFromDay(yesterday, date);
              if (count > 0) { load(); showToast(`Скопировано ${count} записей`); }
              else { showToast('Вчера нет записей'); }
            }}
            style={{ width: "100%", padding: 12, borderRadius: 16, fontSize: 14, fontWeight: 500, textAlign: "center", cursor: "pointer", background: theme.card, color: theme.accent, border: `1px solid ${theme.accent}30` }}
          >
            📋 Скопировать вчерашний день
          </button>
        </div>
      )}

      {/* ── 4 Meal Sections ── */}
      {MEALS.map(({ key, icon, label }) => {
        const mealLogs = getMealData(key);
        const mealCal = getMealTotal(key);
        const hasItems = mealLogs.some(l => l.items?.length > 0);

        return (
          <div key={key} style={{ margin: "0 16px", borderRadius: 16, overflow: "hidden", background: theme.card }}>
            {/* Meal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                onClick={() => hasItems && onMealDetail?.(key)}>
                <span>{icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.025em", color: theme.gray1 }}>
                  {label}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: hasItems ? theme.gray1 : theme.gray2 }}>
                  {hasItems ? `${mealCal} ккал` : ''}
                </span>
                <button
                  onClick={() => setActiveActionMeal(key)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 28, height: 28, borderRadius: 14,
                    background: theme.accent,
                    color: '#fff',
                    border: 'none', cursor: 'pointer',
                    fontSize: 18, lineHeight: 1,
                  }}
                >
                  ＋
                </button>
              </div>
            </div>

            {/* Meal items */}
            {hasItems ? (
              <div style={{ padding: "0 14px 8px" }}>
                {mealLogs.map(log =>
                  log.items?.map((item, idx) => {
                    const itemKey = `${log.id}-${idx}`;
                    const isEditing = editingItem?.logId === log.id && editingItem?.idx === idx;

                    return (
                      <div key={itemKey}>
                        {/* Item row */}
                        <div
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", borderTop: `0.5px solid ${theme.gray5}`, cursor: "pointer" }}
                          onClick={() => {
                            if (isEditing) { setEditingItem(null); }
                            else { setEditingItem({ logId: log.id, idx, grams: String(item.amount_g || 100) }); }
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: theme.gray1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                            <div style={{ fontSize: 12, color: theme.gray2 }}>
                              {item.amount_g}г · Б{Math.round(item.protein || 0)} Ж{Math.round(item.fat || 0)} У{Math.round(item.carbs || 0)}
                            </div>
                          </div>
                          <span style={{ fontSize: 13, color: theme.gray2, marginLeft: 8, flexShrink: 0 }}>
                            {item.calories} ккал
                          </span>
                        </div>

                        {/* Inline grams editor */}
                        {isEditing && (
                          <div
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", background: theme.gray6, borderRadius: 8, margin: '2px 0 4px' }}
                          >
                            <input
                              type="number"
                              inputMode="numeric"
                              value={editingItem.grams}
                              onChange={(e) => setEditingItem({ ...editingItem, grams: e.target.value })}
                              style={{ width: 64, fontSize: 14, textAlign: "center", borderRadius: 8, padding: "6px 8px", outline: "none", background: theme.card, color: theme.text, border: "none" }}
                              autoFocus
                            />
                            <span style={{ fontSize: 12, color: theme.gray2 }}>г</span>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const g = parseInt(editingItem.grams);
                                if (g > 0 && g !== item.amount_g) {
                                  await updateMealItem(log.id, idx, {
                                    amount_g: g,
                                    calories: Math.round(((item.calories || 0) / (item.amount_g || 100)) * g),
                                    protein: (((item.protein || 0) / (item.amount_g || 100)) * g).toFixed(1),
                                    fat: (((item.fat || 0) / (item.amount_g || 100)) * g).toFixed(1),
                                    carbs: (((item.carbs || 0) / (item.amount_g || 100)) * g).toFixed(1),
                                  });
                                  load();
                                }
                              }}
                              style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, background: theme.accent, color: "#fff", border: "none", cursor: "pointer" }}
                            >
                              ✓
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveItem(log.id, idx); }}
                              style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: theme.red + '15', color: theme.red }}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}

            {/* Save preset button (inline, only if has items) */}
            {hasItems && (
              <div style={{ padding: "0 14px 12px" }}>
                <button
                  onClick={() => setPresetSaveMeal(key)}
                  style={{ fontSize: 12, fontWeight: 500, color: theme.accent, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ⭐ Сохранить как шаблон
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Water Tracker ── */}
      <div style={{ margin: "0 16px" }}>
        <WaterTracker date={date} theme={theme} onUpdate={load} />
      </div>

      {/* ── C2.2 — Weekly calories BarChart ── */}
      {weekCalories.length > 0 && (
        <div style={{ margin: "0 16px" }}>
          <Card theme={theme}>
            <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: theme.gray1 }}>
              КАЛОРИИ ЗА НЕДЕЛЮ
            </p>
            <div style={{ height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekCalories} margin={{ top: 8, right: 0, bottom: 0, left: -20 }}>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: theme.gray2 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: theme.gray2 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ReferenceLine y={goals.calories} stroke={theme.gray4} strokeDasharray="4 4" />
                  <Bar dataKey="calories" radius={[4, 4, 0, 0]} barSize={24}>
                    {weekCalories.map((e, i) => (
                      <Cell
                        key={i}
                        fill={
                          e.date === date
                            ? theme.accent
                            : e.calories > goals.calories
                              ? theme.red + 'AA'
                              : e.calories > 0
                                ? theme.accent + '60'
                                : theme.gray5
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* C2.1 — Weekly averages */}
            {weeklyReport && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: theme.gray2 }}>Ср. калории</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>
                      {weeklyReport.avgCalories} ккал
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: theme.gray2 }}>Ср. белки</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>
                      {weeklyReport.avgProtein}г
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: theme.gray2 }}>Ср. жиры</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>
                      {weeklyReport.avgFat}г
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: theme.gray2 }}>Ср. углеводы</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>
                      {weeklyReport.avgCarbs}г
                    </div>
                  </div>
                </div>
                {weeklyReport.bestDay && (
                  <div style={{ fontSize: 10, marginTop: 8, color: theme.green }}>
                    Лучший день: {weeklyReport.bestDay.label} ({weeklyReport.bestDay.calories} ккал)
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {/* ── Date navigation ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 16px", paddingTop: 8 }}>
        <button
          onClick={() => setDate(d => shiftDate(d, -1))}
          style={{ padding: "8px 16px", fontSize: 14, fontWeight: 500, color: theme.accent, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ‹ {shiftDate(date, -1).slice(5)}
        </button>
        {date !== today && (
          <button
            onClick={() => setDate(today)}
            style={{ fontSize: 12, padding: "4px 12px", borderRadius: 9999, background: theme.accent + '18', color: theme.accent, border: 'none', cursor: 'pointer' }}
          >
            Сегодня
          </button>
        )}
        <button
          onClick={() => setDate(d => shiftDate(d, 1))}
          style={{ padding: "8px 16px", fontSize: 14, fontWeight: 500,
            color: date >= today ? theme.gray3 : theme.accent,
            background: 'none', border: 'none', cursor: 'pointer',
            pointerEvents: date >= today ? 'none' : 'auto',
          }}
        >
          {shiftDate(date, 1).slice(5)} ›
        </button>
      </div>

      {/* ── C1.2: Goal sheet ── */}
      </>)}

      {showGoalSheet && (
        <GoalSheet
          goals={goals}
          theme={theme}
          onSave={() => { setShowGoalSheet(false); load(); }}
          onClose={() => setShowGoalSheet(false)}
        />
      )}

      {/* ── ConfirmSheet for deleting items ── */}
      <ConfirmSheet
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Удалить продукт?"
        message="Эта запись будет удалена"
        confirmLabel="Удалить"
        onConfirm={executeRemoveItem}
        theme={theme}
      />

      {/* ── ActionSheet for meal add ── */}
      <ActionSheet
        open={!!activeActionMeal}
        onClose={() => setActiveActionMeal(null)}
        title={`Добавить в ${MEALS.find(m => m.key === activeActionMeal)?.label || ''}`}
        theme={theme}
        actions={[
          { icon: '🔍', label: 'Поиск продукта', action: () => onOpenSearch?.(activeActionMeal) },
          { icon: '📷', label: 'Фото еды', action: () => onOpenSearch?.(activeActionMeal, 'photo') },
          { icon: '📊', label: 'Сканировать штрихкод', action: () => onOpenSearch?.(activeActionMeal, 'barcode') },
          { icon: '✏️', label: 'Ввести вручную', action: () => onOpenSearch?.(activeActionMeal, 'manual') },
          {
            icon: '📋', label: 'Из шаблона', action: async () => {
              const presets = await getMealPresets();
              if (!presets.length) { showToast('Нет сохранённых шаблонов'); return; }
              setPresetOptions(presets.map(p => ({ value: p.id, label: p.name, icon: '📋' })));
              setPresetPickMeal(activeActionMeal);
            }
          },
        ]}
      />

      {/* InputSheet: save preset name */}
      <InputSheet
        open={!!presetSaveMeal}
        onClose={() => setPresetSaveMeal(null)}
        title="Название шаблона"
        placeholder="Например: Мой завтрак"
        submitLabel="Сохранить"
        onSubmit={async (name) => {
          const mealKey = presetSaveMeal;
          const mealLogs = meals.filter(m => m.meal_type === mealKey);
          const items = mealLogs.flatMap(l => l.items || []);
          await saveMealPreset(name, items);
          showToast('⭐ Шаблон сохранён');
        }}
        theme={theme}
      />

      {/* SelectSheet: pick preset */}
      <SelectSheet
        open={!!presetPickMeal}
        onClose={() => setPresetPickMeal(null)}
        title="Выберите шаблон"
        options={presetOptions}
        onSelect={async (presetId) => {
          const count = await applyMealPreset(presetId, date, presetPickMeal);
          showToast(`📋 Добавлено ${count} позиций`);
          load();
        }}
        theme={theme}
      />
    </div>
  );
}
