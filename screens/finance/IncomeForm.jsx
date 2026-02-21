import { useState, useEffect, useRef } from 'react';
import { getCurrencySymbol, getCurrencyCode } from '../../utils/currency';
import { useAccounts } from '../../hooks/useDB';
import CategoryPicker from './CategoryPicker';
import IOSKeyboardSpacer from '../../components/IOSKeyboardSpacer';
import FormInput from '../../components/FormInput';
import FormButton from '../../components/FormButton';
import SelectSheet, { SelectTrigger } from '../../components/SelectSheet';
import DatePicker from '../../components/DatePicker';
import ConfirmSheet from '../../components/ConfirmSheet';

export default function IncomeForm({ income, onSave, onDelete, onClose, theme }) {
  const isEdit = !!income;

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [accountId, setAccountId] = useState(null);
  const [date, setDate] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [recurringDay, setRecurringDay] = useState('');
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const ocrRef = useRef(null);

  const accounts = useAccounts();

  useEffect(() => {
    if (income) {
      setAmount(String(income.amount));
      setDescription(income.description || '');
      setCategoryId(income.category_id);
      setAccountId(income.account_id);
      setDate(income.date);
      setRecurring(income.recurring || false);
      setRecurringDay(income.recurring_day?.toString() || '');
      setNote(income.note || '');
    } else {
      setDate(new Date().toISOString().split('T')[0]);
      if (accounts?.length && !accountId) {
        setAccountId(accounts[0].id);
      }
    }
  }, [income, accounts]);

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(confirmDelete);
      setConfirmDelete(null);
    }
  };

  const handleOCR = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const { parseBankStatement } = await import('../../services/ocr');
      const ops = await parseBankStatement(base64);
      const inc = ops.find(o => o.type === 'income') || ops[0];
      if (inc) {
        if (inc.amount) setAmount(String(Math.abs(inc.amount)));
        if (inc.description) setDescription(inc.description);
        if (inc.date) setDate(inc.date);
      }
    } catch (err) {
      console.error('[OCR Income]', err);
      setErrors(prev => ({ ...prev, ocr: 'Не удалось распознать' }));
    }
    setOcrLoading(false);
    e.target.value = '';
  };

  const savingRef = useRef(false);
  const handleSubmit = () => {
    if (savingRef.current) return;
    const e = {};
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) e.amount = 'Укажите сумму';
    if (!categoryId) e.category = 'Выберите категорию';
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    const data = {
      amount: parseFloat(amount),
      currency: getCurrencyCode(),
      category_id: categoryId,
      description: description.trim(),
      note: note.trim(),
      date,
      ts: income?.ts || Date.now(),
      account_id: accountId,
      recurring,
      recurring_day: recurring && recurringDay ? parseInt(recurringDay) : null,
      source: 'manual',
      created_at: income?.created_at || new Date().toISOString(),
    };
    if (income?.id) data.id = income.id;
    savingRef.current = true;
    onSave(data);
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full" style={{ background: theme.gray3 }} />
      </div>

      <div className="flex items-center justify-between px-5 py-3">
        <button onClick={onClose} className="text-base font-medium" style={{ color: theme.accent }}>
          Отмена
        </button>
        <span style={{ fontSize: 17, fontWeight: 600, color: theme.text }}>
          {isEdit ? 'Редактировать доход' : 'Новый доход'}
        </span>
        {isEdit ? (
          <button onClick={() => setConfirmDelete(income.id)} className="text-sm font-medium" style={{ color: theme.red }}>
            Удалить
          </button>
        ) : (
          <span className="w-14" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-6">
        {/* Amount — proto S5 hero */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: theme.gray2, marginBottom: 4, display: 'block' }}>Сумма</label>
          <div className="flex items-center" style={{ gap: 8 }}>
            <div className="flex items-center flex-1"
              style={{ background: theme.gray5, borderRadius: 10, padding: '12px 14px' }}>
              <span style={{ fontSize: 13, color: theme.gray2 }}>{getCurrencySymbol()}</span>
              <input type="number" inputMode="decimal" value={amount}
                onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus={!isEdit}
                className="hero-input flex-1 bg-transparent outline-none tabular-nums"
                style={{ fontSize: 22, fontWeight: 700, color: theme.text, border: 'none', marginLeft: 4, width: '100%' }}
              />
            </div>
            <button
              className="flex items-center justify-center shrink-0"
              style={{ width: 48, height: 48, borderRadius: 14, background: (theme.purple || '#AF52DE') + '12', border: 'none', cursor: 'pointer' }}
              onClick={() => ocrRef.current?.click()}
              disabled={ocrLoading}
            >
              <span style={{ fontSize: 22 }}>{ocrLoading ? '⏳' : '📸'}</span>
            </button>
            <input ref={ocrRef} type="file" accept="image/*" capture="environment"
              className="hidden" onChange={handleOCR} />
          </div>
          {errors.amount && <p className="text-xs mt-1" style={{ color: theme.red }}>{errors.amount}</p>}
        </div>

        <FormInput label="Описание" value={description} onChange={setDescription}
          placeholder="Зарплата за февраль" theme={theme} />

        {/* Category (income) */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: theme.gray1 }}>
            Источник
          </label>
          <CategoryPicker module="income" selected={categoryId} onSelect={setCategoryId} theme={theme} />
          {errors.category && <p className="text-xs mt-1" style={{ color: theme.red }}>{errors.category}</p>}
        </div>

        <SelectTrigger label="Счёт" value={accounts?.find(a => a.id === accountId)?.name}
          placeholder="Выбрать счёт..." onClick={() => setShowAccountSheet(true)} theme={theme} />

        <DatePicker label="Дата" value={date} onChange={setDate} mode="date" theme={theme} />

        {/* Recurring — proto S5 */}
        <div className="flex items-center justify-between"
          style={{ background: theme.gray5, borderRadius: 10, padding: '12px 14px' }}>
          <span style={{ fontSize: 15, color: theme.text }}>🔄 Регулярный</span>
          <button onClick={() => setRecurring(!recurring)}
            style={{ width: 44, height: 26, borderRadius: 13, background: recurring ? (theme.green || '#34C759') : theme.gray4, padding: 2, border: 'none', cursor: 'pointer', position: 'relative' }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: '#fff', position: 'absolute', top: 2, left: recurring ? 20 : 2, transition: '0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </button>
        </div>
        {recurring && (
          <div style={{ background: (theme.green || '#34C759') + '08', borderRadius: 10, padding: '10px 14px', border: `1px solid ${(theme.green || '#34C759')}20` }}>
            <div className="flex justify-between" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: theme.gray1 }}>День месяца</span>
              <input type="number" inputMode="numeric" value={recurringDay}
                onChange={e => setRecurringDay(e.target.value)} placeholder="5"
                className="bg-transparent outline-none text-right tabular-nums"
                style={{ fontSize: 13, fontWeight: 600, color: theme.text, border: 'none', width: 60 }} />
            </div>
            {recurringDay && (
              <div className="flex justify-between">
                <span style={{ fontSize: 13, color: theme.gray1 }}>Следующий</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>
                  {recurringDay}-го числа
                </span>
              </div>
            )}
          </div>
        )}

        {/* Note — proto S5 */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: theme.gray1, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.3 }}>
            Заметка
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Комментарий к записи..."
            className="outline-none resize-none"
            style={{
              width: '100%', minHeight: 60, padding: 12, borderRadius: 12,
              border: `1px solid ${theme.gray5}`, background: theme.card,
              color: theme.text, fontSize: 14,
            }}
          />
        </div>

        <div className="pt-2">
          <FormButton onClick={handleSubmit} disabled={!amount || !categoryId} size="full" theme={{ ...theme, accent: theme.green }}>
            {isEdit ? 'Сохранить изменения' : 'Сохранить'}
          </FormButton>
        </div>
      </div>
      <IOSKeyboardSpacer />
      <SelectSheet open={showAccountSheet} onClose={() => setShowAccountSheet(false)}
        title="Счёт" options={accounts?.map(a => ({ id: a.id, label: a.name || a.bank })) || []}
        value={accountId} onSelect={id => setAccountId(Number(id))} theme={theme} />
      <ConfirmSheet
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Удалить доход?"
        message="Запись будет удалена"
        confirmLabel="Удалить"
        onConfirm={handleDelete}
        theme={theme}
      />
    </div>
  );
}
