import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { useCredit } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import { fmtMoney } from '../../utils/currency';
import Card from '../../components/Card';
import ProgressBar from '../../components/ProgressBar';
import ConfirmSheet from '../../components/ConfirmSheet';

import SkeletonList from '../../components/SkeletonList';
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatShortAmount(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}М`;
  if (n >= 1000) return `${Math.round(n / 1000)}К`;
  return n.toLocaleString('ru-RU');
}

function generateSchedule(credit) {
  if (!credit.monthly_payment || !credit.next_payment_date) return [];
  const schedule = [];
  let remaining = credit.remaining_amount;
  const startDate = new Date(credit.next_payment_date);
  for (let i = 0; i < 12 && remaining > 0; i++) {
    const y = startDate.getFullYear(), m = startDate.getMonth() + i;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const day = Math.min(startDate.getDate(), lastDay);
    const date = new Date(y, m, day);
    const interest = remaining * ((credit.rate || 0) / 100 / 12);
    const principal = Math.min(credit.monthly_payment - interest, remaining);
    remaining = Math.max(0, remaining - principal);
    schedule.push({
      date, payment: credit.monthly_payment,
      principal: Math.round(principal), interest: Math.round(interest),
      remaining: Math.round(remaining), active: i === 0,
    });
  }
  return schedule;
}

export default function CreditDetail({ creditId, theme, onBack, onNavigate }) {
  const credit = useCredit(creditId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const schedule = useMemo(() => credit ? generateSchedule(credit) : [], [credit]);

  if (!credit) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
        <NavHeader title="Кредит" onBack={onBack} left="Кредиты" theme={theme} />
        <div className="p-4">
          <SkeletonList count={5} theme={theme} />
        </div>
      </div>
    );
  }

  const paid = (credit.total_amount || 0) - (credit.remaining_amount || 0);
  const pctPaid = credit.total_amount > 0 ? Math.round((paid / credit.total_amount) * 100) : 0;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title={credit.name} onBack={onBack} left="Кредиты" theme={theme} />

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Hero — proto S8: 34/700 centered + "из" 14 + PB h:6 */}
        <div style={{ textAlign: 'center', padding: '4px 16px 8px' }}>
          <div className="tabular-nums" style={{ fontSize: 34, fontWeight: 700, color: theme.text }}>
            {fmtMoney(credit.remaining_amount || 0)}
          </div>
          <div style={{ fontSize: 14, color: theme.gray2 }}>
            из {fmtMoney(credit.total_amount || 0)} · погашено {pctPaid}%
          </div>
          <div style={{ margin: '8px 32px' }}>
            <ProgressBar value={paid} max={credit.total_amount || 1} color={theme.green || '#34C759'} height={6} theme={theme} />
          </div>
        </div>

        {/* Key params — proto S8: Row icon+label+value */}
        <Card theme={theme} style={{ margin: '0 16px 8px', padding: 0, overflow: 'hidden' }}>
          {[
            { icon: '📊', c: theme.orange, label: 'Ставка', value: credit.rate ? `${credit.rate}% годовых` : '—' },
            { icon: '💰', c: theme.accent, label: 'Ежемесячный платёж', value: credit.monthly_payment ? fmtMoney(credit.monthly_payment) : '—' },
            { icon: '🔔', c: theme.teal || '#30B0C7', label: 'Дата платежа', value: credit.payment_day ? `${credit.payment_day}-е число` : '—' },
            { icon: '🏁', c: theme.green || '#34C759', label: 'Начало', value: formatDate(credit.start_date) },
            { icon: '🔒', c: theme.red, label: 'Окончание', value: formatDate(credit.end_date) },
          ].map((row, i, arr) => (
            <div key={row.label} className="flex items-center" style={{ padding: '11px 14px', gap: 10, borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
              <span style={{ fontSize: 16, width: 26, textAlign: 'center' }}>{row.icon}</span>
              <span className="flex-1" style={{ fontSize: 14, color: theme.gray1 }}>{row.label}</span>
              <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{row.value}</span>
            </div>
          ))}
        </Card>

        {/* Overpayment card — proto S8 */}
        {credit.rate > 0 && credit.total_amount > 0 && credit.monthly_payment > 0 && (() => {
          const totalMonths = credit.end_date && credit.start_date
            ? Math.round((new Date(credit.end_date) - new Date(credit.start_date)) / (30.44 * 86400000))
            : Math.ceil((credit.remaining_amount || 0) / (credit.monthly_payment - (credit.remaining_amount || 0) * credit.rate / 100 / 12));
          const totalPayout = credit.monthly_payment * totalMonths;
          const overpay = totalPayout - (credit.total_amount || 0);
          return (
            <Card theme={theme} style={{ margin: '0 16px 8px' }}>
              <div className="flex justify-between" style={{ marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: theme.gray2 }}>Переплата по %</div>
                  <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 700, color: theme.red }}>{fmtMoney(Math.max(0, overpay))}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: theme.gray2 }}>Итого выплата</div>
                  <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>{fmtMoney(totalPayout)}</div>
                </div>
              </div>
            </Card>
          );
        })()}

        {/* Remaining balance chart */}
        {schedule.length > 2 && (
          <Card theme={theme} style={{ margin: '0 16px 8px' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: theme.gray1 }}>
              ДИНАМИКА ОСТАТКА
            </p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={schedule.map(s => ({
                m: `${MONTHS[s.date.getMonth()]}`,
                r: s.remaining,
              }))} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="m" tick={{ fontSize: 10, fill: theme.gray2 }} />
                <YAxis hide />
                <Bar dataKey="r" radius={[3, 3, 0, 0]} barSize={20}>
                  {schedule.map((s, i) => (
                    <Cell key={i} fill={s.remaining <= 0 ? theme.green : theme.accent} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Payment schedule — proto S8: active row orange, principal/interest split */}
        {schedule.length > 0 && (
          <>
            <div style={{ padding: '0 16px 4px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>БЛИЖАЙШИЕ ПЛАТЕЖИ</span>
            </div>
            <Card theme={theme} style={{ margin: '0 16px 8px', padding: 0, overflow: 'hidden' }}>
              {schedule.slice(0, 6).map((s, i, arr) => (
                <div key={i} style={{
                  padding: '10px 14px',
                  borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.gray5}` : 'none',
                  background: s.active ? (theme.orange || '#FF9500') + '06' : 'transparent',
                }}>
                  <div className="flex justify-between" style={{ marginBottom: 2 }}>
                    <div className="flex items-center" style={{ gap: 6 }}>
                      {s.active && <div style={{ width: 6, height: 6, borderRadius: 3, background: theme.orange || '#FF9500' }} />}
                      <span className="tabular-nums" style={{ fontSize: 14, fontWeight: s.active ? 600 : 400, color: s.active ? theme.orange : theme.text }}>
                        {s.date.getDate()} {MONTHS[s.date.getMonth()]} {s.date.getFullYear()}
                      </span>
                    </div>
                    <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>
                      {fmtMoney(s.payment)}
                    </span>
                  </div>
                  <div className="flex" style={{ gap: 8, fontSize: 12, color: theme.gray2, paddingLeft: s.active ? 12 : 0 }}>
                    <span>Тело: <b style={{ color: theme.green || '#34C759' }}>{fmtMoney(s.principal)}</b></span>
                    <span>%: <b style={{ color: theme.red }}>{fmtMoney(s.interest)}</b></span>
                    <span style={{ marginLeft: 'auto' }}>→ {fmtMoney(s.remaining)}</span>
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}

        {/* Early repayment CTA — proto S8 */}
        <div style={{ padding: '0 16px 8px' }}>
          <div className="cursor-pointer" style={{ padding: 14, borderRadius: 12, background: (theme.green || '#34C759') + '08', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.green || '#34C759' }}>📊 Калькулятор досрочного погашения</div>
            <div style={{ fontSize: 12, color: theme.gray2, marginTop: 2 }}>Рассчитать экономию при доплате</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex" style={{ gap: 12, padding: '0 16px' }}>
          <button onClick={() => onNavigate('creditForm', { edit: credit })}
            className="flex-1" style={{ padding: 14, borderRadius: 12, background: theme.accent, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            Редактировать
          </button>
          <button onClick={() => setConfirmOpen(true)}
            style={{ padding: '14px 24px', borderRadius: 12, background: theme.red + '15', color: theme.red, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            Удалить
          </button>
        </div>
        <ConfirmSheet open={confirmOpen} onClose={() => setConfirmOpen(false)}
          title="Удалить кредит?" message="Это действие нельзя отменить" confirmLabel="Удалить"
          onConfirm={() => onNavigate('deleteCredit', { deleteId: credit.id })} theme={theme} />
      </div>
    </div>
  );
}
