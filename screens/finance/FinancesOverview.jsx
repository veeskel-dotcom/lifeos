import { fmtMoney, getCurrencySymbol, getSymbolForCode } from '../../utils/currency';
import { useState, useMemo } from 'react';
import {
  useMonthExpenses, useMonthIncomes, useSetting,
  useExpenseCategories, useRecentExpenses, useActiveAccounts, useActiveCredits,
} from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import ProgressBar from '../../components/ProgressBar';
import { useToast } from '../../components/ToastProvider';
import Ic from '../../components/Icon';

import SkeletonList from '../../components/SkeletonList';
import TutorialTip from '../../components/TutorialTip';
import EmptyState from '../../components/EmptyState';
import ScreenWrapper from '../../components/ScreenWrapper';
const MONTHS_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const CAT_COLORS = ['#34C759', '#007AFF', '#FF9500', '#AF52DE', '#FF3B30', '#5AC8FA', '#FF2D55', '#FFCC00'];

function formatRelativeTime(dateStr, timeStr) {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === today && timeStr) return timeStr;
  if (dateStr === yesterday) return 'вчера';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export default function FinancesOverview({ theme, onNavigate, onBack }) {
  const { showToast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const monthStart = selectedMonth + '-01';
  const monthEnd = selectedMonth + '-31';

  const monthExpenses = useMonthExpenses(monthStart, monthEnd);
  const monthIncomes = useMonthIncomes(monthStart, monthEnd);
  const budget = useSetting('monthly_budget');
  const categories = useExpenseCategories();
  const recentExpenses = useRecentExpenses(5);
  const accounts = useActiveAccounts();
  const credits = useActiveCredits();

  // Calculations
  const totalSpent = monthExpenses?.reduce((s, e) => s + e.amount, 0) || 0;
  const totalIncome = monthIncomes?.reduce((s, e) => s + e.amount, 0) || 0;
  const budgetAmount = budget || 0;
  const pct = budgetAmount > 0 ? Math.round((totalSpent / budgetAmount) * 100) : 0;

  // Today
  const today = new Date().toISOString().split('T')[0];
  const todayExpenses = monthExpenses?.filter(e => e.date === today) || [];
  const todaySpent = todayExpenses.reduce((s, e) => s + e.amount, 0);

  // Daily limit
  const daysInMonth = new Date(
    parseInt(selectedMonth.slice(0, 4)),
    parseInt(selectedMonth.slice(5, 7)),
    0
  ).getDate();
  const currentDay = new Date().getDate();
  const remainingDays = Math.max(daysInMonth - currentDay + 1, 1);
  const dailyLimit = budgetAmount > 0 ? Math.round((budgetAmount - totalSpent) / remainingDays) : 0;

  // Week
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekSpent = monthExpenses?.filter(e => e.date >= weekStartStr).reduce((s, e) => s + e.amount, 0) || 0;

  // By category (top 5)
  const topCategories = useMemo(() => {
    if (!monthExpenses || !categories) return [];
    const byCategory = {};
    monthExpenses.forEach(e => {
      byCategory[e.category_id] = (byCategory[e.category_id] || 0) + e.amount;
    });
    return Object.entries(byCategory)
      .map(([catId, amount]) => ({
        category: categories.find(c => c.id === parseInt(catId)),
        amount,
        pct: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
      }))
      .filter(c => c.category)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [monthExpenses, categories, totalSpent]);

  const monthIdx = parseInt(selectedMonth.slice(5)) - 1;
  const monthLabel = MONTHS_FULL[monthIdx];

  const prevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Loading
  const isLoading = !monthExpenses || !categories;

  return (
    <ScreenWrapper theme={theme}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3">
        {onBack ? (
          <button onClick={onBack} className="text-base font-medium" style={{ color: theme.accent }}>
            ← Назад
          </button>
        ) : (
          <span style={{ fontSize: 28, fontWeight: 700, color: theme.text }}>Финансы</span>
        )}
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="text-base px-1" style={{ color: theme.accent }}>◂</button>
          <button
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            className="text-sm font-medium"
            style={{ color: theme.accent }}
          >
            {monthLabel} ▾
          </button>
          <button onClick={nextMonth} className="text-base px-1" style={{ color: theme.accent }}>▸</button>
        </div>
      </div>

      {/* Month picker dropdown */}
      {showMonthPicker && (
        <div className="mx-4 mb-2 rounded-xl overflow-hidden" style={{ background: theme.card }}>
          <div className="grid grid-cols-3 gap-1 p-2">
            {MONTHS_FULL.map((m, i) => {
              const val = `${selectedMonth.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`;
              return (
                <button
                  key={i}
                  onClick={() => { setSelectedMonth(val); setShowMonthPicker(false); }}
                  className="py-2 rounded-lg text-sm font-medium"
                  style={{
                    background: val === selectedMonth ? theme.accent : 'transparent',
                    color: val === selectedMonth ? '#fff' : theme.text,
                  }}
                >
                  {m.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
        <TutorialTip id="finance_intro" theme={theme} icon="💰">
          Здесь общая картина финансов. Нажмите на категорию для детализации. Стрелки переключают месяц.
        </TutorialTip>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm" style={{ color: theme.gray2 }}>Загрузка...</span>
          </div>
        ) : (
          <>
            {/* Budget summary — proto S1 */}
            <Card theme={theme}>
              <div style={{ marginBottom: 4 }}>
                <div className="flex justify-between" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>БЮДЖЕТ {monthLabel?.toUpperCase()}</span>
                  {budgetAmount > 0 && <span style={{ fontSize: 12, color: theme.gray1 }}>{pct}%</span>}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: theme.text }} className="tabular-nums">
                  {fmtMoney(totalSpent)}{budgetAmount > 0 && <span style={{ fontSize: 14, fontWeight: 400, color: theme.gray1 }}> из {fmtMoney(budgetAmount)}</span>}
                </div>
              </div>
              {budgetAmount > 0 && (
                <ProgressBar
                  value={totalSpent} max={budgetAmount}
                  color={pct >= 100 ? theme.red : pct >= 80 ? theme.orange : theme.accent}
                  height={5} theme={theme}
                />
              )}
              <div className="flex justify-between" style={{ marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: theme.gray2 }}>Сегодня</div>
                  <div className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{fmtMoney(todaySpent)}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: theme.gray2 }}>Лимит/день</div>
                  <div className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{fmtMoney(dailyLimit)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: theme.gray2 }}>Осталось</div>
                  <div className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.green || '#34C759' }}>{fmtMoney(Math.max(0, budgetAmount - totalSpent))}</div>
                </div>
              </div>
            </Card>

            {/* By category */}
            <Card theme={theme}>
              <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: theme.gray1 }}>
                По категориям
              </div>
              {topCategories.length === 0 ? (
                <EmptyState
                  icon="💰" title="Нет расходов" subtitle="Нет расходов за этот месяц"
                  tip="Быстрый ввод: нажмите 🎤 и скажите «кофе 350»"
                  actionLabel="＋ Расход" onAction={() => onNavigate('expenseForm')} theme={theme}
                />
              ) : (
                <div>
                  {topCategories.map((item, idx) => (
                    <div key={item.category.id} style={{ padding: '10px 0', borderBottom: idx < topCategories.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                      <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
                        <div className="flex items-center" style={{ gap: 6 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 5, background: CAT_COLORS[idx % CAT_COLORS.length] }} />
                          <span style={{ fontSize: 14, color: theme.text }}>{item.category.icon} {item.category.name}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{fmtMoney(item.amount)}</span>
                          {item.category.budget && <span style={{ fontSize: 11, color: theme.gray2 }}> / {fmtMoney(item.category.budget)}</span>}
                        </div>
                      </div>
                      <ProgressBar
                        value={item.amount} max={item.category.budget || totalSpent || 1}
                        color={item.pct >= 90 ? theme.red : CAT_COLORS[idx % CAT_COLORS.length]}
                        height={3} theme={theme}
                      />
                    </div>
                  ))}
                </div>
              )}
              {/* РАЗДЕЛЫ — proto S1 nav rows */}
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1, padding: '8px 0 4px' }}>РАЗДЕЛЫ</div>
              <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
                {[
                  { iconName: 'money', c: theme.green || '#34C759', n: 'Расходы', d: 'Все операции · фильтры', t: 'expenses' },
                  { iconName: 'wallet', c: theme.accent, n: 'Доходы', d: 'Зарплата, фриланс, дивиденды', t: 'incomes' },
                  { iconName: 'wallet', c: theme.orange, n: 'Счета', d: `${accounts?.length || 0} счетов`, t: 'accounts' },
                  { iconName: 'card', c: theme.red, n: 'Кредиты и ипотека', d: `${credits?.length || 0} кредитов`, t: 'credits' },
                  { iconName: 'trend', c: theme.purple || '#AF52DE', n: 'Инвестиции', d: 'Портфель и сделки', t: 'invest' },
                  { iconName: 'home', c: theme.teal || '#30B0C7', n: 'ЖКХ', d: 'Счётчики · квитанции', t: 'utilities' },
                  { iconName: 'repeat', c: theme.green || '#34C759', n: 'Переводы', d: 'Между своими счетами', t: 'transfer' },
                  { iconName: 'subscription', c: theme.pink || '#FF2D55', n: 'Подписки', d: 'Активные подписки', t: 'subscriptions' },
                  { iconName: 'receipt', c: theme.teal || '#30B0C7', n: 'Бюджеты', d: 'Настройка лимитов', t: 'budgets' },
                ].map((item, i, arr) => (
                  <div key={item.t} onClick={() => onNavigate(item.t)}
                    className="flex items-center cursor-pointer active:opacity-70"
                    style={{ gap: 10, padding: '12px 14px', borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                    <Ic name={item.iconName} color={item.c} size={32} r={9} />
                    <div className="flex-1">
                      <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{item.n}</div>
                      <div style={{ fontSize: 12, color: theme.gray2 }}>{item.d}</div>
                    </div>
                    <span style={{ color: theme.gray3, fontSize: 16 }}>→</span>
                  </div>
                ))}
              </Card>
            </Card>

            {/* Recent transactions */}

            {/* ═══ СЧЕТА ═══ */}
            <Card theme={theme}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
                  Счета
                </span>
                <button onClick={() => onNavigate('accounts')} className="text-xs font-medium" style={{ color: theme.accent }}>
                  Все →
                </button>
              </div>
              {!accounts || accounts.length === 0 ? (
                <div className="text-center py-3">
                  <p className="text-sm" style={{ color: theme.gray2 }}>Нет счетов</p>
                  <button onClick={() => onNavigate('accountForm')} className="text-sm font-medium mt-2" style={{ color: theme.accent }}>
                    + Добавить счёт
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {accounts.map(a => (
                    <div key={a.id} className="flex justify-between items-center py-1.5 cursor-pointer active:opacity-70"
                      onClick={() => onNavigate('accountDetail', { detailId: a.id })}>
                      <div className="flex items-center gap-2">
                        <Ic name={a.type === 'cash' ? 'money' : a.type === 'card' ? 'card' : 'wallet'} color={theme.accent} size={24} r={6} />
                        <div>
                          <span className="text-sm font-medium" style={{ color: theme.text }}>{a.name}</span>
                          {a.bank && <span className="text-xs ml-1.5" style={{ color: theme.gray2 }}>{a.bank}</span>}
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums" style={{ color: theme.text }}>
                        {fmtMoney(a.balance || 0, getSymbolForCode(a.currency))}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 mt-1" style={{ borderTop: `0.5px solid ${theme.gray5}` }}>
                    <span className="text-sm font-semibold" style={{ color: theme.text }}>Итого</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: theme.text }}>
                      {fmtMoney(accounts.reduce((s, a) => s + (a.balance || 0), 0))}
                    </span>
                  </div>
                </div>
              )}
            </Card>

            {/* ═══ КРЕДИТЫ ═══ */}
            {credits && credits.length > 0 && (
              <Card theme={theme}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
                    Кредиты
                  </span>
                  <button onClick={() => onNavigate('credits')} className="text-xs font-medium" style={{ color: theme.accent }}>
                    Все →
                  </button>
                </div>
                <div className="space-y-2">
                  {credits.slice(0, 3).map(c => (
                    <div key={c.id} className="flex justify-between items-center py-1.5 cursor-pointer active:opacity-70"
                      onClick={() => onNavigate('creditDetail', { detailId: c.id })}>
                      <div>
                        <span className="text-sm font-medium" style={{ color: theme.text }}>{c.name}</span>
                        {c.next_payment_date && (
                          <p className="text-xs mt-0.5" style={{ color: theme.gray2 }}>
                            Платёж: {new Date(c.next_payment_date).toLocaleDateString('ru-RU')}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold tabular-nums" style={{ color: theme.red }}>
                          {fmtMoney(c.remaining_amount || 0)}
                        </span>
                        {c.monthly_payment && (
                          <p className="text-xs tabular-nums" style={{ color: theme.gray2 }}>
                            {c.monthly_payment.toLocaleString('ru-RU')}/мес
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* ═══ ЖКХ ═══ */}
            <Card theme={theme} style={{ cursor: 'pointer' }} onClick={() => onNavigate('utilities')}>
              <div className="flex items-center gap-3">
                <Ic name="home" color={theme.teal || theme.accent} size={40} r={12} />
                <div className="flex-1">
                  <div className="text-sm font-medium" style={{ color: theme.text }}>ЖКХ</div>
                  <div className="text-xs" style={{ color: theme.gray2 }}>Счётчики · квитанции · оплата</div>
                </div>
                <span style={{ color: theme.gray3 }}>→</span>
              </div>
            </Card>

            {/* Recent transactions (original) */}
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
              <div className="px-4 pt-4 pb-2">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
                  Последние операции
                </span>
              </div>
              {(!recentExpenses || recentExpenses.length === 0) ? (
                <p className="text-sm text-center py-6 px-4" style={{ color: theme.gray2 }}>
                  Операций пока нет
                </p>
              ) : (
                recentExpenses.map((e, i) => {
                  const cat = categories?.find(c => c.id === e.category_id);
                  return (
                    <div key={e.id || i}>
                      {i > 0 && <div className="mx-4" style={{ borderTop: `0.5px solid ${theme.gray5}` }} />}
                      <div
                        className="flex items-center px-4 py-2.5 cursor-pointer active:opacity-70"
                        onClick={() => onNavigate('expenseForm', { edit: e })}
                      >
                        <span className="text-lg mr-3">{cat?.icon || '📦'}</span>
                        <span className="flex-1 text-sm truncate" style={{ color: theme.text }}>
                          {e.description || cat?.name || 'Расход'}
                        </span>
                        <span className="text-sm font-medium tabular-nums ml-2" style={{ color: theme.text }}>
                          -{fmtMoney(e.amount)}
                        </span>
                        <span className="text-xs ml-2 w-12 text-right" style={{ color: theme.gray2 }}>
                          {formatRelativeTime(e.date, e.time)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div className="px-4 py-3" style={{ borderTop: `0.5px solid ${theme.gray5}` }}>
                <button
                  onClick={() => onNavigate('expenses')}
                  className="text-sm font-medium"
                  style={{ color: theme.accent }}
                >
                  Все расходы →
                </button>
              </div>
            </Card>

            {/* Quick action buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => onNavigate('expenseForm')}
                className="py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5"
                style={{ background: theme.accent, color: '#fff' }}
              >
                <Ic name="edit" color="#fff" size={16} r={4} raw /> Расход
              </button>
              <button
                onClick={() => onNavigate('incomeForm')}
                className="py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5"
                style={{ background: theme.green, color: '#fff' }}
              >
                <Ic name="wallet" color="#fff" size={16} r={4} raw /> Доход
              </button>
              <button
                onClick={() => showToast('OCR чеков — скоро')}
                className="py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5"
                style={{ background: theme.card, color: theme.text }}
              >
                <Ic name="camera" color={theme.text} size={16} r={4} raw /> Фото чека
              </button>
              <button
                onClick={() => showToast('Голосовой ввод — скоро')}
                className="py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5"
                style={{ background: theme.card, color: theme.text }}
              >
                <Ic name="mic" color={theme.text} size={16} r={4} raw /> Голос
              </button>
            </div>
          </>
        )}
      </div>
    </ScreenWrapper>
  );
}
