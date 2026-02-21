import { useState, useRef } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import { addTrade } from '../../services/trades';
import { getCurrencySymbol, getCurrencyCode, fmtMoney, getSymbolForCode } from '../../utils/currency';
import IOSKeyboardSpacer from '../../components/IOSKeyboardSpacer';
import { CURRENCY_CODES as CURRENCIES } from '../../utils/constants';
import FormInput from '../../components/FormInput';
import SelectSheet from '../../components/SelectSheet';

const BROKERS = ['Тинькофф Инвестиции', 'БКС', 'Финам', 'Другой'];
/* E6: типы активов */
const ASSET_TYPES = [
  { v: 'stock', l: '📈 Акция' },
  { v: 'bond', l: '📄 Облигация' },
  { v: 'etf', l: '📊 ETF' },
  { v: 'fund', l: '🏦 Фонд' },
  { v: 'crypto', l: '₿ Крипто' },
];

export default function TradeForm({ theme, onBack, initialTicker }) {
  const [ticker, setTicker] = useState(initialTicker || '');
  const [name, setName] = useState('');
  const [type, setType] = useState('buy');
  const [assetType, setAssetType] = useState('stock');
  const [tradeCurrency, setTradeCurrency] = useState(getCurrencyCode());
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [commission, setCommission] = useState('');
  const [broker, setBroker] = useState(BROKERS[0]);
  const [showBrokerSheet, setShowBrokerSheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sector, setSector] = useState('');

  const total = (parseFloat(quantity) || 0) * (parseFloat(price) || 0);
  const canSave = ticker.trim() && parseFloat(quantity) > 0 && parseFloat(price) > 0;
  const savingRef = useRef(false);

  const handleSave = async () => {
    if (!canSave || savingRef.current) return;
    savingRef.current = true;
    try {
      await addTrade({
        ticker: ticker.trim().toUpperCase(),
        name: name.trim() || ticker.trim().toUpperCase(),
        type,
        quantity: parseFloat(quantity),
        price: parseFloat(price),
        commission: parseFloat(commission) || 0,
        broker,
        date,
        sector: sector || 'Прочее',
        assetType,
        currency: tradeCurrency,
      });
      onBack();
    } finally {
      savingRef.current = false;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <NavHeader title="Новая сделка" onBack={onBack} theme={theme} />

      <div className="flex-1 overflow-auto px-4 pb-8">
        {/* Ticker */}
        <input
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          className="w-full text-lg font-bold bg-transparent outline-none mb-1"
          style={{ color: theme.text }}
          placeholder="ТИКЕР"
          autoFocus
        />
        <FormInput value={name} onChange={setName} placeholder="Название компании (необязательно)" theme={theme} />

        {/* Buy / Sell */}
        <div className="flex gap-2 mb-4">
          {['buy', 'sell'].map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: type === t
                  ? (t === 'buy' ? theme.green + '20' : theme.red + '20')
                  : theme.gray6,
                color: type === t
                  ? (t === 'buy' ? theme.green : theme.red)
                  : theme.gray1,
                border: type === t
                  ? `1.5px solid ${t === 'buy' ? theme.green : theme.red}`
                  : '1.5px solid transparent',
              }}
            >
              {t === 'buy' ? '🟢 Покупка' : '🔴 Продажа'}
            </button>
          ))}
        </div>

        {/* E6: Asset type */}
        <div className="flex gap-1.5 flex-wrap mb-3">
          {ASSET_TYPES.map(a => (
            <button key={a.v} onClick={() => setAssetType(a.v)}
              className="px-2.5 py-1.5 rounded-xl text-xs"
              style={{
                background: assetType === a.v ? theme.accent : theme.gray6,
                color: assetType === a.v ? '#fff' : theme.text,
              }}>{a.l}</button>
          ))}
        </div>

        {/* E6: Currency */}
        <div className="flex gap-1.5 mb-4">
          {CURRENCIES.map(c => (
            <button key={c} onClick={() => setTradeCurrency(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: tradeCurrency === c ? theme.accent + '20' : theme.gray6,
                color: tradeCurrency === c ? theme.accent : theme.gray2,
                border: tradeCurrency === c ? `1px solid ${theme.accent}` : '1px solid transparent',
              }}>{c}</button>
          ))}
        </div>

        {/* Fields */}
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          <FieldRow theme={theme} label="Количество" border>
            <FormInput type="number" inputMode="numeric" value={quantity} onChange={setQuantity} placeholder="0" theme={theme} />
          </FieldRow>
          <FieldRow theme={theme} label="Цена" border>
            <FormInput type="number" inputMode="decimal" value={price} onChange={setPrice} placeholder="0.00" theme={theme} />
          </FieldRow>
          <FieldRow theme={theme} label="Комиссия" border>
            <FormInput type="number" inputMode="decimal" value={commission} onChange={setCommission} placeholder="0" theme={theme} />
          </FieldRow>
          <FieldRow theme={theme} label="Дата" border>
            <span onClick={() => setShowDatePicker(true)}
              className="text-sm text-right cursor-pointer"
              style={{ color: theme.accent }}>{date || 'Выбрать'}</span>
          </FieldRow>
          <FieldRow theme={theme} label="Брокер">
            <span onClick={() => setShowBrokerSheet(true)}
              className="text-sm text-right cursor-pointer"
              style={{ color: theme.accent }}>{broker}</span>
          </FieldRow>
        </Card>

        {/* Sector */}
        <FormInput value={sector} onChange={setSector} placeholder="Сектор (Финансы, IT, Нефть...)" theme={theme} />

        {/* Total */}
        {total > 0 && (
          <div className="text-center mb-4">
            <span className="text-xs" style={{ color: theme.gray1 }}>Сумма сделки: </span>
            <span className="text-base font-semibold" style={{ color: theme.text }}>
              {fmtMoney(total, getSymbolForCode(tradeCurrency))}
            </span>
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="w-full py-3.5 rounded-xl text-white text-base font-semibold"
          style={{ background: canSave ? theme.accent : theme.gray3 }}
        >
          {type === 'buy' ? 'Записать покупку' : 'Записать продажу'}
        </button>
      </div>
      <IOSKeyboardSpacer />
      <SelectSheet
        open={showBrokerSheet}
        onClose={() => setShowBrokerSheet(false)}
        title="Брокер"
        options={BROKERS.map(b => ({ id: b, label: b }))}
        value={broker}
        onSelect={setBroker}
        theme={theme}
      />
    </div>
  );
}

function FieldRow({ theme, label, border, children }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderBottom: border ? `0.5px solid ${theme.gray5}` : 'none' }}
    >
      <span className="text-sm" style={{ color: theme.text }}>{label}</span>
      {children}
    </div>
  );
}
