import FormInput from '../../components/FormInput';
/**
 * ShoppingList — Список покупок.
 * Quick add, авто-категоризация, чекбоксы, секция «Куплено».
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { addItem, toggleItem, deleteItem, getItems, clearChecked } from '../../services/shopping';
import ConfirmSheet from '../../components/ConfirmSheet';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';
import NavHeader from '../../components/NavHeader';
import Ic from '../../components/Icon';

export default function ShoppingList({ theme, onBack }) {
  const [unchecked, setUnchecked] = useState(new Map());
  const [checked, setChecked] = useState([]);
  const [input, setInput] = useState('');
  const inputRef = useRef();
  const [showChecked, setShowChecked] = useState(false);
  const [swipedId, setSwipedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const load = useCallback(async () => {
    const data = await getItems();
    setUnchecked(data.unchecked);
    setChecked(data.checked);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    try {
      await addItem(input.trim());
      setInput('');
      load();
    } catch (err) {
      console.error('[ShoppingList.handleAdd]', err);
    }
  };

  const handleToggle = async (id) => {
    await toggleItem(id);
    load();
  };

  const handleDelete = async (id) => {
    await deleteItem(id);
    setSwipedId(null);
    load();
  };

  const handleClearChecked = async () => {
    await clearChecked();
    load();
  };

  /* C4.3: Web Share API */
  const handleShare = async () => {
    const lines = [];
    for (const [cat, items] of unchecked.entries()) {
      lines.push(`\n${cat}:`);
      items.forEach(i => lines.push(`  ☐ ${i.name}`));
    }
    const text = `🛒 Список покупок\n${lines.join('\n')}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Список покупок', text }); } catch {}
    } else {
      await navigator.clipboard?.writeText(text);
    }
  };

  return (
    <div className="pb-4 space-y-3">
      <NavHeader title="Список покупок" onBack={onBack} theme={theme} />

      {/* Progress */}
      {(unchecked.size > 0 || checked.length > 0) && (() => {
        const totalItems = [...unchecked.values()].reduce((a, items) => a + items.length, 0) + checked.length;
        const pct = totalItems > 0 ? Math.round(checked.length / totalItems * 100) : 0;
        return (
          <div className="mx-4">
            <div className="flex justify-between mb-1">
              <span className="text-sm" style={{ color: theme.gray1 }}>
                Куплено {checked.length} из {totalItems}
              </span>
              <span className="text-sm font-semibold" style={{ color: theme.green }}>
                {pct}%
              </span>
            </div>
            <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: theme.gray5 }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: theme.green, transition: 'width 0.3s' }} />
            </div>
          </div>
        );
      })()}

      {/* Quick add */}
      <form onSubmit={handleAdd} className="mx-4 flex gap-2">
        <FormInput value={input} onChange={setInput} placeholder="Добавить продукт..." theme={theme} />
        <button
          type="submit"
          className="px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0"
          style={{
            background: input.trim() ? theme.accent : theme.gray4,
            color: '#fff', border: 'none',
            cursor: input.trim() ? 'pointer' : 'default',
          }}
        >＋</button>
        {unchecked.size > 0 && (
          <button type="button" onClick={handleShare}
            className="px-3 py-2.5 rounded-xl text-sm shrink-0"
            style={{ background: theme.gray6, color: theme.accent, border: 'none' }}>
            <Ic name="share" color={theme.accent} size={18} r={4} raw />
          </button>
        )}
      </form>

      {/* Категории с продуктами */}
      {loading ? (
        <div className="space-y-3 mx-4">
          <SkeletonCard theme={theme} />
          <SkeletonCard variant="compact" theme={theme} />
          <SkeletonCard variant="compact" theme={theme} />
        </div>
      ) : [...unchecked.entries()].map(([category, items]) => (
        <div key={category} className="mx-4">
          <div className="text-xs font-semibold uppercase tracking-wider mb-1.5 px-1" style={{ color: theme.gray1 }}>
            {category}
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ background: theme.card }}>
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  borderTop: idx > 0 ? `0.5px solid ${theme.gray5}` : 'none',
                }}
              >
                <button
                  onClick={() => handleToggle(item.id)}
                  className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center"
                  style={{ borderColor: theme.gray3, background: 'none', cursor: 'pointer', padding: 0 }}
                />
                <span
                  className="flex-1 text-sm"
                  style={{ color: theme.text }}
                  onClick={() => setSwipedId(swipedId === item.id ? null : item.id)}
                >
                  {item.name}
                  {item.quantity && (
                    <span className="ml-2 text-xs" style={{ color: theme.gray2 }}>{item.quantity}</span>
                  )}
                </span>
                {swipedId === item.id && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-xs px-2 py-1 rounded-xl"
                    style={{ background: theme.red, color: '#fff', border: 'none', cursor: 'pointer' }}
                  >
                    Удалить
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Пусто */}
      {!loading && unchecked.size === 0 && checked.length === 0 && (
        <div className="mx-4">
          <EmptyState
            icon={<Ic name="cart" color={theme.accent} size={48} r={14} />}
            title="Список пуст"
            subtitle="Добавьте продукты для покупки"
            tip="AI может добавить продукты — скажите «купить молоко»"
            actionLabel="＋ Добавить"
            onAction={() => inputRef.current?.focus()}
            theme={theme}
          />
        </div>
      )}

      {/* Куплено */}
      {checked.length > 0 && (
        <div className="mx-4">
          <button
            onClick={() => setShowChecked(!showChecked)}
            className="flex items-center gap-2 w-full text-left mb-1.5"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
          >
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: theme.gray1, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Ic name="check" color={theme.green} size={14} r={3} raw /> Куплено ({checked.length})
            </span>
            <span className="text-xs" style={{ color: theme.gray2 }}>
              {showChecked ? '▴' : '▾'}
            </span>
          </button>

          {showChecked && (
            <>
              <div className="rounded-2xl overflow-hidden" style={{ background: theme.card }}>
                {checked.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                    style={{ borderTop: idx > 0 ? `0.5px solid ${theme.gray5}` : 'none' }}
                  >
                    <button
                      onClick={() => handleToggle(item.id)}
                      className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
                      style={{ background: theme.accent, border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <span className="text-white text-xs">✓</span>
                    </button>
                    <span
                      className="flex-1 text-sm line-through"
                      style={{ color: theme.gray2 }}
                    >{item.name}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full text-center py-2 text-xs mt-2"
                style={{ color: theme.red, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Очистить купленные
              </button>
            </>
          )}
        </div>
      )}
      {/* AI suggestion */}
      {unchecked.size > 0 && (
        <div className="mx-4 rounded-2xl overflow-hidden" style={{ background: (theme.purple || '#AF52DE') + '06' }}>
          <div className="flex items-center gap-2.5 px-4 py-3">
            <Ic name="bot" color={theme.purple || '#AF52DE'} size={28} r={8} />
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: theme.text }}>
                Добавить из плана питания?
              </div>
              <div className="text-xs" style={{ color: theme.gray2 }}>
                На следующие 3 дня может не хватить продуктов
              </div>
            </div>
            <span className="text-sm font-medium" style={{ color: theme.accent }}>＋</span>
          </div>
        </div>
      )}

      <ConfirmSheet
        open={!!showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Очистить купленные?"
        message="Все отмеченные продукты будут удалены из списка"
        confirmLabel="Очистить"
        onConfirm={handleClearChecked}
        theme={theme}
      />
    </div>
  );
}
