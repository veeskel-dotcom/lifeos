import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccounts, useExpenseCategories } from '../../hooks/useDB';
import CategoryPicker from './CategoryPicker';
import IOSKeyboardSpacer from '../../components/IOSKeyboardSpacer';
import ConfirmSheet from '../../components/ConfirmSheet';
import { getCurrencySymbol, getCurrencyCode, fmtMoney } from '../../utils/currency';
import FormInput from '../../components/FormInput';
import DatePicker from '../../components/DatePicker';
import SelectSheet, { SelectTrigger } from '../../components/SelectSheet';
import { getDailyBudgetRemaining } from '../../services/expenses';

export default function ExpenseForm({ expense, onSave, onDelete, onClose, theme }) {
  const isEdit = !!expense;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [dailyBudget, setDailyBudget] = useState(null);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [accountId, setAccountId] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  /* M3.3: inline validation */
  const [errors, setErrors] = useState({});
  /* A2.1: повторяющиеся расходы */
  const [recurrence, setRecurrence] = useState('none');
  /* A2.10: сплит-расход */
  const [isSplit, setIsSplit] = useState(false);
  const [splitTotal, setSplitTotal] = useState('');
  const [splitPeople, setSplitPeople] = useState(2);

  /* A2.2: OCR чека */
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrItems, setOcrItems] = useState(null);
  const ocrRef = useRef(null);

  /* A2.3: AI автокатегоризация */
  const [catSuggestion, setCatSuggestion] = useState(null);
  const [catLoading, setCatLoading] = useState(false);

  const accounts = useAccounts();
  const categories = useExpenseCategories();

  useEffect(() => {
    if (expense) {
      setAmount(String(expense.amount));
      setDescription(expense.description || '');
      setCategoryId(expense.category_id);
      setAccountId(expense.account_id);
      setDate(expense.date);
      setTime(expense.time || '');
      setRecurrence(expense.recurrence || 'none');
      if (expense.split_total) {
        setIsSplit(true);
        setSplitTotal(String(expense.split_total));
        setSplitPeople(expense.split_people || 2);
      }
    } else {
      const now = new Date();
      setDate(now.toISOString().split('T')[0]);
      setTime(now.toTimeString().slice(0, 5));
    }
  }, [expense]);

  // Авто-выбор первого счёта (отдельный эффект с stable dep)
  useEffect(() => {
    if (!accountId && accounts?.length) {
      setAccountId(accounts[0].id);
    }
  }, [accounts?.length]);

  useEffect(() => {
    getDailyBudgetRemaining().then(setDailyBudget).catch(() => {});
  }, []);

  const selectedCategory = categories?.find(c => c.id === categoryId);
  const selectedAccount = accounts?.find(a => a.id === accountId);

  /* A2.2: OCR чека — фото → распознавание → заполнение */
  const handleOCR = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    setOcrItems(null);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const { parseReceipt } = await import('../../services/ocr');
      const receipt = await parseReceipt(base64);

      // Заполнить первой позицией или total
      if (receipt.total) setAmount(String(receipt.total));
      if (receipt.store) setDescription(receipt.store);
      if (receipt.date) setDate(receipt.date);
      if (receipt.items?.length > 0) setOcrItems(receipt.items);
    } catch (err) {
      console.error('[OCR]', err);
      setErrors(prev => ({ ...prev, ocr: 'Не удалось распознать чек' }));
    }
    setOcrLoading(false);
    e.target.value = '';
  }, []);

  /* A2.3: автокатегоризация при потере фокуса описания */
  const handleDescBlur = useCallback(async () => {
    const desc = description.trim();
    if (!desc || categoryId || catLoading) return;
    setCatLoading(true);
    try {
      const { categorizeExpense, findCategoryId } = await import('../../services/categorize');
      const result = await categorizeExpense(desc, parseFloat(amount) || 0);
      if (result.category && result.confidence >= 0.7) {
        const id = await findCategoryId(result.category);
        if (id) {
          setCatSuggestion({ name: result.category, id, source: result.source });
        }
      }
    } catch {}
    setCatLoading(false);
  }, [description, amount, categoryId, catLoading]);

  const savingRef = useRef(false);
  const handleSubmit = () => {
    if (savingRef.current) return;
    /* M3.3: validate */
    const e = {};
    if (!amount || parseFloat(amount) <= 0) e.amount = 'Укажите сумму';
    if (!categoryId) e.category = 'Выберите категорию';
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});

    const data = {
      amount: parseFloat(amount),
      amount_base: parseFloat(amount),
      currency: getCurrencyCode(),
      category_id: categoryId,
      category_path_snapshot: selectedCategory?.name || '',
      description: description.trim(),
      date,
      time,
      ts: expense?.ts || Date.now(),
      account_id: accountId,
      account_name_snapshot: selectedAccount?.name || selectedAccount?.bank || '',
      source: expense?.source || 'manual',
      created_at: expense?.created_at || new Date().toISOString(),
      recurrence: recurrence !== 'none' ? recurrence : null,
      split_total: isSplit && splitTotal ? parseFloat(splitTotal) : null,
      split_people: isSplit ? splitPeople : null,
    };
    if (expense?.id) data.id = expense.id;
    savingRef.current = true;
    onSave(data);
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full" style={{ background: theme.gray3 }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3">
        <button
          onClick={onClose}
          className="text-base font-medium"
          style={{ color: theme.accent }}
        >
          Отмена
        </button>
        <span className="text-base font-semibold" style={{ color: theme.text }}>
          {isEdit ? 'Редактировать расход' : 'Новый расход'}
        </span>
        {isEdit ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm font-medium"
            style={{ color: theme.red }}
          >
            Удалить
          </button>
        ) : (
          <span className="w-14" />
        )}
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-6">
        {/* Amount — proto S14 hero style */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: theme.gray2, marginBottom: 4, display: 'block' }}>Сумма</label>
          <div className="flex items-center" style={{ gap: 8 }}>
            <div className="flex items-center flex-1"
              style={{ background: theme.gray5, borderRadius: 12, padding: '12px 14px' }}>
              <input type="number" inputMode="decimal" value={amount}
                onChange={e => setAmount(e.target.value)} placeholder="0"
                className="flex-1 bg-transparent outline-none tabular-nums"
                style={{ fontSize: 28, fontWeight: 700, color: theme.text, border: 'none', width: '100%' }}
              />
              <span style={{ fontSize: 18, fontWeight: 500, color: theme.gray2 }}>{getCurrencySymbol()}</span>
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
          {errors.amount && <span style={{ fontSize: 12, color: theme.red, display: 'block', marginTop: 4 }}>{errors.amount}</span>}
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block"
            style={{ color: theme.gray1 }}>Описание</label>
          <input
            type="text"
            value={description}
            onChange={e => { setDescription(e.target.value); setCatSuggestion(null); }}
            onBlur={handleDescBlur}
            placeholder="Кофе в старбаксе"
            className="w-full rounded-xl px-4 py-3 text-base outline-none"
            style={{ background: theme.card, color: theme.text }}
          />
          {catLoading && <span className="text-[10px] mt-1 block" style={{ color: theme.gray2 }}>🤖 Определяю категорию...</span>}
        </div>

        {/* A2.2: OCR items */}
        {ocrItems && ocrItems.length > 0 && (
          <div className="rounded-xl p-3" style={{ background: theme.accent + '08' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: theme.accent }}>📸 Позиции из чека</div>
            {ocrItems.map((item, i) => (
              <div key={i} className="flex justify-between text-xs py-0.5" style={{ color: theme.text }}>
                <span className="truncate flex-1">{item.name}</span>
                <span className="font-medium ml-2">{item.price}₸{item.qty > 1 ? ` ×${item.qty}` : ''}</span>
              </div>
            ))}
            <button onClick={() => setOcrItems(null)} className="text-[10px] mt-2"
              style={{ color: theme.gray2, background: 'none', border: 'none', cursor: 'pointer' }}>
              Скрыть
            </button>
          </div>
        )}
        {errors.ocr && <span className="text-xs" style={{ color: theme.red }}>{errors.ocr}</span>}

        {/* Category */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-2 block"
            style={{ color: theme.gray1 }}>Категория</label>

          {/* A2.3: AI suggestion */}
          {catSuggestion && !categoryId && (
            <button
              onClick={() => { setCategoryId(catSuggestion.id); setCatSuggestion(null); }}
              className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl text-sm w-full text-left"
              style={{ background: theme.accent + '10', color: theme.accent, border: `1px dashed ${theme.accent}40`, cursor: 'pointer' }}
            >
              <span>🤖</span>
              <span>Предложение: <b>{catSuggestion.name}</b></span>
              <span className="ml-auto text-xs">Применить →</span>
            </button>
          )}
          <CategoryPicker
            module="expense"
            selected={categoryId}
            onSelect={setCategoryId}
            theme={theme}
          />
        </div>

        {/* Account */}
        <div>
          <SelectTrigger
            label="Счёт"
            value={selectedAccount?.name || selectedAccount?.bank}
            placeholder="Не выбран"
            onClick={() => setShowAccountSheet(true)}
            theme={theme}
          />
        </div>

        {/* Date & Time */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: theme.gray1 }}>Дата</label>
            <DatePicker value={date} onChange={setDate} mode="date" theme={theme} />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: theme.gray1 }}>Время</label>
            <DatePicker value={time} onChange={setTime} mode="time" theme={theme} />
          </div>
        </div>

        {/* A2.1: Recurrence */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block"
            style={{ color: theme.gray1 }}>Повтор</label>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { v: 'none', l: 'Разовый' },
              { v: 'daily', l: 'Ежедневно' },
              { v: 'weekly', l: 'Еженедельно' },
              { v: 'monthly', l: 'Ежемесячно' },
              { v: 'yearly', l: 'Ежегодно' },
            ].map(opt => (
              <button key={opt.v} onClick={() => setRecurrence(opt.v)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium"
                style={{
                  background: recurrence === opt.v ? theme.accent + '15' : theme.gray6,
                  color: recurrence === opt.v ? theme.accent : theme.gray1,
                  border: recurrence === opt.v ? `1.5px solid ${theme.accent}` : '1.5px solid transparent',
                }}>{opt.l}</button>
            ))}
          </div>
          {recurrence !== 'none' && (
            <span className="text-[10px] mt-1 block" style={{ color: theme.gray2 }}>
              🔄 Расход будет автоматически создаваться
            </span>
          )}
        </div>

        {/* A2.10: Сплит-расход */}
        <div>
          <button
            onClick={() => {
              const next = !isSplit;
              setIsSplit(next);
              if (!next) { setSplitTotal(''); setSplitPeople(2); }
            }}
            className="flex items-center gap-2 text-sm font-medium py-2"
            style={{ color: isSplit ? theme.accent : theme.gray2, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 18 }}>{isSplit ? '✅' : '👥'}</span>
            Разделить счёт
          </button>
          {isSplit && (
            <div className="rounded-xl p-3 space-y-3" style={{ background: theme.gray6 }}>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: theme.gray1 }}>Общий счёт</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={splitTotal}
                  onChange={e => {
                    setSplitTotal(e.target.value);
                    const total = parseFloat(e.target.value);
                    if (total > 0 && splitPeople > 0) {
                      setAmount(String(Math.round(total / splitPeople * 100) / 100));
                    }
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg text-base"
                  style={{ background: theme.card, color: theme.text, border: `1px solid ${theme.gray4}` }}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: theme.gray1 }}>Человек</label>
                <div className="flex items-center gap-3">
                  {[2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => {
                        setSplitPeople(n);
                        const total = parseFloat(splitTotal);
                        if (total > 0) setAmount(String(Math.round(total / n * 100) / 100));
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-medium"
                      style={{
                        background: splitPeople === n ? theme.accent + '15' : theme.card,
                        color: splitPeople === n ? theme.accent : theme.gray1,
                        border: splitPeople === n ? `1.5px solid ${theme.accent}` : `1px solid ${theme.gray4}`,
                      }}
                    >{n}</button>
                  ))}
                </div>
              </div>
              {splitTotal && parseFloat(splitTotal) > 0 && (
                <div className="text-sm font-medium pt-1" style={{ color: theme.accent }}>
                  Ваша доля: {Math.round(parseFloat(splitTotal) / splitPeople * 100) / 100} {getCurrencySymbol()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Source badge (read-only, edit mode) */}
        {isEdit && expense.source !== 'manual' && (
          <div className="text-sm" style={{ color: theme.gray2 }}>
            Источник: {expense.source === 'voice' ? '🎤 голос' : expense.source === 'ai' ? '🤖 AI' : expense.source === 'ocr' ? '📸 OCR' : expense.source}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!amount || !categoryId}
          className="w-full py-3.5 rounded-xl font-semibold text-base transition-opacity"
          style={{
            background: (!amount || !categoryId) ? theme.gray4 : theme.green,
            color: '#fff',
            opacity: (!amount || !categoryId) ? 0.6 : 1,
          }}
        >
          💚 {isEdit ? 'Сохранить изменения' : 'Сохранить'}
        </button>

        {/* S14: Daily budget hint */}
        {dailyBudget && dailyBudget.daily > 0 && (
          <div style={{ marginTop: 10, textAlign: 'center', fontSize: 12, color: theme.gray2 }}>
            Осталось на сегодня: <span style={{ fontWeight: 600, color: dailyBudget.remaining > 0 ? theme.orange : theme.red }}>
              {fmtMoney(Math.max(0, dailyBudget.remaining))}
            </span> из {fmtMoney(dailyBudget.daily)}
          </div>
        )}
      </div>
      <IOSKeyboardSpacer />
      <ConfirmSheet
        open={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Удалить расход?"
        message={`«${expense?.description || 'Расход'}» будет удалён`}
        confirmLabel="Удалить"
        onConfirm={() => { setShowDeleteConfirm(false); onDelete(expense.id); }}
        theme={theme}
      />
      <SelectSheet
        open={showAccountSheet}
        onClose={() => setShowAccountSheet(false)}
        title="Счёт"
        options={accounts?.map(a => ({ id: a.id, label: a.name || a.bank })) || []}
        value={accountId}
        onSelect={id => setAccountId(Number(id))}
        theme={theme}
      />
    </div>
  );
}
