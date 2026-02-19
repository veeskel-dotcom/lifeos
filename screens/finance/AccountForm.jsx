import { useState, useEffect, useRef } from 'react';
import IOSKeyboardSpacer from '../../components/IOSKeyboardSpacer';
import ConfirmSheet from '../../components/ConfirmSheet';
import FormInput from '../../components/FormInput';
import FormButton from '../../components/FormButton';
import { CURRENCY_CODES as CURRENCIES } from '../../utils/constants';
import { getSymbolForCode, getCurrencyCode } from '../../utils/currency';

const ACCOUNT_TYPES = [
  { id: 'debit', label: 'Дебетовая' },
  { id: 'credit', label: 'Кредитная' },
  { id: 'savings', label: 'Накопительная' },
  { id: 'cash', label: 'Наличные' },
];

const COLORS = [
  { hex: '#FFD60A', emoji: '🟡' },
  { hex: '#34C759', emoji: '🟢' },
  { hex: '#007AFF', emoji: '🔵' },
  { hex: '#AF52DE', emoji: '🟣' },
  { hex: '#FF3B30', emoji: '🔴' },
];

export default function AccountForm({ account, onSave, onDelete, onClose, theme }) {
  const isEdit = !!account;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [type, setType] = useState('debit');
  const [currency, setCurrency] = useState(getCurrencyCode());
  const [balance, setBalance] = useState('');
  const [color, setColor] = useState('#FFD60A');
  const [limit, setLimit] = useState('');
  const [paymentDay, setPaymentDay] = useState('');

  useEffect(() => {
    if (account) {
      setName(account.name || '');
      setBank(account.bank || '');
      setType(account.type || 'debit');
      setCurrency(account.currency || getCurrencyCode());
      setBalance(String(account.balance ?? ''));
      setColor(account.color || '#FFD60A');
      setLimit(account.limit ? String(account.limit) : '');
      setPaymentDay(account.next_payment_date || '');
    }
  }, [account]);

  const savingRef = useRef(false);
  const handleSubmit = () => {
    if (savingRef.current) return;
    if (!name || !bank || balance === '') return;
    const data = {
      name, bank, type, currency,
      balance: parseFloat(balance),
      color,
      limit: type === 'credit' && limit ? parseFloat(limit) : null,
      next_payment_date: type === 'credit' && paymentDay ? paymentDay : null,
    };
    if (account?.id) data.id = account.id;
    savingRef.current = true;
    onSave(data);
  };

  const isValid = name && bank && balance !== '';

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
          {isEdit ? 'Редактировать счёт' : 'Новый счёт'}
        </span>
        {isEdit ? (
          <button onClick={() => setShowDeleteConfirm(true)} className="text-sm font-medium" style={{ color: theme.red }}>
            Удалить
          </button>
        ) : (
          <span className="w-14" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-1 pb-6">
        <FormInput label="Название" value={name} onChange={setName}
          placeholder="Тинькофф дебетовая" autoFocus={!isEdit} theme={theme} />

        <FormInput label="Банк" value={bank} onChange={setBank}
          placeholder="Тинькофф" theme={theme} />

        {/* Type chips */}
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.gray1 }}>Тип</label>
          <div className="flex gap-2 flex-wrap">
            {ACCOUNT_TYPES.map(t => (
              <button key={t.id} onClick={() => setType(t.id)}
                className="px-3 py-1.5 rounded-full text-sm font-medium"
                style={{ background: type === t.id ? theme.accent : theme.gray5, color: type === t.id ? '#fff' : theme.text }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Currency chips */}
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.gray1 }}>Валюта</label>
          <div className="flex gap-2">
            {CURRENCIES.map(c => (
              <button key={c} onClick={() => setCurrency(c)}
                className="px-3 py-1.5 rounded-full text-sm font-medium"
                style={{ background: currency === c ? theme.accent : theme.gray5, color: currency === c ? '#fff' : theme.text }}>
                {getSymbolForCode(c)} {c}
              </button>
            ))}
          </div>
        </div>

        <FormInput label="Баланс" type="number" inputMode="decimal" value={balance}
          onChange={setBalance} placeholder="0" prefix={getSymbolForCode(currency)} theme={theme} />

        {/* Color picker */}
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.gray1 }}>Цвет</label>
          <div className="flex gap-3">
            {COLORS.map(c => (
              <button key={c.hex} onClick={() => setColor(c.hex)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg border-2"
                style={{ background: c.hex + '30', borderColor: color === c.hex ? c.hex : 'transparent' }}>
                {c.emoji}
              </button>
            ))}
          </div>
        </div>

        {type === 'credit' && (
          <>
            <FormInput label="Кредитный лимит" type="number" inputMode="decimal" value={limit}
              onChange={setLimit} placeholder="300000" prefix={getSymbolForCode(currency)} theme={theme} />
            <FormInput label="Дата платежа (число месяца)" type="number" value={paymentDay}
              onChange={setPaymentDay} placeholder="15" theme={theme} />
          </>
        )}

        <div className="pt-2">
          <FormButton onClick={handleSubmit} disabled={!isValid} size="full" theme={{ ...theme, accent: theme.green }}>
            {isEdit ? 'Сохранить изменения' : 'Сохранить'}
          </FormButton>
        </div>
      </div>
      <IOSKeyboardSpacer />
      <ConfirmSheet open={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}
        title="Удалить счёт?" message={`«${account?.name || 'Счёт'}» будет удалён. Это повлияет на баланс.`}
        confirmLabel="Удалить" onConfirm={() => onDelete(account.id)} theme={theme} />
    </div>
  );
}
