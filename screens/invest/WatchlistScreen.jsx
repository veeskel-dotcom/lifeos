import { useState, useEffect, useRef } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import ConfirmSheet from '../../components/ConfirmSheet';
import SkeletonCard from '../../components/SkeletonCard';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '../../services/watchlist';
import { getAlerts, addAlert, deleteAlert } from '../../services/priceAlerts';
import { fmtMoney } from '../../utils/currency';
import FormInput from '../../components/FormInput';

export default function WatchlistScreen({ theme, onBack }) {
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [ticker, setTicker] = useState('');
  const [alertTicker, setAlertTicker] = useState(null);
  const [alertPrice, setAlertPrice] = useState('');
  const [alertDir, setAlertDir] = useState('above');
  const [loading, setLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [confirmDeleteAlert, setConfirmDeleteAlert] = useState(null);

  const load = async () => {
    try {
      const list = await getWatchlist();
      setItems(list);
      const allAlerts = await getAlerts();
      setAlerts(allAlerts);
    } catch {
      setItems([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    await addToWatchlist(t);
    setTicker('');
    setShowAdd(false);
    load();
  };

  const handleRemove = async (t) => {
    await removeFromWatchlist(t);
    load();
  };

  const handleAddAlert = async () => {
    const price = parseFloat(alertPrice);
    if (!alertTicker || !price || price <= 0) return;
    await addAlert(alertTicker, price, alertDir);
    setAlertTicker(null);
    setAlertPrice('');
    load();
  };

  const handleDeleteAlert = async () => {
    if (confirmDeleteAlert) {
      await deleteAlert(confirmDeleteAlert);
      setConfirmDeleteAlert(null);
      load();
    }
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Отслеживаемые" onBack={onBack} left="Инвестиции" theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {/* Добавить тикер */}
        {showAdd ? (
          <Card theme={theme}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: theme.gray1 }}>
              Добавить тикер
            </div>
            <div className="flex gap-2">
              <FormInput value={ticker} onChange={setTicker} placeholder="SBER" autoFocus theme={theme} />
              <button
                onClick={handleAdd}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: theme.accent }}
              >
                ✓
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-3 py-2.5 rounded-xl text-sm"
                style={{ color: theme.gray2 }}
              >
                ✕
              </button>
            </div>
          </Card>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full py-3 rounded-xl text-sm font-medium"
            style={{ background: theme.card, color: theme.accent, border: `1px solid ${theme.accent}30` }}
          >
            ＋ Добавить тикер
          </button>
        )}

        {/* Список */}
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard theme={theme} />
            <SkeletonCard variant="compact" theme={theme} />
            <SkeletonCard variant="compact" theme={theme} />
          </div>
        ) : items.length > 0 ? (
          <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
            {items.map((item, i) => (
              <WatchlistRow
                key={item.ticker}
                item={item}
                theme={theme}
                isLast={i === items.length - 1}
                onRemove={() => setRemoveTarget(item.ticker)}
                onAlert={() => { setAlertTicker(item.ticker); setAlertPrice(''); }}
                alertCount={alerts.filter(a => a.ticker === item.ticker && !a.is_triggered).length}
              />
            ))}
          </Card>
        ) : (
          <EmptyState
            icon="📋"
            title="Список пуст"
            subtitle="Добавьте тикеры для отслеживания"
            tip="Установите алерты 🔔 на целевые цены"
            theme={theme}
          />
        )}

        {/* E3: Active alerts */}
        {alerts.filter(a => !a.is_triggered).length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2 px-1" style={{ color: theme.gray1 }}>
              🔔 Активные алерты
            </div>
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
              {alerts.filter(a => !a.is_triggered).map((a, i, arr) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                  <div className="flex-1">
                    <span className="text-sm font-semibold" style={{ color: theme.text }}>{a.ticker}</span>
                    <span className="text-xs ml-2" style={{ color: a.direction === 'above' ? theme.green : theme.red }}>
                      {a.direction === 'above' ? '▲ выше' : '▼ ниже'} {fmtMoney(a.target_price)}
                    </span>
                  </div>
                  <button onClick={() => setConfirmDeleteAlert(a.id)}
                    className="text-xs px-2 py-1 rounded" style={{ color: theme.red, background: 'none', border: 'none' }}>
                    ✕
                  </button>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* E3: Alert creation sheet */}
        {alertTicker && (
          <Card theme={theme}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: theme.gray1 }}>
              🔔 Алерт для {alertTicker}
            </div>
            <div className="flex gap-2 mb-2">
              {['above', 'below'].map(d => (
                <button key={d} onClick={() => setAlertDir(d)}
                  className="flex-1 py-2 rounded-xl text-xs font-medium"
                  style={{
                    background: alertDir === d ? (d === 'above' ? theme.green : theme.red) + '15' : theme.gray6,
                    color: alertDir === d ? (d === 'above' ? theme.green : theme.red) : theme.gray1,
                    border: alertDir === d ? `1.5px solid ${d === 'above' ? theme.green : theme.red}` : '1.5px solid transparent',
                  }}>
                  {d === 'above' ? '▲ Выше' : '▼ Ниже'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <FormInput type="number" inputMode="decimal" value={alertPrice} onChange={setAlertPrice} placeholder="Целевая цена" autoFocus theme={theme} />
              <button onClick={handleAddAlert}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: theme.accent }}>✓</button>
              <button onClick={() => setAlertTicker(null)}
                className="px-3 py-2.5 text-sm" style={{ color: theme.gray2 }}>✕</button>
            </div>
          </Card>
        )}
      </div>
      <ConfirmSheet
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Убрать из списка?"
        message={`«${removeTarget}» будет удалён из watchlist`}
        confirmLabel="Убрать"
        onConfirm={() => handleRemove(removeTarget)}
        theme={theme}
      />
      <ConfirmSheet
        open={!!confirmDeleteAlert}
        onClose={() => setConfirmDeleteAlert(null)}
        title="Удалить алерт?"
        message="Ценовой алерт будет удалён"
        confirmLabel="Удалить"
        onConfirm={handleDeleteAlert}
        theme={theme}
      />
    </div>
  );
}

function WatchlistRow({ item, theme, isLast, onRemove, onAlert, alertCount }) {
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const swiping = useRef(false);

  const onTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    swiping.current = false;
  };
  const onTouchMove = (e) => {
    const dx = e.touches[0].clientX - startX.current;
    if (dx < -10) { swiping.current = true; setSwipeX(Math.max(dx, -80)); }
    else setSwipeX(0);
  };
  const onTouchEnd = () => {
    if (swipeX < -60) onRemove();
    setSwipeX(0);
  };

  const isUp = (item.change || 0) >= 0;

  return (
    <div className="relative overflow-hidden"
      style={{ borderBottom: !isLast ? `0.5px solid ${theme.gray5}` : 'none' }}>
      <div className="absolute inset-y-0 right-0 flex items-center px-5" style={{ background: theme.red }}>
        <span className="text-white text-sm font-semibold">Удалить</span>
      </div>
      <div
        className="flex items-center gap-3 px-4 py-3 relative"
        style={{
          background: theme.card,
          transform: `translateX(${swipeX}px)`,
          transition: swipeX === 0 ? 'transform 0.2s' : 'none',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold" style={{ color: theme.text }}>{item.ticker}</span>
            {alertCount > 0 && (
              <span className="text-[10px] px-1 rounded" style={{ background: theme.orange + '20', color: theme.orange }}>
                🔔{alertCount}
              </span>
            )}
          </div>
          <div className="text-xs" style={{ color: theme.gray2 }}>{item.name}</div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onAlert?.(); }}
          className="text-base px-1" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          🔔
        </button>
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums" style={{ color: theme.text }}>
            {item.price != null ? fmtMoney(item.price) : '—'}
          </div>
          {item.change != null && (
            <div className="text-xs tabular-nums" style={{ color: isUp ? theme.green : theme.red }}>
              {isUp ? '+' : ''}{item.change?.toFixed(1)}% {isUp ? '🟢' : '🔴'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
