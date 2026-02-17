/**
 * DashboardGrid — Динамическая 2-колоночная сетка виджетов.
 * Long press → jiggle mode → drag to reorder (iOS style).
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import BudgetWidget from './widgets/BudgetWidget';
import TasksWidget from './widgets/TasksWidget';
import NutritionWidget from './widgets/NutritionWidget';
import WaterWidget from './widgets/WaterWidget';
import SportWidget from './widgets/SportWidget';
import WeightWidget from './widgets/WeightWidget';
import PaymentsWidget from './widgets/PaymentsWidget';
import PortfolioWidget from './widgets/PortfolioWidget';
import SleepWidget from './widgets/SleepWidget';
import RoutinesWidget from './widgets/RoutinesWidget';
import GoalsWidget from './widgets/GoalsWidget';
import DocumentsWidget from './widgets/DocumentsWidget';
import AnomaliesWidget from './widgets/AnomaliesWidget';
import { haptic } from '../../utils/ios';

const WIDGET_COMPONENTS = {
  budget:     BudgetWidget,
  tasks:      TasksWidget,
  nutrition:  NutritionWidget,
  water:      WaterWidget,
  sport:      SportWidget,
  weight:     WeightWidget,
  payments:   PaymentsWidget,
  portfolio:  PortfolioWidget,
  sleep:      SleepWidget,
  routines:   RoutinesWidget,
  goals:      GoalsWidget,
  documents:  DocumentsWidget,
  anomalies:  AnomaliesWidget,
};

const LONG_PRESS_MS = 500;

export default function DashboardGrid({ config, theme, onNavigate, dashboardData, onReorder }) {
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [localOrder, setLocalOrder] = useState(null);

  const gridRef = useRef(null);
  const rectsRef = useRef({});
  const longPressTimer = useRef(null);
  const touchStartPos = useRef(null);

  const sorted = (localOrder || config)
    .filter(c => c.visible)
    .sort((a, b) => a.order - b.order);

  // Reset localOrder when config changes externally
  useEffect(() => { setLocalOrder(null); }, [config]);

  // Capture widget rects
  const captureRects = useCallback(() => {
    if (!gridRef.current) return;
    const rects = {};
    gridRef.current.querySelectorAll('[data-wid]').forEach(el => {
      rects[el.dataset.wid] = el.getBoundingClientRect();
    });
    rectsRef.current = rects;
  }, []);

  // ── Long press handlers ──
  const handleTouchStart = useCallback((e, itemId) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    longPressTimer.current = setTimeout(() => {
      haptic?.('medium');
      captureRects();
      setDragOffset({ x: 0, y: 0 });
      setEditing(true);
      setDragId(itemId);
      setLocalOrder([...config]);
    }, LONG_PRESS_MS);
  }, [config, captureRects]);

  const handleTouchMove = useCallback((e) => {
    const touch = e.touches[0];

    // Cancel long press if moved too far
    if (longPressTimer.current && touchStartPos.current) {
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    if (!dragId || !touchStartPos.current) return;
    e.preventDefault();

    const dx = touch.clientX - touchStartPos.current.x;
    const dy = touch.clientY - touchStartPos.current.y;
    setDragOffset({ x: dx, y: dy });

    // Find drop target
    const cx = touch.clientX;
    const cy = touch.clientY;
    let closestId = null;
    let closestDist = Infinity;

    for (const [id, rect] of Object.entries(rectsRef.current)) {
      if (id === dragId) continue;
      const midX = rect.left + rect.width / 2;
      const midY = rect.top + rect.height / 2;
      const dist = Math.sqrt((cx - midX) ** 2 + (cy - midY) ** 2);
      if (dist < closestDist && dist < rect.width) {
        closestDist = dist;
        closestId = id;
      }
    }

    if (closestId) {
      setLocalOrder(prev => {
        if (!prev) return prev;
        const items = [...prev];
        const dragIdx = items.findIndex(i => i.id === dragId);
        const dropIdx = items.findIndex(i => i.id === closestId);
        if (dragIdx === -1 || dropIdx === -1 || dragIdx === dropIdx) return prev;

        const [moved] = items.splice(dragIdx, 1);
        items.splice(dropIdx, 0, moved);
        const reordered = items.map((item, i) => ({ ...item, order: i }));
        requestAnimationFrame(captureRects);
        return reordered;
      });
    }
  }, [dragId, captureRects]);

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;

    if (dragId && localOrder) {
      setDragId(null);
      setDragOffset({ x: 0, y: 0 });
      onReorder?.(localOrder);
    }
  }, [dragId, localOrder, onReorder]);

  const exitEditing = useCallback(() => {
    setEditing(false);
    setDragId(null);
    setLocalOrder(null);
  }, []);

  useEffect(() => () => clearTimeout(longPressTimer.current), []);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <span style={{ fontSize: 40 }}>📱</span>
        <div className="text-sm font-medium mt-3" style={{ color: theme.text }}>Все виджеты скрыты</div>
        <div className="text-xs mt-1" style={{ color: theme.gray2 }}>
          Нажмите ⚙️ Настроить, чтобы выбрать виджеты
        </div>
      </div>
    );
  }

  // Pack into rows
  const rows = [];
  let currentRow = [];
  let currentCols = 0;
  for (const item of sorted) {
    const cols = item.size === 'wide' ? 2 : 1;
    if (currentCols + cols > 2) {
      rows.push(currentRow);
      currentRow = [item];
      currentCols = cols;
    } else {
      currentRow.push(item);
      currentCols += cols;
    }
  }
  if (currentRow.length) rows.push(currentRow);

  return (
    <div ref={gridRef} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {editing && (
        <style>{`
          @keyframes jiggle {
            0% { transform: rotate(-0.7deg); }
            50% { transform: rotate(0.7deg); }
            100% { transform: rotate(-0.7deg); }
          }
          .widget-jiggle { animation: jiggle 0.25s ease-in-out infinite; }
        `}</style>
      )}

      {editing && (
        <div className="flex justify-end mb-2">
          <button
            onClick={exitEditing}
            className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: theme.accent, color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            Готово
          </button>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row, ri) => (
          <div key={ri} className="grid grid-cols-2 gap-3">
            {row.map(item => {
              const W = WIDGET_COMPONENTS[item.id];
              if (!W) return null;
              const isDragging = dragId === item.id;

              return (
                <div
                  key={item.id}
                  data-wid={item.id}
                  className={`${item.size === 'wide' ? 'col-span-2' : 'col-span-1'} ${editing && !isDragging ? 'widget-jiggle' : ''}`}
                  onTouchStart={(e) => handleTouchStart(e, item.id)}
                  style={{
                    position: 'relative',
                    zIndex: isDragging ? 100 : 1,
                    transform: isDragging ? `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(1.05)` : undefined,
                    transition: isDragging ? 'none' : 'transform 0.2s ease',
                    opacity: isDragging ? 0.9 : 1,
                    boxShadow: isDragging ? '0 12px 40px rgba(0,0,0,0.2)' : undefined,
                    borderRadius: 20,
                    pointerEvents: editing && !isDragging ? 'none' : undefined,
                  }}
                >
                  <W
                    theme={theme}
                    size={item.size}
                    onNavigate={editing ? undefined : onNavigate}
                    data={dashboardData}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
