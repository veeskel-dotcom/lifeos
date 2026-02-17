import { useState, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import { getSetting, setSetting } from '../../db/helpers';

function pinStrength(pin, theme) {
  if (!pin) return null;
  // Все одинаковые цифры
  if (/^(.)\1+$/.test(pin)) return { level: 0, label: 'Очень слабый', color: theme.red };
  // Последовательности
  if ('01234567890'.includes(pin) || '09876543210'.includes(pin))
    return { level: 0, label: 'Слабый', color: theme.red };
  if (pin.length <= 4) return { level: 1, label: 'Средний', color: theme.yellow };
  if (pin.length === 5) return { level: 2, label: 'Хороший', color: theme.orange };
  return { level: 3, label: 'Надёжный', color: theme.green };
}

export default function SecuritySettings({ theme, onBack }) {
  const [currentPin, setCurrentPin] = useState('');
  const [hasPin, setHasPin] = useState(false);
  const [step, setStep] = useState('idle'); // 'idle' | 'enter_current' | 'new' | 'confirm'
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [biometrics, setBiometrics] = useState(false);
  const [autoLockMin, setAutoLockMin] = useState(5);

  useEffect(() => {
    (async () => {
      const pin = await getSetting('app_pin');
      setHasPin(!!pin);
      const bio = await getSetting('biometrics_enabled');
      setBiometrics(bio === true || bio === 'true');
      const lock = await getSetting('auto_lock_min');
      if (lock) setAutoLockMin(parseInt(lock) || 5);
    })();
  }, []);

  const handleSetPin = () => {
    if (hasPin) {
      setStep('enter_current');
    } else {
      setStep('new');
    }
    setError('');
    setNewPin('');
    setConfirmPin('');
    setCurrentPin('');
  };

  const handleVerifyCurrent = async () => {
    const saved = await getSetting('app_pin');
    if (currentPin === saved) {
      setStep('new');
      setError('');
    } else {
      setError('Неверный PIN');
    }
  };

  const handleConfirm = async () => {
    if (newPin.length < 4) {
      setError('Минимум 4 цифры');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PIN не совпадает');
      return;
    }
    await setSetting('app_pin', newPin);
    setHasPin(true);
    setStep('idle');
    setError('');
  };

  const handleRemovePin = async () => {
    if (hasPin) {
      const saved = await getSetting('app_pin');
      if (currentPin !== saved) {
        setStep('enter_current');
        return;
      }
    }
    await setSetting('app_pin', null);
    setHasPin(false);
    setStep('idle');
  };

  const handleBiometrics = async () => {
    const next = !biometrics;
    setBiometrics(next);
    await setSetting('biometrics_enabled', next);
  };

  const handleAutoLock = async (min) => {
    setAutoLockMin(min);
    await setSetting('auto_lock_min', min);
  };

  const strength = pinStrength(newPin, theme);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Безопасность" onBack={onBack} left="Настройки" theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">

        {/* PIN */}
        <Card theme={theme}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: theme.gray1 }}>
            🔒 PIN-код
          </div>

          {step === 'idle' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: theme.text }}>
                  {hasPin ? 'PIN установлен' : 'PIN не установлен'}
                </span>
                <button
                  onClick={handleSetPin}
                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: theme.accent, color: '#fff' }}
                >
                  {hasPin ? 'Изменить' : 'Установить'}
                </button>
              </div>
              {hasPin && (
                <button
                  onClick={() => { setStep('enter_current'); setCurrentPin(''); }}
                  className="w-full text-center py-2 text-sm mt-2"
                  style={{ color: theme.red }}
                >
                  Удалить PIN
                </button>
              )}
            </>
          )}

          {step === 'enter_current' && (
            <div className="space-y-3">
              <div className="text-sm" style={{ color: theme.text }}>Введите текущий PIN</div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={currentPin}
                onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-xl px-4 py-3 text-lg text-center tracking-[0.5em] outline-none"
                style={{ background: theme.gray6, color: theme.text }}
                autoFocus
              />
              {error && <div className="text-xs text-center" style={{ color: theme.red }}>{error}</div>}
              <button
                onClick={handleVerifyCurrent}
                className="w-full py-3 rounded-xl text-white font-semibold"
                style={{ background: theme.accent }}
              >
                Далее
              </button>
            </div>
          )}

          {step === 'new' && (
            <div className="space-y-3">
              <div className="text-sm" style={{ color: theme.text }}>Новый PIN (4–6 цифр)</div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-xl px-4 py-3 text-lg text-center tracking-[0.5em] outline-none"
                style={{ background: theme.gray6, color: theme.text }}
                autoFocus
              />
              {/* P5: PIN strength indicator */}
              {strength && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className="flex-1 h-1 rounded-full"
                        style={{ background: i <= strength.level ? strength.color : theme.gray5 }}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-center" style={{ color: strength.color }}>
                    {strength.label}
                  </div>
                </div>
              )}
              {error && <div className="text-xs text-center" style={{ color: theme.red }}>{error}</div>}
              <button
                onClick={() => {
                  if (newPin.length < 4) { setError('Минимум 4 цифры'); return; }
                  setStep('confirm');
                  setError('');
                }}
                className="w-full py-3 rounded-xl text-white font-semibold"
                style={{ background: newPin.length >= 4 ? theme.accent : theme.gray4, color: '#fff' }}
                disabled={newPin.length < 4}
              >
                Далее
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-3">
              <div className="text-sm" style={{ color: theme.text }}>Повторите PIN</div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-xl px-4 py-3 text-lg text-center tracking-[0.5em] outline-none"
                style={{ background: theme.gray6, color: theme.text }}
                autoFocus
              />
              {error && <div className="text-xs text-center" style={{ color: theme.red }}>{error}</div>}
              <button
                onClick={handleConfirm}
                className="w-full py-3 rounded-xl text-white font-semibold"
                style={{ background: theme.accent }}
              >
                Сохранить
              </button>
            </div>
          )}
        </Card>

        {/* Биометрия */}
        {hasPin && (
          <Card theme={theme}>
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontSize: 15, fontWeight: 400, color: theme.text }}>Face ID / Touch ID</div>
                <div className="text-xs mt-0.5" style={{ color: theme.gray2 }}>Разблокировка биометрией</div>
              </div>
              <div
                onClick={handleBiometrics}
                className="relative cursor-pointer"
                style={{ width: 44, height: 26, borderRadius: 13, background: biometrics ? theme.green : theme.gray4, padding: 2 }}
              >
                <div className="rounded-full bg-white"
                  style={{ width: 22, height: 22, borderRadius: 11, boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transform: biometrics ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
              </div>
            </div>
          </Card>
        )}

        {/* Автоблокировка */}
        {hasPin && (
          <Card theme={theme}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: theme.gray1 }}>
              ⏱ Автоблокировка
            </div>
            <div className="flex gap-2 flex-wrap">
              {[1, 5, 15, 30].map(min => (
                <button
                  key={min}
                  onClick={() => handleAutoLock(min)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium"
                  style={{
                    background: autoLockMin === min ? theme.accent : theme.gray5,
                    color: autoLockMin === min ? '#fff' : theme.text,
                  }}
                >
                  {min} мин
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Recovery Key */}
        {hasPin && (
          <Card theme={theme}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: theme.gray1 }}>
              🔑 Восстановление
            </div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex items-center justify-center"
                style={{ width: 28, height: 28, borderRadius: 7, background: theme.orange + '12' }}>
                <span style={{ fontSize: 14 }}>🛡️</span>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: theme.text }}>Recovery Key</div>
                <div className="text-xs" style={{ color: theme.gray2 }}>Для восстановления доступа</div>
              </div>
            </div>
            <div className="rounded-lg px-3.5 py-2.5 font-mono text-sm tracking-widest"
              style={{ background: theme.gray6, color: theme.gray2 }}>
              ●●●●-●●●●-●●●●-●●●●
            </div>
            <div className="flex gap-2 mt-3">
              <button className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: theme.accent + '12', color: theme.accent }}>
                Показать
              </button>
              <button className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: theme.orange + '12', color: theme.orange }}>
                Обновить
              </button>
            </div>
          </Card>
        )}

        {/* Encryption info */}
        <Card theme={theme}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: theme.gray1 }}>
            🔒 Шифрование
          </div>
          <div className="space-y-2">
            {[
              { label: 'Метод', value: 'AES-256' },
              { label: 'Ключ', value: 'PBKDF2' },
              { label: 'Данные', value: 'Только на устройстве' },
            ].map(r => (
              <div key={r.label} className="flex justify-between">
                <span style={{ fontSize: 15, color: theme.gray1 }}>{r.label}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{r.value}</span>
              </div>
            ))}
          </div>
          <div className="text-xs mt-2" style={{ color: theme.gray3 }}>
            Офлайн-first · без облака
          </div>
        </Card>
      </div>
    </div>
  );
}
