/**
 * DishBuilder — Создание «моих блюд» из продуктов.
 */
import { useState } from 'react';
import NavHeader from '../../components/NavHeader';
import { searchProducts, getRecentProducts } from '../../services/products';
import { createDish } from '../../services/dishes';
import IOSKeyboardSpacer from '../../components/IOSKeyboardSpacer';
import ScreenWrapper from '../../components/ScreenWrapper';
import FormInput from '../../components/FormInput';

export default function DishBuilder({ theme, onBack }) {
  const [name, setName] = useState('');
  const [items, setItems] = useState([]);
  const [searchMode, setSearchMode] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recentProducts, setRecentProducts] = useState([]);
  const [saving, setSaving] = useState(false);

  const totals = items.reduce(
    (acc, i) => ({
      calories: acc.calories + (i.calories || 0),
      protein: acc.protein + (i.protein || 0),
      fat: acc.fat + (i.fat || 0),
      carbs: acc.carbs + (i.carbs || 0),
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const handleSearch = async (q) => {
    setQuery(q);
    if (q.length < 2) {
      const r = await getRecentProducts(10);
      setRecentProducts(r);
      setSearchResults([]);
      return;
    }
    const results = await searchProducts(q);
    setSearchResults(results);
  };

  const handleAddProduct = (product, grams = 100) => {
    const factor = grams / 100;
    setItems(prev => [...prev, {
      product_id: product.id || null,
      name: product.name,
      amount_g: grams,
      calories: Math.round((product.calories_100 || 0) * factor),
      protein: Math.round((product.protein_100 || 0) * factor * 10) / 10,
      fat: Math.round((product.fat_100 || 0) * factor * 10) / 10,
      carbs: Math.round((product.carbs_100 || 0) * factor * 10) / 10,
    }]);
    setSearchMode(false);
    setQuery('');
  };

  const handleRemoveItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateGrams = (index, grams) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      // Нужен product для пересчёта — сохраняем пропорцию из текущих значений
      const ratio = grams / (item.amount_g || 100);
      return {
        ...item,
        amount_g: grams,
        calories: Math.round((item.calories / (item.amount_g / 100)) * (grams / 100)),
        protein: Math.round((item.protein / (item.amount_g / 100)) * (grams / 100) * 10) / 10,
        fat: Math.round((item.fat / (item.amount_g / 100)) * (grams / 100) * 10) / 10,
        carbs: Math.round((item.carbs / (item.amount_g / 100)) * (grams / 100) * 10) / 10,
      };
    }));
  };

  const handleSave = async () => {
    if (!name.trim() || items.length === 0 || saving) return;
    setSaving(true);
    try {
      await createDish(name.trim(), items);
      onBack?.();
    } finally {
      setSaving(false);
    }
  };

  // ─── Поиск продукта для добавления ────────
  if (searchMode) {
    return (
      <ScreenWrapper theme={theme}>
        <NavHeader title="Добавить продукт" onBack={() => setSearchMode(false)} theme={theme} />
        <div className="px-4 space-y-3 pt-2">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Поиск продукта..."
            autoFocus
            className="w-full py-2.5 px-4 rounded-xl text-sm"
            style={{ background: theme.gray6, color: theme.text, border: 'none', outline: 'none' }}
          />

          {(query.length >= 2 ? searchResults : recentProducts).map((p, i) => (
            <button
              key={p.id || i}
              onClick={() => handleAddProduct(p)}
              className="w-full flex justify-between items-center px-4 py-3 rounded-2xl text-left"
              style={{ background: theme.card, border: 'none', cursor: 'pointer' }}
            >
              <span className="text-sm" style={{ color: theme.text }}>{p.name}</span>
              <span className="text-xs" style={{ color: theme.gray1 }}>{p.calories_100} ккал/100г</span>
            </button>
          ))}
        </div>
      </ScreenWrapper>
    );
  }

  // ─── Основной экран построения блюда ──────
  return (
    <ScreenWrapper theme={theme}>
      <NavHeader title="Новое блюдо" onBack={onBack} theme={theme} />

      <div className="px-4 space-y-4 pt-2">
        {/* Название блюда */}
        <div className="rounded-2xl p-4" style={{ background: theme.card }}>
          <FormInput value={name} onChange={setName} placeholder="Название блюда" theme={theme} />
        </div>

        {/* Ингредиенты */}
        <div className="rounded-2xl overflow-hidden" style={{ background: theme.card }}>
          <div className="px-4 py-2 text-xs font-semibold uppercase" style={{ color: theme.gray1 }}>
            Ингредиенты
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center px-4 py-2.5 border-t gap-2" style={{ borderColor: theme.gray5 }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: theme.text }}>{item.name}</div>
                <div className="text-xs" style={{ color: theme.gray2 }}>{item.calories} ккал</div>
              </div>
              <input
                type="number"
                inputMode="numeric"
                value={item.amount_g}
                onChange={e => handleUpdateGrams(idx, parseInt(e.target.value) || 0)}
                className="w-16 text-center text-sm py-1 rounded-xl"
                style={{ background: theme.gray6, color: theme.text, border: 'none', outline: 'none' }}
              />
              <span className="text-xs" style={{ color: theme.gray2 }}>г</span>
              <button
                onClick={() => handleRemoveItem(idx)}
                className="text-sm ml-1"
                style={{ color: theme.red, background: 'none', border: 'none', cursor: 'pointer' }}
              >✕</button>
            </div>
          ))}
          <button
            onClick={() => { setSearchMode(true); handleSearch(''); }}
            className="w-full py-3 text-sm font-medium"
            style={{ color: theme.accent, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ＋ Добавить продукт
          </button>
        </div>

        {/* Итого */}
        {items.length > 0 && (
          <div className="rounded-2xl p-4 text-center" style={{ background: theme.card }}>
            <div className="text-xl font-bold" style={{ color: theme.text }}>{totals.calories} ккал</div>
            <div className="text-sm mt-1" style={{ color: theme.gray1 }}>
              Б {totals.protein} · Ж {totals.fat} · У {totals.carbs}
            </div>
          </div>
        )}

        {/* Сохранить */}
        <button
          onClick={handleSave}
          disabled={!name.trim() || items.length === 0 || saving}
          className="w-full py-3.5 rounded-xl text-base font-semibold"
          style={{
            background: name.trim() && items.length > 0 ? theme.accent : theme.gray4,
            color: '#fff', border: 'none',
            cursor: name.trim() && items.length > 0 ? 'pointer' : 'default',
          }}
        >
          {saving ? 'Сохраняю...' : 'Сохранить блюдо'}
        </button>
      </div>
      <IOSKeyboardSpacer />
    </ScreenWrapper>
  );
}
