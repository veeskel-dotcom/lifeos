/**
 * R3.2 + R3.3: Финансовые инструменты — налоговый вычет + кэшбэк.
 */
import { useState, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import { fmtMoney } from '../../utils/currency';
import { getSetting, setSetting } from '../../db/helpers';
import FormInput from '../../components/FormInput';

/* ═══ R3.2: Налоговый вычет (KZ/RU) ═══ */

const DEDUCTION_TYPES = [
  { id: 'education', label: 'Образование', icon: '📚', maxRU: 150000, maxKZ: 0 },
  { id: 'medical', label: 'Лечение', icon: '💊', maxRU: 150000, maxKZ: 0 },
  { id: 'iis', label: 'ИИС (тип А)', icon: '📈', maxRU: 400000, maxKZ: 0 },
  { id: 'property', label: 'Покупка жилья', icon: '🏠', maxRU: 2000000, maxKZ: 0 },
  { id: 'mortgage', label: 'Проценты ипотеки', icon: '🏦', maxRU: 3000000, maxKZ: 0 },
  { id: 'opv', label: 'ОПВ (КЗ)', icon: '🇰🇿', maxRU: 0, maxKZ: Infinity },
];

function TaxDeductionCalc({ theme }) {
  const [income, setIncome] = useState('');
  const [selected, setSelected] = useState([]);
  const [amounts, setAmounts] = useState({});

  const annualIncome = parseFloat(income) * 12 || 0;
  const taxPaid = annualIncome * 0.13;

  const totalDeduction = selected.reduce((sum, id) => {
    const type = DEDUCTION_TYPES.find(d => d.id === id);
    const amount = parseFloat(amounts[id]) || 0;
    const max = type?.maxRU || 0;
    return sum + Math.min(amount, max === Infinity ? amount : max);
  }, 0);

  const refund = Math.min(Math.round(totalDeduction * 0.13), Math.round(taxPaid));

  return (
    <Card theme={theme}>
      <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: theme.gray1 }}>
        📋 Налоговый вычет
      </div>

      <label className="text-[10px] mb-1 block" style={{ color: theme.gray2 }}>Зарплата в месяц (до налога)</label>
      <FormInput type="number" inputMode="decimal" value={income} onChange={setIncome} placeholder="0" theme={theme} />

      <div className="space-y-2 mb-3">
        {DEDUCTION_TYPES.filter(d => d.maxRU > 0).map(d => (
          <div key={d.id}>
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: theme.text }}
              onClick={() => setSelected(s => s.includes(d.id) ? s.filter(x => x !== d.id) : [...s, d.id])}>
              <span className="w-4 h-4 rounded border flex items-center justify-center text-[10px]"
                style={{ borderColor: selected.includes(d.id) ? theme.accent : theme.gray4,
                  background: selected.includes(d.id) ? theme.accent : 'transparent',
                  color: '#fff' }}>
                {selected.includes(d.id) ? '✓' : ''}
              </span>
              {d.icon} {d.label}
              {d.maxRU !== Infinity && <span className="text-[9px] ml-auto" style={{ color: theme.gray3 }}>макс {fmtMoney(d.maxRU)}</span>}
            </label>
            {selected.includes(d.id) && (
              <input type="number" inputMode="decimal" value={amounts[d.id] || ''}
                onChange={e => setAmounts(a => ({ ...a, [d.id]: e.target.value }))}
                placeholder="Сумма расходов" className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: theme.gray6, color: theme.text }} />
            )}
          </div>
        ))}
      </div>

      {annualIncome > 0 && (
        <div className="pt-3" style={{ borderTop: `0.5px solid ${theme.gray5}` }}>
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: theme.gray2 }}>НДФЛ уплачено за год</span>
            <span style={{ color: theme.text }}>{fmtMoney(taxPaid)}</span>
          </div>
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: theme.gray2 }}>База вычета</span>
            <span style={{ color: theme.text }}>{fmtMoney(totalDeduction)}</span>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-sm font-semibold" style={{ color: theme.green }}>Возврат</span>
            <span className="text-lg font-bold" style={{ color: theme.green }}>{fmtMoney(refund)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ═══ R3.3: Кэшбэк трекинг ═══ */

function CashbackTracker({ theme }) {
  const [entries, setEntries] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [card, setCard] = useState('');
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const raw = await getSetting('cashback_entries');
      setEntries(JSON.parse(raw) || []);
    } catch { setEntries([]); }
  };

  const handleAdd = async () => {
    if (!amount) return;
    const newEntry = {
      id: Date.now().toString(36),
      card: card || 'Основная',
      amount: parseFloat(amount),
      month,
      date: new Date().toISOString(),
    };
    const updated = [...entries, newEntry];
    await setSetting('cashback_entries', JSON.stringify(updated));
    setEntries(updated);
    setAmount('');
    setCard('');
    setShowAdd(false);
  };

  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthTotal = entries.filter(e => e.month === currentMonth).reduce((s, e) => s + e.amount, 0);
  const yearTotal = entries.filter(e => e.date?.startsWith(new Date().getFullYear().toString())).reduce((s, e) => s + e.amount, 0);

  return (
    <Card theme={theme}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>💳 Кэшбэк</span>
        <button onClick={() => setShowAdd(!showAdd)} className="text-xs font-medium"
          style={{ color: theme.accent, background: 'none', border: 'none', cursor: 'pointer' }}>
          {showAdd ? '✕' : '＋'}
        </button>
      </div>

      <div className="flex gap-4 mb-3">
        <div>
          <div className="text-[10px]" style={{ color: theme.gray2 }}>Этот месяц</div>
          <div className="text-sm font-bold" style={{ color: theme.green }}>{fmtMoney(thisMonthTotal)}</div>
        </div>
        <div>
          <div className="text-[10px]" style={{ color: theme.gray2 }}>За год</div>
          <div className="text-sm font-bold" style={{ color: theme.text }}>{fmtMoney(yearTotal)}</div>
        </div>
      </div>

      {showAdd && (
        <div className="space-y-2 mb-3 p-3 rounded-xl" style={{ background: theme.gray6 }}>
          <FormInput value={card} onChange={setCard} placeholder="Карта (напр. Kaspi Gold)" theme={theme} />
          <FormInput type="number" inputMode="decimal" value={amount} onChange={setAmount} placeholder="Сумма кэшбэка" theme={theme} />
          <button onClick={handleAdd} className="w-full py-2 rounded-lg text-xs font-semibold"
            style={{ background: theme.accent, color: '#fff', border: 'none', cursor: 'pointer' }}>
            Добавить
          </button>
        </div>
      )}

      {entries.slice(-5).reverse().map(e => (
        <div key={e.id} className="flex justify-between py-1.5 text-xs"
          style={{ borderBottom: `0.5px solid ${theme.gray6}` }}>
          <span style={{ color: theme.gray1 }}>{e.card}</span>
          <span className="font-medium" style={{ color: theme.green }}>+{fmtMoney(e.amount)}</span>
        </div>
      ))}
    </Card>
  );
}

/* ═══ Main ═══ */

export default function FinanceTools({ theme, onBack }) {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Финансовые инструменты" onBack={onBack} theme={theme} />
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        <TaxDeductionCalc theme={theme} />
        <CashbackTracker theme={theme} />
        <p className="text-[10px] text-center" style={{ color: theme.gray3 }}>
          Расчёты приблизительные. Не является финансовой консультацией.
        </p>
      </div>
    </div>
  );
}
