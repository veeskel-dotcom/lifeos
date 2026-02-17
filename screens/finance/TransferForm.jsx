import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from '../../hooks/useDB';
import { getActiveAccounts, transferBetweenAccounts } from '../../services/accounts';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import { fmtMoney } from '../../utils/currency';
import ScreenWrapper from '../../components/ScreenWrapper';
import FormInput from '../../components/FormInput';
import FormButton from '../../components/FormButton';

export default function TransferForm({ theme, onBack, onToast }) {
  const accounts = useLiveQuery(() => getActiveAccounts().catch(() => []));

  const [fromId, setFromId] = useState(null);
  const [toId, setToId] = useState(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const amountRef = useRef(null);

  /* M3.4 autofocus */
  useEffect(() => { amountRef.current?.focus(); }, []);

  /* M3.3 inline validation */
  function validate() {
    const e = {};
    if (!fromId) e.from = 'Выберите счёт';
    if (!toId) e.to = 'Выберите счёт';
    if (fromId && toId && fromId === toId) e.to = 'Выберите другой счёт';
    const num = parseFloat(amount);
    if (!num || num <= 0) e.amount = 'Сумма должна быть > 0';

    // Check from balance
    if (fromId && num > 0) {
      const fromAcc = accounts?.find(a => a.id === fromId);
      if (fromAcc && num > (fromAcc.balance || 0)) {
        e.amount = `Недостаточно средств (${fmtMoney(fromAcc.balance || 0)})`;
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await transferBetweenAccounts(fromId, toId, parseFloat(amount), description);
      onToast?.(`Переведено ${fmtMoney(parseFloat(amount))}`);
      onBack();
    } catch (err) {
      setErrors({ submit: err.message || 'Ошибка перевода' });
    } finally {
      setLoading(false);
    }
  };

  if (!accounts) return null;

  const fromAcc = accounts.find(a => a.id === fromId);
  const toAcc = accounts.find(a => a.id === toId);

  return (
    <ScreenWrapper theme={theme}>
      <NavHeader title="Перевод между счетами" onBack={onBack} left theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">

        {/* Amount */}
        <Card theme={theme}>
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>Сумма</label>
          <FormInput type="number" inputMode="decimal" value={amount} onChange={setAmount} placeholder="0" theme={theme} />
          {errors.amount && <span className="text-xs mt-1 block" style={{ color: theme.red }}>{errors.amount}</span>}
        </Card>

        {/* From account */}
        <Card theme={theme}>
          <label style={{ fontSize: 12, fontWeight: 500, color: theme.gray2, marginBottom: 4, display: 'block' }}>Откуда</label>
          <div className="space-y-2 mt-2">
            {accounts.map(acc => (
              <div
                key={acc.id}
                className="flex items-center justify-between cursor-pointer"
                style={{
                  padding: '12px 14px', borderRadius: 12,
                  background: fromId === acc.id ? theme.accent + '15' : theme.gray6,
                  border: fromId === acc.id ? `1.5px solid ${theme.accent}` : '1.5px solid transparent',
                }}
                onClick={() => setFromId(acc.id)}
              >
                <div className="flex items-center" style={{ gap: 8 }}>
                  <div style={{ width: 6, height: 24, borderRadius: 3, background: acc.color || theme.accent }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: theme.text }}>{acc.name}</div>
                    <div style={{ fontSize: 12, color: theme.gray2 }}>{acc.type === 'cash' ? 'Наличные' : acc.bank || ''} · {fmtMoney(acc.balance || 0)}</div>
                  </div>
                </div>
                <span style={{ color: theme.gray3 }}>▾</span>
              </div>
            ))}
          </div>
          {errors.from && <span style={{ fontSize: 12, color: theme.red, display: 'block', marginTop: 4 }}>{errors.from}</span>}
        </Card>

        {/* Swap button — proto S13 */}
        <div className="flex justify-center" style={{ margin: '-4px 0' }}>
          <div onClick={() => { const tmp = fromId; setFromId(toId); setToId(tmp); }}
            className="flex items-center justify-center cursor-pointer"
            style={{ width: 36, height: 36, borderRadius: 18, background: theme.accent + '10' }}>
            <span style={{ fontSize: 16, color: theme.accent, fontWeight: 700 }}>↕</span>
          </div>
        </div>

        {/* To account */}
        <Card theme={theme}>
          <label style={{ fontSize: 12, fontWeight: 500, color: theme.gray2, marginBottom: 4, display: 'block' }}>Куда</label>
          <div className="space-y-2 mt-2">
            {accounts.filter(a => a.id !== fromId).map(acc => (
              <div
                key={acc.id}
                className="flex items-center justify-between cursor-pointer"
                style={{
                  padding: '12px 14px', borderRadius: 12,
                  background: toId === acc.id ? theme.accent + '15' : theme.gray6,
                  border: toId === acc.id ? `1.5px solid ${theme.accent}` : '1.5px solid transparent',
                }}
                onClick={() => setToId(acc.id)}
              >
                <div className="flex items-center" style={{ gap: 8 }}>
                  <div style={{ width: 6, height: 24, borderRadius: 3, background: acc.color || theme.green || '#34C759' }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: theme.text }}>{acc.name}</div>
                    <div style={{ fontSize: 12, color: theme.gray2 }}>{acc.type === 'cash' ? 'Наличные' : acc.bank || ''} · {fmtMoney(acc.balance || 0)}</div>
                  </div>
                </div>
                <span style={{ color: theme.gray3 }}>▾</span>
              </div>
            ))}
          </div>
          {errors.to && <span style={{ fontSize: 12, color: theme.red, display: 'block', marginTop: 4 }}>{errors.to}</span>}
        </Card>

        {/* Description */}
        <FormInput label="Описание" value={description} onChange={setDescription}
          placeholder={fromAcc && toAcc ? `${fromAcc.name} → ${toAcc.name}` : 'Необязательно'} theme={theme} />

        {/* After transfer preview — proto S13 */}
        {fromAcc && toAcc && parseFloat(amount) > 0 && (
          <div className="flex" style={{ padding: '10px 0', borderTop: `0.5px solid ${theme.gray5}`, borderBottom: `0.5px solid ${theme.gray5}` }}>
            <div className="flex-1 text-center">
              <div style={{ fontSize: 11, color: theme.gray2 }}>{fromAcc.name} после</div>
              <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 600, color: theme.text }}>
                {fmtMoney((fromAcc.balance || 0) - parseFloat(amount))}
              </div>
              <div className="tabular-nums" style={{ fontSize: 11, color: theme.red }}>−{fmtMoney(parseFloat(amount))}</div>
            </div>
            <div style={{ width: 1, background: theme.gray5 }} />
            <div className="flex-1 text-center">
              <div style={{ fontSize: 11, color: theme.gray2 }}>{toAcc.name} после</div>
              <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 600, color: theme.text }}>
                {fmtMoney((toAcc.balance || 0) + parseFloat(amount))}
              </div>
              <div className="tabular-nums" style={{ fontSize: 11, color: theme.green || '#34C759' }}>+{fmtMoney(parseFloat(amount))}</div>
            </div>
          </div>
        )}

        {/* Submit error */}
        {errors.submit && (
          <div className="text-xs text-center" style={{ color: theme.red }}>{errors.submit}</div>
        )}

        {/* Submit button */}
        <FormButton label={loading ? 'Переводим...' : 'Перевести'} onClick={handleSubmit}
          disabled={loading} loading={loading} theme={theme} />
      </div>
    </ScreenWrapper>
  );
}
