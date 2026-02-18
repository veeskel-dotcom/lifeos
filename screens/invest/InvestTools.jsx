/**
 * R5.1: ИИС вычет тип А/Б
 * R5.2: ОФЗ облигации
 * R5.3: Замороженные активы
 */
import { useState, useRef } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import FormInput from '../../components/FormInput';
import DatePicker from '../../components/DatePicker';
import Ic from '../../components/Icon';

const TABS = [
  { id: 'import', label: 'Импорт', ic: 'download' },
  { id: 'iis', label: 'ИИС', ic: 'shield' },
  { id: 'ofz', label: 'ОФЗ', ic: 'receipt' },
  { id: 'frozen', label: 'Заморозка', ic: 'lock' },
];

export default function InvestTools({ theme, onBack, onToast }) {
  const [tab, setTab] = useState('import');

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Инструменты" onBack={onBack} theme={theme} />

      {/* Tab bar */}
      <div className="flex gap-1 px-4 mb-3">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2 text-xs font-semibold rounded-xl"
            style={{
              background: tab === t.id ? theme.accent : theme.card,
              color: tab === t.id ? '#fff' : theme.gray1,
              border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
            <Ic name={t.ic} color={tab === t.id ? '#fff' : theme.gray1} size={14} r={3} raw /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {tab === 'import' && <BrokerImportPanel theme={theme} onToast={onToast} />}
        {tab === 'iis' && <IISCalculator theme={theme} />}
        {tab === 'ofz' && <OFZTracker theme={theme} />}
        {tab === 'frozen' && <FrozenAssets theme={theme} />}
      </div>

      <DatePicker open={showMaturityPicker} onClose={() => setShowMaturityPicker(false)} value={maturity} onChange={setMaturity} theme={theme} />
    </div>
  );
}

/* E9: Импорт позиций брокера */
function BrokerImportPanel({ theme, onToast }) {
  const [mode, setMode] = useState(null); // 'screenshot' | 'text'
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null); // { positions, broker }
  const [stats, setStats] = useState(null);
  const fileRef = useRef(null);

  const handleScreenshot = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setPreview(null);
    setStats(null);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const { importFromScreenshot } = await import('../../services/brokerImport');
      const result = await importFromScreenshot(base64);
      setPreview(result);
    } catch (err) {
      onToast?.(`⚠️ ${err.message || 'Ошибка распознавания'}`);
    }
    setLoading(false);
    e.target.value = '';
  };

  const handleText = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setPreview(null);
    setStats(null);
    try {
      const { importFromText } = await import('../../services/brokerImport');
      const result = await importFromText(text);
      setPreview(result);
    } catch (err) {
      onToast?.(`⚠️ ${err.message || 'Ошибка распознавания'}`);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!preview?.positions?.length) return;
    setLoading(true);
    try {
      const { saveImportedPositions } = await import('../../services/brokerImport');
      const result = await saveImportedPositions(preview.positions, preview.broker);
      setStats(result);
      onToast?.(`✅ Добавлено: ${result.added}, обновлено: ${result.updated}`);
    } catch (err) {
      onToast?.(`⚠️ ${err.message}`);
    }
    setLoading(false);
  };

  if (!mode) {
    return (
      <div className="space-y-3">
        <Card theme={theme}>
          <div className="text-sm font-semibold mb-1" style={{ color: theme.text }}>Импорт портфеля</div>
          <div className="text-xs mb-4" style={{ color: theme.gray2 }}>
            Загрузите скриншот или вставьте текст из брокерского приложения
          </div>
          <div className="space-y-2">
            <button onClick={() => { setMode('screenshot'); setTimeout(() => fileRef.current?.click(), 100); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left"
              style={{ background: theme.gray6, border: 'none', cursor: 'pointer' }}>
              <Ic name="camera" color={theme.accent} size={32} r={9} />
              <div>
                <div className="text-sm font-semibold" style={{ color: theme.text }}>Скриншот</div>
                <div className="text-[10px]" style={{ color: theme.gray2 }}>Тинькофф, БКС, Freedom, IB</div>
              </div>
            </button>
            <button onClick={() => setMode('text')}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left"
              style={{ background: theme.gray6, border: 'none', cursor: 'pointer' }}>
              <Ic name="note" color={theme.accent} size={32} r={9} />
              <div>
                <div className="text-sm font-semibold" style={{ color: theme.text }}>Текст / копипаста</div>
                <div className="text-[10px]" style={{ color: theme.gray2 }}>Отчёт брокера или описание позиций</div>
              </div>
            </button>
          </div>
        </Card>
        <Card theme={theme}>
          <div className="text-xs" style={{ color: theme.gray2 }}>
            Примеры текстового ввода:
          </div>
          <div className="text-[10px] mt-1 space-y-0.5" style={{ color: theme.gray2 }}>
            <div>• «10 акций Сбера по 260, 5 Газпрома по 155»</div>
            <div>• Копипаста таблицы из Тинькофф Инвестиции</div>
            <div>• CSV из брокерского отчёта</div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button onClick={() => { setMode(null); setPreview(null); setStats(null); setText(''); }}
        className="text-sm font-medium" style={{ color: theme.accent, background: 'none', border: 'none', cursor: 'pointer' }}>
        ← Назад
      </button>

      {mode === 'screenshot' && (
        <Card theme={theme}>
          <div className="text-sm font-semibold mb-2" style={{ color: theme.text, display: 'flex', alignItems: 'center', gap: 6 }}><Ic name="camera" color={theme.accent} size={18} r={5} raw /> Скриншот портфеля</div>
          <button onClick={() => fileRef.current?.click()} disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-medium"
            style={{ background: theme.accent + '15', color: theme.accent, border: `1px dashed ${theme.accent}40`, cursor: 'pointer' }}>
            {loading ? 'Распознаю...' : 'Выбрать фото'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleScreenshot} />
        </Card>
      )}

      {mode === 'text' && (
        <Card theme={theme}>
          <div className="text-sm font-semibold mb-2" style={{ color: theme.text, display: 'flex', alignItems: 'center', gap: 6 }}><Ic name="note" color={theme.accent} size={18} r={5} raw /> Текст позиций</div>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="10 акций Сбера по 260&#10;5 Газпрома по 155&#10;3 ETF TMOS по 6.5"
            rows={5} className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none"
            style={{ background: theme.gray6, color: theme.text }} />
          <button onClick={handleText} disabled={loading || !text.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-semibold mt-2"
            style={{ background: text.trim() ? theme.accent : theme.gray4, color: '#fff', border: 'none', cursor: 'pointer' }}>
            {loading ? 'Распознаю...' : 'Распознать'}
          </button>
        </Card>
      )}

      {/* Preview */}
      {preview && preview.positions.length > 0 && (
        <Card theme={theme}>
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-semibold" style={{ color: theme.text }}>
              Найдено {preview.positions.length} позиций
            </div>
            {preview.broker && (
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: theme.accent + '15', color: theme.accent }}>
                {preview.broker}
              </span>
            )}
          </div>
          {preview.positions.map((p, i) => (
            <div key={i} className="flex justify-between items-center py-1.5 text-xs"
              style={{ borderTop: i > 0 ? `1px solid ${theme.gray5}` : 'none' }}>
              <div>
                <span className="font-semibold" style={{ color: theme.text }}>{p.ticker}</span>
                <span className="ml-1" style={{ color: theme.gray2 }}>{p.name}</span>
              </div>
              <div className="text-right">
                <span className="font-medium" style={{ color: theme.text }}>{p.quantity} шт</span>
                {p.avg_price && (
                  <span className="ml-1" style={{ color: theme.gray2 }}>@ {p.avg_price}</span>
                )}
              </div>
            </div>
          ))}
          {!stats && (
            <button onClick={handleSave} disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold mt-3"
              style={{ background: theme.green, color: '#fff', border: 'none', cursor: 'pointer' }}>
              {loading ? 'Сохраняю...' : `Сохранить ${preview.positions.length} позиций`}
            </button>
          )}
          {stats && (
            <div className="text-center py-2 text-xs" style={{ color: theme.green }}>
              <Ic name="check" color={theme.green} size={14} r={3} raw /> Добавлено: {stats.added} · Обновлено: {stats.updated}
              {stats.skipped > 0 && <span style={{ color: theme.gray2 }}> · Пропущено: {stats.skipped}</span>}
            </div>
          )}
        </Card>
      )}

      {preview && preview.positions.length === 0 && (
        <Card theme={theme}>
          <div className="text-center py-4 text-sm" style={{ color: theme.gray2 }}>
            Позиции не найдены. Попробуйте другой скриншот или текст.
          </div>
        </Card>
      )}
    </div>
  );
}

/* R5.1: ИИС калькулятор вычета */
function IISCalculator({ theme }) {
  const [type, setType] = useState('a');
  const [annual, setAnnual] = useState('');
  const [income, setIncome] = useState('');

  const amount = parseFloat(annual) || 0;
  const salary = parseFloat(income) || 0;

  // Тип А: 13% от взноса, макс 400k → 52k
  const typeA_base = Math.min(amount, 400000);
  const typeA_ndfl = salary * 0.13;
  const typeA = Math.min(typeA_base * 0.13, typeA_ndfl);

  // Тип Б: освобождение прибыли от НДФЛ (показываем экономию на типичной доходности)
  const estimatedReturn = amount * 0.12; // ~12% годовых
  const typeB = estimatedReturn * 0.13;

  return (
    <div className="space-y-3">
      <Card theme={theme}>
        <div className="text-sm font-semibold mb-3" style={{ color: theme.text }}>Тип вычета</div>
        <div className="flex gap-2 mb-3">
          {['a', 'b'].map(t => (
            <button key={t} onClick={() => setType(t)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: type === t ? theme.accent + '20' : theme.gray6,
                color: type === t ? theme.accent : theme.gray1,
                border: type === t ? `1.5px solid ${theme.accent}` : `1px solid transparent`,
                cursor: 'pointer',
              }}>
              Тип {t.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="text-[10px] mb-3 px-1" style={{ color: theme.gray2 }}>
          {type === 'a'
            ? 'Возврат 13% от взноса (до 400 000₸/год). Нужен доход с НДФЛ.'
            : 'Освобождение прибыли от НДФЛ при закрытии через 3+ года.'
          }
        </div>
      </Card>

      <Card theme={theme}>
        <label className="text-xs font-medium block mb-1" style={{ color: theme.gray1 }}>Взнос за год, ₸</label>
        <FormInput type="number" inputMode="numeric" value={annual} onChange={setAnnual} placeholder="400 000" theme={theme} />

        {type === 'a' && (
          <>
            <label className="text-xs font-medium block mb-1" style={{ color: theme.gray1 }}>Годовой доход (для НДФЛ), ₸</label>
            <FormInput type="number" inputMode="numeric" value={income} onChange={setIncome} placeholder="3 000 000" theme={theme} />
          </>
        )}
      </Card>

      {amount > 0 && (
        <Card theme={theme} style={{ background: theme.green + '10' }}>
          <div className="text-center">
            <div className="text-[10px] uppercase font-semibold" style={{ color: theme.gray1 }}>
              {type === 'a' ? 'Вычет (возврат НДФЛ)' : 'Экономия на НДФЛ с прибыли'}
            </div>
            <div className="text-2xl font-bold mt-1" style={{ color: theme.green }}>
              {Math.round(type === 'a' ? typeA : typeB).toLocaleString('ru-RU')} ₸
            </div>
            {type === 'a' && (
              <div className="text-[10px] mt-1" style={{ color: theme.gray2 }}>
                Макс. вычет: {Math.round(typeA_base * 0.13).toLocaleString()} ₸ · Уплаченный НДФЛ: {Math.round(typeA_ndfl).toLocaleString()} ₸
              </div>
            )}
            {type === 'b' && (
              <div className="text-[10px] mt-1" style={{ color: theme.gray2 }}>
                При доходности ~12% годовых
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

/* R5.2: ОФЗ трекер */
function OFZTracker({ theme }) {
  const [bonds, setBonds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ofz_bonds') || '[]'); } catch { return []; }
  });
  const [name, setName] = useState('');
  const [nominal, setNominal] = useState('1000');
  const [coupon, setCoupon] = useState('');
  const [quantity, setQuantity] = useState('');
  const [maturity, setMaturity] = useState('');
  const [showMaturityPicker, setShowMaturityPicker] = useState(false);

  const save = (list) => {
    setBonds(list);
    try { localStorage.setItem('ofz_bonds', JSON.stringify(list)); } catch {}
  };

  const handleAdd = () => {
    if (!name || !coupon) return;
    save([...bonds, {
      id: Date.now(),
      name: name.trim(),
      nominal: parseFloat(nominal) || 1000,
      coupon_rate: parseFloat(coupon) || 0,
      quantity: parseInt(quantity) || 1,
      maturity: maturity || null,
    }]);
    setName(''); setCoupon(''); setQuantity(''); setMaturity('');
  };

  const totalNominal = bonds.reduce((s, b) => s + b.nominal * b.quantity, 0);
  const annualCoupon = bonds.reduce((s, b) => s + b.nominal * (b.coupon_rate / 100) * b.quantity, 0);

  return (
    <div className="space-y-3">
      {bonds.length > 0 && (
        <Card theme={theme}>
          <div className="flex justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: theme.gray1 }}>Номинал</span>
            <span className="text-sm font-bold" style={{ color: theme.text }}>{totalNominal.toLocaleString('ru-RU')} ₸</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs font-medium" style={{ color: theme.gray1 }}>Купонный доход/год</span>
            <span className="text-sm font-bold" style={{ color: theme.green }}>{Math.round(annualCoupon).toLocaleString('ru-RU')} ₸</span>
          </div>
        </Card>
      )}

      {bonds.map(b => (
        <Card key={b.id} theme={theme}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold" style={{ color: theme.text }}>{b.name}</div>
              <div className="text-[10px]" style={{ color: theme.gray2 }}>
                {b.quantity} шт × {b.nominal}₸ · Купон {b.coupon_rate}%
                {b.maturity && ` · Погаш. ${b.maturity}`}
              </div>
            </div>
            <button onClick={() => save(bonds.filter(x => x.id !== b.id))}
              style={{ color: theme.red, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        </Card>
      ))}

      <Card theme={theme}>
        <div className="text-xs font-semibold mb-2" style={{ color: theme.gray1 }}>Добавить облигацию</div>
        <FormInput value={name} onChange={setName} placeholder="ОФЗ 26230" theme={theme} />
        <div className="grid grid-cols-2 gap-2 mb-2">
          <FormInput type="number" value={coupon} onChange={setCoupon} placeholder="Купон %" theme={theme} />
          <FormInput type="number" value={quantity} onChange={setQuantity} placeholder="Кол-во" theme={theme} />
        </div>
        <div onClick={() => setShowMaturityPicker(true)}
          className="w-full px-3 py-2 rounded-lg text-xs cursor-pointer mb-2"
          style={{ background: theme.gray6, color: maturity ? theme.text : theme.gray3 }}>
          {maturity || 'Дата погашения'}
        </div>
        <button onClick={handleAdd} disabled={!name || !coupon}
          className="w-full py-2 rounded-lg text-xs font-semibold"
          style={{ background: name && coupon ? theme.accent : theme.gray4, color: '#fff', border: 'none', cursor: 'pointer' }}>
          Добавить
        </button>
      </Card>
    </div>
  );
}

/* R5.3: Замороженные активы */
function FrozenAssets({ theme }) {
  const [assets, setAssets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('frozen_assets') || '[]'); } catch { return []; }
  });
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('sanctions');

  const REASONS = [
    { id: 'sanctions', label: 'Санкции' },
    { id: 'blocked', label: 'Заблокировано' },
    { id: 'pending', label: 'На разблокировке' },
  ];

  const save = (list) => {
    setAssets(list);
    try { localStorage.setItem('frozen_assets', JSON.stringify(list)); } catch {}
  };

  const handleAdd = () => {
    if (!name || !amount) return;
    save([...assets, {
      id: Date.now(),
      name: name.trim(),
      amount: parseFloat(amount) || 0,
      reason,
      added_at: new Date().toISOString().slice(0, 10),
    }]);
    setName(''); setAmount('');
  };

  const total = assets.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="space-y-3">
      {assets.length > 0 && (
        <Card theme={theme} style={{ background: theme.red + '08' }}>
          <div className="text-center">
            <div className="text-[10px] uppercase font-semibold" style={{ color: theme.gray1 }}>Заморожено</div>
            <div className="text-xl font-bold" style={{ color: theme.red }}>{total.toLocaleString('ru-RU')} ₸</div>
          </div>
        </Card>
      )}

      {assets.map(a => (
        <Card key={a.id} theme={theme}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold" style={{ color: theme.text }}>{a.name}</div>
              <div className="text-[10px]" style={{ color: theme.gray2 }}>
                {a.amount.toLocaleString()} ₸ · {REASONS.find(r => r.id === a.reason)?.label} · {a.added_at}
              </div>
            </div>
            <button onClick={() => save(assets.filter(x => x.id !== a.id))}
              style={{ color: theme.gray2, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        </Card>
      ))}

      <Card theme={theme}>
        <div className="text-xs font-semibold mb-2" style={{ color: theme.gray1 }}>Добавить актив</div>
        <FormInput value={name} onChange={setName} placeholder="Название / тикер" theme={theme} />
        <FormInput type="number" value={amount} onChange={setAmount} placeholder="Стоимость, ₸" theme={theme} />
        <div className="flex gap-1 mb-2">
          {REASONS.map(r => (
            <button key={r.id} onClick={() => setReason(r.id)}
              className="flex-1 py-1.5 text-[10px] font-medium rounded-lg"
              style={{
                background: reason === r.id ? theme.red + '15' : theme.gray6,
                color: reason === r.id ? theme.red : theme.gray2,
                border: 'none', cursor: 'pointer',
              }}>
              {r.label}
            </button>
          ))}
        </div>
        <button onClick={handleAdd} disabled={!name || !amount}
          className="w-full py-2 rounded-lg text-xs font-semibold"
          style={{ background: name && amount ? theme.accent : theme.gray4, color: '#fff', border: 'none', cursor: 'pointer' }}>
          Добавить
        </button>
      </Card>
    </div>
  );
}
