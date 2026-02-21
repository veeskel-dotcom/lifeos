import { useState, useRef, useEffect } from 'react';
import Card from '../../../components/Card';
import NavHeader from '../../../components/NavHeader';
import { addSubscription, updateSubscription } from '../../../services/subscriptions';
import { getCurrencySymbol, getCurrencyCode } from '../../../utils/currency';
import { SUBSCRIPTION_PRESETS } from '../../../db/seed';
import IOSKeyboardSpacer from '../../../components/IOSKeyboardSpacer';
import DatePicker from '../../../components/DatePicker';

const ICONS = ['💳', '🎵', '📺', '💻', '🏋️', '📱', '☁️', '🎮', '📰', '🔒'];

const FREQ_OPTIONS = [
  { id: 'monthly', label: 'Ежемесячно' },
  { id: 'yearly', label: 'Ежегодно' },
];

export default function SubscriptionForm({ theme, onBack, onSave, existing }) {
  const [name, setName] = useState(existing?.name || '');
  const [amount, setAmount] = useState(existing?.amount?.toString() || '');
  const [frequency, setFrequency] = useState(existing?.frequency || 'monthly');
  const [showNextPayPicker, setShowNextPayPicker] = useState(false);
  const [nextPayment, setNextPayment] = useState(
    existing?.next_payment || new Date().toISOString().slice(0, 10)
  );
  const [category, setCategory] = useState(existing?.category_name_snapshot || '');
  const [icon, setIcon] = useState(existing?.icon || '💳');

  /* G2 — remind_days_before */
  const [remindDays, setRemindDays] = useState(existing?.remind_days_before?.toString() || '3');
  /* W14 — tariff info */
  const [tariffInfo, setTariffInfo] = useState(existing?.tariff_info || '');

  /* G3 — Trial tracking */
  const [isTrial, setIsTrial] = useState(existing?.is_trial || false);
  const [showTrialPicker, setShowTrialPicker] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState(
    existing?.trial_end_date || ''
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  /* M3.3 — inline validation */
  const [errors, setErrors] = useState({});

  /* M3.4 — autofocus */
  const nameRef = useRef(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  function validate() {
    const e = {};
    if (!name.trim()) e.name = 'Введите название';
    const num = parseFloat(amount);
    if (!num || num <= 0) e.amount = 'Сумма должна быть > 0';
    if (isTrial && !trialEndDate) e.trialEndDate = 'Укажите дату окончания триала';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const handleSave = async () => {
    if (!validate()) return;

    const data = {
      name: name.trim(),
      amount: parseFloat(amount),
      currency: getCurrencyCode(),
      frequency,
      next_payment: nextPayment,
      category_name_snapshot: category || 'Прочее',
      icon,
      auto_renew: true,
      is_active: true,
      remind_days_before: Math.max(0, parseInt(remindDays) || 3),
      tariff_info: tariffInfo.trim() || null,
      is_trial: isTrial,
      trial_end_date: isTrial ? trialEndDate : null,
    };

    if (existing?.id) {
      await updateSubscription(existing.id, data);
    } else {
      await addSubscription(data);
    }
    onSave?.();
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader
        title={existing ? 'Редактировать' : 'Новая подписка'}
        onBack={onBack}
        left
        right={
          <span onClick={handleSave} style={{ color: theme.accent, cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>
            Сохранить
          </span>
        }
        theme={theme}
      />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">

        {/* R2.4: Quick presets for new subscriptions */}
        {!existing && !name && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2 px-1" style={{ color: theme.gray1 }}>
              Быстрый выбор
            </div>
            <div className="flex flex-wrap gap-2">
              {SUBSCRIPTION_PRESETS.map((p, i) => (
                <button key={i} onClick={() => { setName(p.name); setAmount(String(p.price)); setIcon(p.icon); setFrequency(p.period); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
                  style={{ background: theme.card, color: theme.text, border: 'none', cursor: 'pointer' }}>
                  <span>{p.icon}</span> {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Icon picker */}
        <Card theme={theme}>
          <div className="flex gap-2 flex-wrap">
            {ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{
                  background: icon === ic ? theme.accent + '15' : theme.gray6,
                  border: icon === ic ? `1.5px solid ${theme.accent}` : '1.5px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {ic}
              </button>
            ))}
          </div>
        </Card>

        {/* Name */}
        <Card theme={theme}>
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
            Название
          </label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Netflix, Spotify..."
            className="w-full text-sm mt-1 bg-transparent outline-none"
            style={{ color: theme.text }}
          />
          {errors.name && <span className="text-xs mt-1 block" style={{ color: theme.red }}>{errors.name}</span>}
        </Card>

        {/* Amount + Frequency */}
        <Card theme={theme}>
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
            Сумма
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="hero-input w-full text-2xl font-bold mt-1 bg-transparent outline-none tabular-nums"
            style={{ color: theme.accent }}
          />
          {errors.amount && <span className="text-xs mt-1 block" style={{ color: theme.red }}>{errors.amount}</span>}

          <div className="flex gap-2 mt-3">
            {FREQ_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFrequency(opt.id)}
                className="flex-1 py-2 rounded-xl text-sm font-medium"
                style={{
                  background: frequency === opt.id ? theme.accent + '15' : theme.gray6,
                  color: frequency === opt.id ? theme.accent : theme.gray1,
                  border: frequency === opt.id ? `1.5px solid ${theme.accent}` : '1.5px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Card>

        {/* Next payment date */}
        <Card theme={theme}>
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
            Дата следующего платежа
          </label>
          <div onClick={() => setShowNextPayPicker(true)}
            className="w-full rounded-xl px-4 py-3 text-sm cursor-pointer mt-1"
            style={{ background: theme.card, color: nextPayment ? theme.text : theme.gray3 }}>
            {nextPayment || 'Выберите дату'}
          </div>
        </Card>

        {/* Category */}
        <Card theme={theme}>
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
            Категория
          </label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Стриминг, Софт..."
            className="w-full text-sm mt-1 bg-transparent outline-none"
            style={{ color: theme.text }}
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {['Стриминг', 'Софт', 'Спорт', 'Образование', 'Музыка', 'Другое'].map(c => (
              <button
                key={c} type="button"
                onClick={() => setCategory(c)}
                className="text-[11px] px-2 py-1 rounded-full"
                style={{
                  background: category === c ? theme.accent : theme.gray5,
                  color: category === c ? '#fff' : theme.gray1,
                }}
              >{c}</button>
            ))}
          </div>
        </Card>

        {/* G2 — Remind days before */}
        <Card theme={theme}>
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
            Напоминание (за N дней)
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={remindDays}
            onChange={(e) => setRemindDays(e.target.value)}
            placeholder="3"
            className="w-full text-sm mt-1 bg-transparent outline-none tabular-nums"
            style={{ color: theme.text }}
          />
        </Card>

        {/* G3 — Trial tracking */}
        {/* W14 — Tariff info for plans */}
        <Card theme={theme}>
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
            Тариф / Остаток
          </label>
          <input
            type="text"
            value={tariffInfo}
            onChange={(e) => setTariffInfo(e.target.value)}
            placeholder="18 ГБ / 30 ГБ · 380 мин"
            className="w-full text-sm mt-1 bg-transparent outline-none"
            style={{ color: theme.text }}
          />
        </Card>

        {/* G3 — Trial tracking (original) */}
        <Card theme={theme}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
              Пробный период (Trial)
            </label>
            <button
              onClick={() => setIsTrial(!isTrial)}
              className="w-11 h-6 rounded-full relative transition-colors"
              style={{
                background: isTrial ? theme.accent : theme.gray4,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <div
                className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all"
                style={{ left: isTrial ? 22 : 2 }}
              />
            </button>
          </div>

          {isTrial && (
            <div className="mt-3">
              <label className="text-xs" style={{ color: theme.gray2 }}>Дата окончания триала</label>
              <div onClick={() => setShowTrialPicker(true)}
                className="w-full rounded-xl px-4 py-3 text-sm cursor-pointer mt-1"
                style={{ background: theme.card, color: trialEndDate ? theme.text : theme.gray3 }}>
                {trialEndDate || 'Выберите дату'}
              </div>
              {errors.trialEndDate && (
                <span className="text-xs mt-1 block" style={{ color: theme.red }}>{errors.trialEndDate}</span>
              )}
            </div>
          )}
        </Card>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-full py-3.5 rounded-2xl text-white font-semibold text-base"
          style={{ background: theme.accent, border: 'none', cursor: 'pointer' }}
        >
          {existing ? 'Сохранить' : 'Добавить'}
        </button>
      </div>


      <DatePicker open={showNextPayPicker} onClose={() => setShowNextPayPicker(false)} value={nextPayment} onChange={setNextPayment} theme={theme} />

      <DatePicker open={showTrialPicker} onClose={() => setShowTrialPicker(false)} value={trialEndDate} onChange={setTrialEndDate} theme={theme} />
      <IOSKeyboardSpacer />
    </div>
  );
}
