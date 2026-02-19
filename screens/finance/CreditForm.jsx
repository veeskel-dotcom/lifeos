import { useState, useEffect, useRef } from 'react';
import IOSKeyboardSpacer from '../../components/IOSKeyboardSpacer';
import ConfirmSheet from '../../components/ConfirmSheet';
import { getCurrencySymbol, getCurrencyCode } from '../../utils/currency';
import FormInput from '../../components/FormInput';
import DatePicker from '../../components/DatePicker';

const CREDIT_TYPES = [
  { id: 'mortgage', label: '🏠 Ипотека' },
  { id: 'consumer', label: '💳 Потребительский' },
  { id: 'card', label: '💳 Кредитка' },
  { id: 'auto', label: '🚗 Авто' },
  { id: 'other', label: '📦 Другой' },
];

export default function CreditForm({ credit, onSave, onDelete, onClose, theme }) {
  const isEdit = !!credit;

  const [name, setName] = useState('');
  const [type, setType] = useState('mortgage');
  const [totalAmount, setTotalAmount] = useState('');
  const [remainingAmount, setRemainingAmount] = useState('');
  const [rate, setRate] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [paymentDay, setPaymentDay] = useState('');
  const [gracePeriodEnd, setGracePeriodEnd] = useState('');
  const [startDate, setStartDate] = useState('');
  const [activeDateField, setActiveDateField] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const openDatePicker = (field) => { setActiveDateField(field); setShowDatePicker(true); };
  const handleDatePick = (val) => {
    if (activeDateField === 'grace') setGracePeriodEnd(val);
    else if (activeDateField === 'start') setStartDate(val);
    else if (activeDateField === 'end') setEndDate(val);
  };
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState(getCurrencyCode());

  useEffect(() => {
    if (credit) {
      setName(credit.name || '');
      setType(credit.type || 'mortgage');
      setTotalAmount(credit.total_amount ? String(credit.total_amount) : '');
      setRemainingAmount(credit.remaining_amount ? String(credit.remaining_amount) : '');
      setRate(credit.rate ? String(credit.rate) : '');
      setMonthlyPayment(credit.monthly_payment ? String(credit.monthly_payment) : '');
      setPaymentDay(credit.payment_day ? String(credit.payment_day) : '');
      setGracePeriodEnd(credit.grace_period_end || '');
      setStartDate(credit.start_date || '');
      setEndDate(credit.end_date || '');
      setCurrency(credit.currency || getCurrencyCode());
    }
  }, [credit]);

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(confirmDelete);
      setConfirmDelete(null);
    }
  };

  const savingRef = useRef(false);
  const handleSubmit = () => {
    if (savingRef.current) return;
    if (!name || !totalAmount || !remainingAmount) return;

    // Compute next_payment_date from payment_day
    let nextPayment = null;
    if (paymentDay) {
      const now = new Date();
      const day = parseInt(paymentDay);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), day);
      nextPayment = (thisMonth > now ? thisMonth : new Date(now.getFullYear(), now.getMonth() + 1, day))
        .toISOString().split('T')[0];
    }

    const data = {
      name, type, currency,
      total_amount: parseFloat(totalAmount),
      remaining_amount: parseFloat(remainingAmount),
      rate: rate ? parseFloat(rate) : 0,
      monthly_payment: monthlyPayment ? parseFloat(monthlyPayment) : 0,
      payment_day: paymentDay ? parseInt(paymentDay) : null,
      next_payment_date: nextPayment,
      grace_period_end: gracePeriodEnd || null,
      start_date: startDate || null,
      end_date: endDate || null,
    };
    if (credit?.id) data.id = credit.id;
    savingRef.current = true;
    onSave(data);
  };

  const isValid = name && totalAmount && remainingAmount;

  const fieldStyle = { background: theme.card, color: theme.text };
  const labelCls = "text-xs font-semibold uppercase tracking-wide mb-1.5 block";

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full" style={{ background: theme.gray3 }} />
      </div>

      <div className="flex items-center justify-between px-5 py-3">
        <button onClick={onClose} className="text-base font-medium" style={{ color: theme.accent }}>
          Отмена
        </button>
        <span className="text-base font-semibold" style={{ color: theme.text }}>
          {isEdit ? 'Редактировать кредит' : 'Новый кредит'}
        </span>
        {isEdit ? (
          <button onClick={() => setConfirmDelete(credit.id)} className="text-sm font-medium" style={{ color: theme.red }}>
            Удалить
          </button>
        ) : <span className="w-14" />}
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-6">
        {/* Name */}
        <div>
          <label className={labelCls} style={{ color: theme.gray1 }}>Название</label>
          <FormInput value={name} onChange={setName} placeholder="Ипотека Сбер" autoFocus theme={theme} />
        </div>

        {/* Type */}
        <div>
          <label className={labelCls} style={{ color: theme.gray1 }}>Тип</label>
          <div className="flex gap-2 flex-wrap">
            {CREDIT_TYPES.map(t => (
              <button key={t.id} onClick={() => setType(t.id)}
                className="px-3 py-1.5 rounded-full text-sm font-medium"
                style={{ background: type === t.id ? theme.accent : theme.gray5, color: type === t.id ? '#fff' : theme.text }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Total amount */}
        <div>
          <label className={labelCls} style={{ color: theme.gray1 }}>Общая сумма</label>
          <div className="flex items-center rounded-xl px-4 py-3" style={fieldStyle}>
            <span className="text-base font-medium mr-2" style={{ color: theme.gray1 }}>{getCurrencySymbol()}</span>
            <FormInput type="number" inputMode="decimal" value={totalAmount} onChange={setTotalAmount} placeholder="5000000" theme={theme} />
          </div>
        </div>

        {/* Remaining */}
        <div>
          <label className={labelCls} style={{ color: theme.gray1 }}>Остаток</label>
          <div className="flex items-center rounded-xl px-4 py-3" style={fieldStyle}>
            <span className="text-base font-medium mr-2" style={{ color: theme.gray1 }}>{getCurrencySymbol()}</span>
            <FormInput type="number" inputMode="decimal" value={remainingAmount} onChange={setRemainingAmount} placeholder="3200000" theme={theme} />
          </div>
        </div>

        {/* Rate */}
        <div>
          <label className={labelCls} style={{ color: theme.gray1 }}>Ставка, % годовых</label>
          <FormInput type="number" inputMode="decimal" value={rate} onChange={setRate} placeholder="12.5" theme={theme} />
        </div>

        {/* Monthly payment */}
        <div>
          <label className={labelCls} style={{ color: theme.gray1 }}>Ежемесячный платёж</label>
          <div className="flex items-center rounded-xl px-4 py-3" style={fieldStyle}>
            <span className="text-base font-medium mr-2" style={{ color: theme.gray1 }}>{getCurrencySymbol()}</span>
            <FormInput type="number" inputMode="decimal" value={monthlyPayment} onChange={setMonthlyPayment} placeholder="52000" theme={theme} />
          </div>
        </div>

        {/* Payment day */}
        <div>
          <label className={labelCls} style={{ color: theme.gray1 }}>Число платежа (1-31)</label>
          <FormInput type="number" value={paymentDay} onChange={setPaymentDay} placeholder="15" theme={theme} />
        </div>

        {/* Grace period (cards) */}
        {type === 'card' && (
          <div>
            <label className={labelCls} style={{ color: theme.gray1 }}>Грейс-период до</label>
            <div onClick={() => openDatePicker('grace')} className="w-full rounded-xl px-4 py-3 text-base cursor-pointer" style={{ background: theme.card, color: gracePeriodEnd ? theme.text : theme.gray3 }}>{gracePeriodEnd || 'Выберите дату'}</div>
          </div>
        )}

        {/* Start / End dates */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelCls} style={{ color: theme.gray1 }}>Дата начала</label>
            <div onClick={() => openDatePicker('start')} className="w-full rounded-xl px-4 py-3 text-base cursor-pointer" style={{ background: theme.card, color: startDate ? theme.text : theme.gray3 }}>{startDate || 'Выберите дату'}</div>
          </div>
          <div className="flex-1">
            <label className={labelCls} style={{ color: theme.gray1 }}>Дата окончания</label>
            <div onClick={() => openDatePicker('end')} className="w-full rounded-xl px-4 py-3 text-base cursor-pointer" style={{ background: theme.card, color: endDate ? theme.text : theme.gray3 }}>{endDate || 'Выберите дату'}</div>
          </div>
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} disabled={!isValid}
          className="w-full py-3.5 rounded-xl font-semibold text-base transition-opacity"
          style={{ background: isValid ? theme.green : theme.gray4, color: '#fff', opacity: isValid ? 1 : 0.6 }}>
          💚 {isEdit ? 'Сохранить изменения' : 'Сохранить'}
        </button>
      </div>

      <DatePicker open={showDatePicker} onClose={() => setShowDatePicker(false)} value={activeDateField === 'grace' ? gracePeriodEnd : activeDateField === 'start' ? startDate : endDate} onChange={handleDatePick} theme={theme} />
      <IOSKeyboardSpacer />
      <ConfirmSheet
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Удалить кредит?"
        message="Данные кредита будут удалены"
        confirmLabel="Удалить"
        onConfirm={handleDelete}
        theme={theme}
      />
    </div>
  );
}
