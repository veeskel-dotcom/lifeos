/**
 * DashboardEditor — Экран настройки дашборда.
 * ▲▼ перемещение, toggle видимости, select размера.
 * Без DnD-библиотек.
 */
import { useState, useCallback } from 'react';
import NavHeader from '../../components/NavHeader';
import { WIDGETS, WIDGET_COLORS } from './widgetRegistry';
import ScreenWrapper from '../../components/ScreenWrapper';
import Ic from '../../components/Icon';

export default function DashboardEditor({ config, onSave, onBack, theme }) {
  const [items, setItems] = useState(() => [...config].sort((a, b) => a.order - b.order));

  const widgetMap = Object.fromEntries(WIDGETS.map(w => [w.id, w]));

  const move = useCallback((idx, dir) => {
    setItems(prev => {
      const next = [...prev];
      const item = next[idx];
      // Find next item with same visibility in the given direction
      let target = idx + dir;
      while (target >= 0 && target < next.length && next[target].visible !== item.visible) {
        target += dir;
      }
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((it, i) => ({ ...it, order: i }));
    });
  }, []);

  const toggleVisible = useCallback((idx) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], visible: !next[idx].visible };
      return next;
    });
  }, []);

  const changeSize = useCallback((idx, newSize) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], size: newSize };
      return next;
    });
  }, []);

  const handleSave = () => {
    onSave(items.map((item, i) => ({ ...item, order: i })));
    onBack();
  };

  const visible = items.filter(i => i.visible);
  const hidden = items.filter(i => !i.visible);

  return (
    <ScreenWrapper theme={theme}>
      <NavHeader
        title="Настройка дашборда"
        theme={theme}
        onBack={onBack}
        rightAction={{ label: 'Готово', onClick: handleSave }}
      />

      <div className="px-4 pb-8">
        {/* Visible widgets */}
        <div className="mt-2">
          {visible.map((item) => {
            const idx = items.indexOf(item);
            const w = widgetMap[item.id];
            if (!w) return null;
            return (
              <WidgetRow
                key={item.id}
                item={item}
                widget={w}
                idx={idx}
                total={items.length}
                theme={theme}
                onMove={move}
                onToggle={toggleVisible}
                onChangeSize={changeSize}
              />
            );
          })}
        </div>

        {/* Divider */}
        {hidden.length > 0 && (
          <>
            <div className="flex items-center gap-3 my-4 px-2">
              <div className="flex-1 border-t border-dashed" style={{ borderColor: theme.gray4 }} />
              <span className="text-xs" style={{ color: theme.gray2 }}>Скрытые</span>
              <div className="flex-1 border-t border-dashed" style={{ borderColor: theme.gray4 }} />
            </div>

            {hidden.map((item) => {
              const idx = items.indexOf(item);
              const w = widgetMap[item.id];
              if (!w) return null;
              return (
                <WidgetRow
                  key={item.id}
                  item={item}
                  widget={w}
                  idx={idx}
                  total={items.length}
                  theme={theme}
                  onMove={move}
                  onToggle={toggleVisible}
                  onChangeSize={changeSize}
                  isHidden
                />
              );
            })}
          </>
        )}
      </div>
    </ScreenWrapper>
  );
}

function WidgetRow({ item, widget, idx, total, theme, onMove, onToggle, onChangeSize, isHidden }) {
  const sizes = widget.sizes || ['small'];
  const hasMultipleSizes = sizes.length > 1;

  return (
    <div
      className="flex items-center gap-2 py-3 px-3 mb-1.5"
      style={{
        background: theme.card,
        borderRadius: 14,
        opacity: isHidden ? 0.5 : 1,
      }}
    >
      {/* Reorder buttons */}
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => onMove(idx, -1)}
          disabled={idx === 0}
          className="text-xs leading-none"
          style={{
            color: idx === 0 ? theme.gray4 : theme.gray1,
            background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer',
            padding: '2px 4px',
          }}
        >
          ▲
        </button>
        <button
          type="button"
          onClick={() => onMove(idx, 1)}
          disabled={idx === total - 1}
          className="text-xs leading-none"
          style={{
            color: idx === total - 1 ? theme.gray4 : theme.gray1,
            background: 'none', border: 'none', cursor: idx === total - 1 ? 'default' : 'pointer',
            padding: '2px 4px',
          }}
        >
          ▼
        </button>
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {widget.iconName && <Ic name={widget.iconName} color={WIDGET_COLORS[widget.id]?.(theme) || theme.accent} size={24} r={7} />}
        <span className="text-sm font-medium" style={{ color: theme.text }}>{widget.name}</span>
      </div>

      {/* Size picker */}
      {item.visible && hasMultipleSizes && (
        <button
          onClick={() => onChangeSize(idx, item.size === 'wide' ? 'small' : 'wide')}
          className="text-xs rounded-lg px-2.5 py-1 active:opacity-70"
          style={{
            background: theme.bg,
            color: theme.text,
            border: `1px solid ${theme.gray4}`,
            cursor: 'pointer',
          }}
        >
          {item.size === 'wide' ? '▬ Широкий' : '▪ Малый'}
        </button>
      )}

      {/* Toggle visibility */}
      <button
        type="button"
        onClick={() => onToggle(idx)}
        className="text-sm shrink-0"
        style={{
          color: item.visible ? theme.red : theme.green,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 8px',
          fontWeight: 600,
        }}
      >
        {item.visible ? '−' : '+'}
      </button>
    </div>
  );
}
