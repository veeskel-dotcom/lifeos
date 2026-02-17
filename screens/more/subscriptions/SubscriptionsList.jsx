import { useState, useEffect, useCallback } from 'react';
import Card from '../../../components/Card';
import NavHeader from '../../../components/NavHeader';
import ChipBar from '../../../components/ChipBar';
import EmptyState from '../../../components/EmptyState';
import ConfirmSheet from '../../../components/ConfirmSheet';
import SkeletonCard from '../../../components/SkeletonCard';
import { fmtMoney } from '../../../utils/currency';
import {
  getMonthlyTotal,
  getYearlyTotal,
  getUpcoming,
  getByCategory,
  getDueReminders,
  cancelSubscription,
  getCancelledSubscriptions,
} from '../../../services/subscriptions';

/* ═══ HELPERS ═══ */

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function fmtDate(d) {
  if (!d) return '';
  const safe = typeof d === 'string' && d.length === 10 ? d + 'T12:00:00' : d;
  return new Date(safe).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/* ═══ CATEGORY GROUPING ═══ */

const CATEGORY_ORDER = ['Стриминг', 'Софт', 'Спорт', 'Образование', 'Музыка', 'Другое'];

const CATEGORY_COLORS = {
  'Стриминг': '#FF6B6B',
  'Софт': '#4ECDC4',
  'Спорт': '#45B7D1',
  'Образование': '#96CEB4',
  'Музыка': '#DDA0DD',
  'Другое': '#95A5A6',
};

function groupByCategory(items) {
  const hasCategory = items.some((s) => s.category);
  if (!hasCategory) return [{ label: null, items }];

  const groups = {};
  items.forEach((s) => {
    const cat = s.category || 'Другое';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(s);
  });

  return Object.entries(groups)
    .sort(([a], [b]) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    })
    .map(([label, items]) => ({ label, items }));
}

/* ═══ TABS ═══ */

const TABS = [
  { id: 'active', label: 'Активные' },
  { id: 'cancelled', label: 'Отменённые' },
];

/* ═══ MAIN COMPONENT ═══ */

export default function SubscriptionsList({ theme, onBack, onAdd, onEdit }) {
  const [monthly, setMonthly] = useState(0);
  const [yearly, setYearly] = useState(0);
  const [upcoming, setUpcoming] = useState(undefined);
  const [categories, setCategories] = useState(undefined);

  /* G2 — reminders */
  const [reminders, setReminders] = useState([]);

  /* G7 — tab + cancelled list */
  const [tab, setTab] = useState('active');
  const [cancelled, setCancelled] = useState([]);
  const [confirmCancel, setConfirmCancel] = useState(null);

  const load = useCallback(async () => {
    const [m, y, up, cats, rem, canc] = await Promise.all([
      getMonthlyTotal(),
      getYearlyTotal(),
      getUpcoming(60),
      getByCategory(),
      getDueReminders(),
      getCancelledSubscriptions(),
    ]);
    setMonthly(m);
    setYearly(y);
    setUpcoming(up);
    setCategories(cats);
    setReminders(rem);
    setCancelled(canc);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* G7 — cancel handler */
  const handleCancel = async () => {
    if (!confirmCancel) return;
    await cancelSubscription(confirmCancel.id);
    setConfirmCancel(null);
    load();
  };

  /* ── Reminder lookup ── */
  const getReminderDays = (subId) => {
    const r = reminders.find(rm => rm.id === subId);
    return r ? r.daysUntilPayment : null;
  };

  /* M4.1: Skeleton while loading */
  if (upcoming === undefined) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
        <NavHeader title="Подписки" onBack={onBack} left theme={theme} />
        <div className="px-4 space-y-3 pt-2">
          <SkeletonCard theme={theme} />
          <SkeletonCard variant="compact" theme={theme} />
          <SkeletonCard variant="compact" theme={theme} />
        </div>
      </div>
    );
  }

  /* ── Empty state ── */
  if (
    upcoming !== undefined &&
    categories !== undefined &&
    upcoming.length === 0 &&
    categories.length === 0 &&
    cancelled.length === 0
  ) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
        <NavHeader title="Подписки" onBack={onBack} left theme={theme} />
        <div className="flex-1 flex items-center justify-center px-4">
          <EmptyState
            icon="🔄"
            title="Нет подписок"
            subtitle="Добавьте первую подписку"
            tip="Отслеживайте все подписки — видите сколько тратите в месяц"
            actionLabel="Добавить"
            onAction={onAdd}
            theme={theme}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader
        title="Подписки"
        onBack={onBack}
        left
        right={<span onClick={onAdd} style={{ cursor: 'pointer', fontSize: 16 }}>＋</span>}
        theme={theme}
      />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">

        {/* Totals — proto S11 */}
        <Card theme={theme} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: theme.gray1 }}>Всего подписок в месяц</div>
          <div className="tabular-nums" style={{ fontSize: 32, fontWeight: 700, color: theme.text, marginTop: 4 }}>
            {fmtMoney(monthly)}
          </div>
          <div className="flex justify-center" style={{ gap: 12, marginTop: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>В месяц</div>
              <div style={{ fontSize: 11, color: theme.gray2 }}>{fmtMoney(monthly)}</div>
            </div>
            <div style={{ width: 1, background: theme.gray5 }} />
            <div style={{ textAlign: 'center' }}>
              <div className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>В год</div>
              <div style={{ fontSize: 11, color: theme.gray2 }}>{fmtMoney(yearly)}</div>
            </div>
          </div>
        </Card>

        {/* G7 — Tab bar */}
        <ChipBar chips={TABS} active={tab} onChange={setTab} theme={theme} />

        {/* ── Active tab ── */}
        {tab === 'active' && (
          <>
            {/* G2 — Due reminders banner */}
            {reminders.length > 0 && (
              <Card theme={theme} style={{ background: theme.orange + '15' }}>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.orange }}>
                  Скоро оплата
                </span>
                <div className="space-y-2 mt-2">
                  {reminders.map((r) => (
                    <div key={r.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{r.icon || '💳'}</span>
                        <span className="text-sm" style={{ color: theme.text }}>{r.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold tabular-nums" style={{ color: theme.text }}>
                          {fmtMoney(r.amount)}
                        </span>
                        <div className="text-xs" style={{ color: theme.orange }}>
                          {r.daysUntilPayment === 0 ? 'Сегодня' : `через ${r.daysUntilPayment} дн`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Upcoming list */}
            {upcoming && upcoming.length > 0 && (
              <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
                {upcoming.map((sub, i) => {
                  const days = daysUntil(sub.next_payment);
                  const reminderDays = getReminderDays(sub.id);
                  const isTrial = sub.is_trial && sub.trial_end_date && daysUntil(sub.trial_end_date) >= 0;

                  return (
                    <div key={sub.id || i}>
                      {i > 0 && <div className="mx-4" style={{ borderTop: `0.5px solid ${theme.gray5}` }} />}
                      <div
                        className="flex items-center px-4 py-3 cursor-pointer active:opacity-70"
                        onClick={() => onEdit?.(sub)}
                        onContextMenu={(e) => { e.preventDefault(); setConfirmCancel(sub); }}
                      >
                        {/* Icon box 36×36 r10 — proto S11 */}
                        <div className="flex items-center justify-center shrink-0"
                          style={{ width: 36, height: 36, borderRadius: 10, background: sub.color || theme.accent, marginRight: 10 }}>
                          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>
                            {sub.icon ? sub.icon : (sub.name || 'S').charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate" style={{ color: theme.text }}>
                              {sub.name}
                            </span>
                            {/* G3 — Trial badge */}
                            {isTrial && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                style={{ background: theme.purple + '20', color: theme.purple }}
                              >
                                Trial · {daysUntil(sub.trial_end_date)} дн
                              </span>
                            )}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: theme.gray2 }}>
                            {fmtDate(sub.next_payment)}
                            {days <= 3 && days >= 0 && (
                              <span style={{ color: theme.orange, marginLeft: 4 }}>
                                {days === 0 ? '· Сегодня!' : `· через ${days} дн`}
                              </span>
                            )}
                            {/* G6: price history indicator */}
                            {sub.price_history?.length > 0 && (() => {
                              const prev = sub.price_history[sub.price_history.length - 1];
                              const diff = sub.amount - prev.amount;
                              const sign = diff > 0 ? '↑' : '↓';
                              const color = diff > 0 ? theme.red : theme.green;
                              return (
                                <span style={{ color, marginLeft: 4 }}>
                                  · {sign} было {fmtMoney(prev.amount)}
                                </span>
                              );
                            })()}
                          </div>
                          {sub.tariff_info && (
                            <div className="text-xs mt-0.5 font-medium" style={{ color: theme.teal || theme.accent }}>
                              {sub.tariff_info}
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-semibold tabular-nums ml-2" style={{ color: theme.text }}>
                          {fmtMoney(sub.amount)}
                          <span className="text-xs font-normal" style={{ color: theme.gray2 }}>
                            /{sub.frequency === 'yearly' ? 'год' : 'мес'}
                          </span>
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmCancel(sub); }} className="text-[11px] px-2 py-1 ml-2" style={{ color: theme.red, background: 'none', border: 'none', cursor: 'pointer' }}>
                          Отменить
                        </button>
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}

            {/* By category */}
            {categories && categories.length > 0 && (
              <Card theme={theme}>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
                  По категориям
                </span>
                <div className="space-y-2 mt-2">
                  {categories.map((cat, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[cat.name] || '#95A5A6' }} />
                        <span className="text-sm" style={{ color: theme.text }}>{cat.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold tabular-nums" style={{ color: theme.text }}>
                          {fmtMoney(cat.total)}
                        </span>
                        <span className="text-xs ml-1" style={{ color: theme.gray2 }}>/мес</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {/* ── G7 — Cancelled tab ── */}
        {tab === 'cancelled' && (
          <>
            {cancelled.length === 0 ? (
              <Card theme={theme}>
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">✅</div>
                  <div className="text-sm" style={{ color: theme.gray1 }}>Нет отменённых подписок</div>
                </div>
              </Card>
            ) : (
              <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
                {cancelled.map((sub, i) => (
                  <div key={sub.id || i}>
                    {i > 0 && <div className="mx-4" style={{ borderTop: `0.5px solid ${theme.gray5}` }} />}
                    <div className="flex items-center px-4 py-3" style={{ opacity: 0.6 }}>
                      <span className="text-xl mr-3">{sub.icon || '💳'}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate" style={{ color: theme.text }}>
                          {sub.name}
                        </span>
                        <div className="text-xs mt-0.5" style={{ color: theme.gray2 }}>
                          Отменена {sub.cancelled_at ? fmtDate(sub.cancelled_at) : ''}
                        </div>
                      </div>
                      <span className="text-sm tabular-nums ml-2" style={{ color: theme.gray2 }}>
                        {fmtMoney(sub.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}

      </div>

      {/* G7 — Cancel confirmation */}
      <ConfirmSheet
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        title="Отменить подписку?"
        message={confirmCancel ? `${confirmCancel.name} — ${fmtMoney(confirmCancel.amount)}/${confirmCancel.frequency === 'yearly' ? 'год' : 'мес'}` : ''}
        onConfirm={handleCancel}
        theme={theme}
      />
    </div>
  );
}
