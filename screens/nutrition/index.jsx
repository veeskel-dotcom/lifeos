/**
 * Nutrition index — Роутер модуля Еда.
 * Sub-табы: [Дневник] [Блюда] [Покупки]
 * Оверлеи: FoodSearch, FoodManualEntry, DishBuilder
 */
import { useState } from 'react';
import NutritionDiary from './NutritionDiary';
import FoodSearch from './FoodSearch';
import FoodManualEntry from './FoodManualEntry';
import DishBuilder from './DishBuilder';
import ShoppingList from './ShoppingList';
import MealDetail from './MealDetail';
import AICalories from './AICalories';
import { getDishes, toggleDishFavorite, deleteDish } from '../../services/dishes';
import ScreenWrapper from '../../components/ScreenWrapper';
import ConfirmSheet from '../../components/ConfirmSheet';
import SkeletonCard from '../../components/SkeletonCard';

const SUB_TABS = [
  { key: 'diary', label: 'Дневник' },
  { key: 'dishes', label: 'Блюда' },
  { key: 'shopping', label: 'Покупки' },
];

export default function NutritionScreen({ theme }) {
  const [subTab, setSubTab] = useState('diary');
  const [overlay, setOverlay] = useState(null);
  // overlay: null | { type: 'search', meal, mode? } | { type: 'manual', meal } | { type: 'dish' }

  const today = new Date().toISOString().slice(0, 10);

  const handleOpenSearch = (meal, mode) => {
    setOverlay({ type: 'search', meal, mode: mode || null });
  };

  const handleSearchBack = (action) => {
    if (action === 'manual') {
      const meal = overlay?.meal;
      setOverlay({ type: 'manual', meal });
    } else {
      setOverlay(null);
    }
  };

  // ─── Оверлеи (полноэкранные) ────────────────────────
  if (overlay?.type === 'search') {
    return (
      <FoodSearch
        meal={overlay.meal}
        date={today}
        theme={theme}
        onBack={handleSearchBack}
        initialMode={overlay.mode}
      />
    );
  }

  if (overlay?.type === 'manual') {
    return (
      <FoodManualEntry
        meal={overlay.meal}
        date={today}
        theme={theme}
        onBack={() => setOverlay(null)}
      />
    );
  }

  if (overlay?.type === 'dish') {
    return (
      <DishBuilder
        theme={theme}
        onBack={() => setOverlay(null)}
      />
    );
  }

  if (overlay?.type === 'mealDetail') {
    return (
      <MealDetail
        mealType={overlay.mealType}
        date={overlay.date || today}
        theme={theme}
        onBack={() => setOverlay(null)}
        onAddFood={(meal) => setOverlay({ type: 'search', meal })}
      />
    );
  }

  if (overlay?.type === 'aiCalories') {
    return (
      <AICalories
        theme={theme}
        onBack={() => setOverlay(null)}
      />
    );
  }

  // ─── Основной экран с суб-табами ─────────────────────
  return (
    <ScreenWrapper theme={theme}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-xl font-bold" style={{ color: theme.text }}>Питание</span>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mx-4 mt-1 p-1 rounded-xl" style={{ background: theme.gray6 }}>
        {SUB_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className="flex-1 py-2 text-sm font-medium transition-all"
            style={{
              background: subTab === tab.key ? theme.card : 'transparent',
              color: subTab === tab.key ? theme.text : theme.gray2,
              border: 'none',
              cursor: 'pointer',
              borderRadius: 10,
              boxShadow: subTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-3">
        {subTab === 'diary' && (
          <NutritionDiary
            theme={theme}
            onOpenSearch={handleOpenSearch}
          />
        )}

        {subTab === 'dishes' && (
          <DishesTab theme={theme} onCreateDish={() => setOverlay({ type: 'dish' })} />
        )}

        {subTab === 'shopping' && (
          <ShoppingList theme={theme} />
        )}
      </div>
    </ScreenWrapper>
  );
}

// ─── Dishes sub-tab ─────────────────────────────────────

function DishesTab({ theme, onCreateDish }) {
  const [dishes, setDishes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleDeleteDish = async () => {
    if (confirmDelete) {
      await deleteDish(confirmDelete);
      const d = await getDishes();
      setDishes(d);
      setConfirmDelete(null);
    }
  };

  if (!loaded) {
    getDishes().then(d => { setDishes(d); setLoaded(true); });
    return (
      <div className="px-4 pt-2 space-y-3">
        <SkeletonCard theme={theme} />
        <SkeletonCard variant="compact" theme={theme} />
        <SkeletonCard variant="compact" theme={theme} />
      </div>
    );
  }

  return (
    <div className="pb-4 space-y-3">
      <div className="flex items-center justify-between mx-4">
        <span className="text-xl font-bold" style={{ color: theme.text }}>Мои блюда</span>
        <button
          onClick={onCreateDish}
          className="text-sm font-medium px-3 py-1.5 rounded-xl"
          style={{ background: theme.accent, color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          ＋ Новое
        </button>
      </div>

      {dishes.length === 0 && loaded && (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="text-5xl mb-4">🍳</div>
          <div className="text-lg font-bold mb-2" style={{ color: theme.text }}>Нет блюд</div>
          <div className="text-sm mb-6" style={{ color: theme.gray1 }}>Создайте первое блюдо из продуктов</div>
          <button
            onClick={onCreateDish}
            className="px-6 py-3 rounded-xl text-white font-semibold"
            style={{ background: theme.accent, border: 'none', cursor: 'pointer' }}
          >＋ Блюдо</button>
        </div>
      )}

      {dishes.map(dish => (
        <div key={dish.id} className="mx-4 rounded-2xl p-4" style={{ background: theme.card }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold" style={{ color: theme.text }}>
                {dish.is_favorite && '⭐ '}{dish.name}
              </div>
              <div className="text-xs mt-0.5" style={{ color: theme.gray1 }}>
                {dish.total_calories} ккал · Б {dish.total_protein} · Ж {dish.total_fat} · У {dish.total_carbs}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await toggleDishFavorite(dish.id);
                  const d = await getDishes();
                  setDishes(d);
                }}
                className="text-sm"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {dish.is_favorite ? '⭐' : '☆'}
              </button>
              <button
                onClick={() => setConfirmDelete(dish.id)}
                className="text-sm"
                style={{ color: theme.red, background: 'none', border: 'none', cursor: 'pointer' }}
              >✕</button>
            </div>
          </div>
          {/* Ингредиенты */}
          <div className="mt-2 flex flex-wrap gap-1">
            {dish.items?.map((item, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: theme.gray5, color: theme.gray1 }}>
                {item.name} {item.amount_g}г
              </span>
            ))}
          </div>
        </div>
      ))}
      <ConfirmSheet
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Удалить блюдо?"
        message="Блюдо будет удалено"
        confirmLabel="Удалить"
        onConfirm={handleDeleteDish}
        theme={theme}
      />
    </div>
  );
}
