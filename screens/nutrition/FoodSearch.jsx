/**
 * FoodSearch — Поиск продуктов: каскад, недавние, избранное, ввод граммов.
 * Каскад: кэш → FatSecret → Open Food Facts → AI
 */
import { useState, useEffect, useRef } from 'react';
import NavHeader from '../../components/NavHeader';
import EmptyState from '../../components/EmptyState';
import {
  searchProducts, searchByBarcode, scanBarcode,
  getRecentProducts, getFavoriteProducts,
  incrementUsage, recognizeFoodPhoto,
} from '../../services/products';
import { addMeal } from '../../services/nutrition';
import ScreenWrapper from '../../components/ScreenWrapper';
import Ic from '../../components/Icon';
import VoiceInput from '../../components/VoiceInput';

const MEAL_LABELS = {
  breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус',
};

export default function FoodSearch({ meal, date, theme, onBack, initialMode }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [recent, setRecent] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // продукт для ввода порции
  const [filter, setFilter] = useState('all');
  const [grams, setGrams] = useState(100);
  const fileRef = useRef(null);
  const barcodeRef = useRef(null);
  const searchTimer = useRef(null);

  useEffect(() => {
    (async () => {
      setRecent(await getRecentProducts(8));
      setFavorites(await getFavoriteProducts());
    })();
    // Автоматически открыть камеру если initialMode
    if (initialMode === 'photo') fileRef.current?.click();
    if (initialMode === 'barcode') barcodeRef.current?.click();
  }, [initialMode]);

  useEffect(() => {
    return () => clearTimeout(searchTimer.current);
  }, []);

  // Debounced search
  const handleQueryChange = (val) => {
    setQuery(val);
    setError('');
    clearTimeout(searchTimer.current);
    if (val.trim().length < 2) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchProducts(val);
        setResults(r.results || []);
      } catch (err) {
        setResults([]);
        setError(err.message?.includes('интернет')
          ? '📡 Поиск недоступен офлайн'
          : 'Ошибка поиска');
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  // Выбор продукта → показать ввод граммов
  const handleSelect = (product) => {
    setSelected(product);
    setGrams(100);
  };

  // Добавить в приём пищи
  const handleAdd = async () => {
    if (!selected) return;
    const factor = grams / 100;
    const item = {
      product_id: selected.id || null,
      name: selected.name,
      amount_g: grams,
      calories: Math.round((selected.calories_100 || 0) * factor),
      protein: Math.round((selected.protein_100 || 0) * factor * 10) / 10,
      fat: Math.round((selected.fat_100 || 0) * factor * 10) / 10,
      carbs: Math.round((selected.carbs_100 || 0) * factor * 10) / 10,
      fiber: Math.round((selected.fiber_100 || 0) * factor * 10) / 10,
      sugar: Math.round((selected.sugar_100 || 0) * factor * 10) / 10,
      sodium: Math.round((selected.sodium_100 || 0) * factor),
    };
    await addMeal(date, meal, [item]);
    if (selected.id) await incrementUsage(selected.id);
    onBack?.();
  };

  // Фото еды
  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await recognizeFoodPhoto(base64);
      if (result) {
        setSelected({
          name: result.name,
          calories_100: result.calories ? Math.round(result.calories / (result.amount_g || 250) * 100) : 0,
          protein_100: result.protein ? Math.round(result.protein / (result.amount_g || 250) * 1000) / 10 : 0,
          fat_100: result.fat ? Math.round(result.fat / (result.amount_g || 250) * 1000) / 10 : 0,
          carbs_100: result.carbs ? Math.round(result.carbs / (result.amount_g || 250) * 1000) / 10 : 0,
        });
        setGrams(result.amount_g || 250);
      }
    } catch (err) {
      console.error('Photo recognition failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Штрих-код
  const handleBarcode = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const code = await scanBarcode(base64);
      if (code) {
        const product = await searchByBarcode(code);
        if (product) {
          handleSelect(product);
          return;
        }
      }
      void 0;
    } catch (err) {
      console.error('Barcode scan failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Экран ввода порции ─────────────────────────────
  if (selected) {
    const factor = grams / 100;
    const cal = Math.round((selected.calories_100 || 0) * factor);
    const prot = Math.round((selected.protein_100 || 0) * factor * 10) / 10;
    const fat = Math.round((selected.fat_100 || 0) * factor * 10) / 10;
    const carb = Math.round((selected.carbs_100 || 0) * factor * 10) / 10;
    const fib = Math.round((selected.fiber_100 || 0) * factor * 10) / 10;
    const sug = Math.round((selected.sugar_100 || 0) * factor * 10) / 10;
    const sod = Math.round((selected.sodium_100 || 0) * factor);

    return (
      <ScreenWrapper theme={theme}>
        <NavHeader title={selected.name} onBack={() => setSelected(null)} theme={theme} />
        <div className="px-4 space-y-4 pt-2">
          {/* КБЖУ на 100г */}
          <div className="text-center text-sm" style={{ color: theme.gray1 }}>
            {selected.calories_100} ккал · Б {selected.protein_100} · Ж {selected.fat_100} · У {selected.carbs_100}
            <span className="text-xs ml-1">на 100г</span>
          </div>

          {/* Ввод граммов */}
          <div className="rounded-2xl p-4" style={{ background: theme.card }}>
            <label className="text-sm font-medium block mb-2" style={{ color: theme.text }}>
              Порция, г
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={grams}
              onChange={(e) => setGrams(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full text-center text-2xl font-bold py-2 rounded-xl mb-3"
              style={{
                background: theme.gray6, color: theme.text,
                border: `1px solid ${theme.gray4}`,
                outline: 'none',
              }}
            />
            {/* Slider */}
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={grams}
              onChange={(e) => setGrams(parseInt(e.target.value))}
              className="w-full"
              style={{ accentColor: theme.accent }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: theme.gray2 }}>
              <span>10г</span><span>250г</span><span>500г</span>
            </div>
          </div>

          {/* Пересчёт */}
          <div className="rounded-2xl p-4 text-center" style={{ background: theme.card }}>
            <div className="text-2xl font-bold" style={{ color: theme.text }}>{cal} ккал</div>
            <div className="text-sm mt-1" style={{ color: theme.gray1 }}>
              Б {prot} · Ж {fat} · У {carb}
            </div>
            {(fib > 0 || sug > 0 || sod > 0) && (
              <div className="text-xs mt-1" style={{ color: theme.gray2 }}>
                {fib > 0 && `Клетч. ${fib}г`}{fib > 0 && (sug > 0 || sod > 0) ? ' · ' : ''}
                {sug > 0 && `Сахар ${sug}г`}{sug > 0 && sod > 0 ? ' · ' : ''}
                {sod > 0 && `Na ${sod}мг`}
              </div>
            )}
          </div>

          {/* Кнопка */}
          <button
            onClick={handleAdd}
            className="w-full py-3.5 rounded-xl text-base font-semibold"
            style={{ background: theme.accent, color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            Добавить в {MEAL_LABELS[meal]?.toLowerCase() || meal}
          </button>
        </div>
      </ScreenWrapper>
    );
  }

  // ─── Экран поиска ───────────────────────────────────
  return (
    <ScreenWrapper theme={theme}>
      <NavHeader
        title="Добавить"
        onBack={onBack}
        left=""
        right={MEAL_LABELS[meal] || ''}
        theme={theme}
      />

      <div className="px-4 space-y-4">
        {/* Filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[
            { label: 'Все', key: 'all' },
            { label: 'Недавние', key: 'recent', ic: 'clock' },
            { label: 'Мои', key: 'favorites', ic: 'star' },
            { label: 'Блюда', key: 'dishes', ic: 'food' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter?.(f.key)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: (filter || 'all') === f.key ? theme.green + '15' : theme.gray5,
                color: (filter || 'all') === f.key ? theme.green : theme.gray2,
                border: (filter || 'all') === f.key ? `1.5px solid ${theme.green}` : '1.5px solid transparent',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >{f.ic && <Ic name={f.ic} color={(filter || 'all') === f.key ? theme.green : theme.gray2} size={14} r={3} raw />}{f.label}</button>
          ))}
        </div>

        {/* Поиск + кнопки камеры/баркода */}
        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Поиск продукта..."
              className="w-full py-2.5 px-4 pl-8 rounded-xl text-sm"
              style={{
                background: theme.gray6, color: theme.text,
                border: 'none', outline: 'none',
              }}
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: theme.gray2 }}>
              <Ic name="food" color={theme.gray2} size={16} r={4} raw />
            </span>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
            style={{ background: theme.gray5, border: 'none', cursor: 'pointer' }}
          ><Ic name="camera" color={theme.gray1} size={20} r={5} raw /></button>
          <button
            onClick={() => barcodeRef.current?.click()}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
            style={{ background: theme.gray5, border: 'none', cursor: 'pointer' }}
          ><Ic name="barcode" color={theme.gray1} size={20} r={5} raw /></button>
          <VoiceInput onResult={(text) => handleQueryChange(text)} theme={theme} autoStart={initialMode === 'voice'} />
        </div>

        {/* Скрытые файловые инпуты */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
        <input ref={barcodeRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleBarcode} />

        {/* Загрузка */}
        {loading && (
          <div className="text-center py-4 text-sm" style={{ color: theme.gray1 }}>
            Ищу...
          </div>
        )}

        {/* Результаты поиска */}
        {results.length > 0 && (
          <Section title="Результаты" theme={theme}>
            {results.map((p, i) => (
              <ProductRow key={p.id || i} product={p} theme={theme} onSelect={handleSelect} />
            ))}
          </Section>
        )}

        {/* Ошибка поиска */}
        {error && !loading && (
          <p className="text-center text-sm py-4" style={{ color: theme.gray2 }}>{error}</p>
        )}

        {/* Ничего не найдено */}
        {query.trim().length >= 2 && !loading && !error && results.length === 0 && (
          <EmptyState
            icon={<Ic name="food" color={theme.gray2} size={48} r={14} />}
            title="Ничего не найдено"
            subtitle="Попробуйте другой запрос"
            tip="Можно искать по-русски или английски. Или используйте камеру для распознавания по фото."
            actionLabel="Ввести вручную"
            onAction={() => onBack?.('manual')}
            theme={theme}
          />
        )}

        {/* Недавние */}
        {!query && recent.length > 0 && (
          <Section title="Недавние" theme={theme}>
            {recent.map(p => (
              <ProductRow key={p.id} product={p} theme={theme} onSelect={handleSelect} />
            ))}
          </Section>
        )}

        {/* Избранное */}
        {!query && favorites.length > 0 && (
          <Section title="Избранное" theme={theme}>
            {favorites.map(p => (
              <ProductRow key={p.id} product={p} theme={theme} onSelect={handleSelect} />
            ))}
          </Section>
        )}

        {/* Внизу: кнопки ручного ввода */}
        {!loading && (
          <div className="space-y-2 pt-2">
            <button
              onClick={() => onBack?.('manual')}
              className="w-full py-3 rounded-xl text-sm font-medium text-center"
              style={{ border: `1.5px dashed ${theme.gray3}`, background: 'none', color: theme.gray2, cursor: 'pointer' }}
            >
              ＋ Создать свой продукт
            </button>
          </div>
        )}
      </div>
    </ScreenWrapper>
  );
}

// ─── Sub-components ─────────────────────────────────────

function Section({ title, theme, children }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: theme.gray1 }}>
        {title}
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: theme.card }}>
        {children}
      </div>
    </div>
  );
}

function ProductRow({ product, theme, onSelect }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: `0.5px solid ${theme.gray5}` }}
    >
      <div className="flex-1 min-w-0" onClick={() => onSelect(product)} style={{ cursor: 'pointer' }}>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate" style={{ color: theme.text }}>{product.name}</span>
          {product.is_custom && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
              style={{ background: (theme.purple || '#AF52DE') + '10', color: theme.purple || '#AF52DE' }}>Моё</span>
          )}
        </div>
        {product.brand && (
          <div className="text-xs" style={{ color: theme.gray2 }}>{product.brand} · 100 г</div>
        )}
        <div className="flex gap-2 mt-0.5 text-[11px]">
          <span style={{ fontWeight: 600, color: theme.orange }}>{product.calories_100 || '?'} ккал</span>
          <span style={{ color: theme.gray2 }}>Б <b style={{ color: theme.red }}>{product.protein_100 || '?'}</b></span>
          <span style={{ color: theme.gray2 }}>Ж <b style={{ color: theme.orange }}>{product.fat_100 || '?'}</b></span>
          <span style={{ color: theme.gray2 }}>У <b style={{ color: theme.accent }}>{product.carbs_100 || '?'}</b></span>
        </div>
      </div>
      <button
        onClick={() => onSelect(product)}
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ background: theme.green, border: 'none', cursor: 'pointer' }}
      >
        <span className="text-white text-lg font-bold leading-none">+</span>
      </button>
    </div>
  );
}

// ─── Utility ────────────────────────────────────────────

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
