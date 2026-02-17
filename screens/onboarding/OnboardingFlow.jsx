import { useState } from 'react';
import { setSetting, setProfile } from '../../db/helpers';
import { runSeeds } from '../../db/seed';
import { loadDemoData } from '../../db/demoSeed';
import Card from '../../components/Card';
import { isPinBanned, pinStrength, createPIN } from '../../security/pin';
import { setupEnvelopeEncryption } from '../../security/crypto';
import { getSymbolForCode, getCurrencyCode } from '../../utils/currency';

import { CURRENCIES } from '../../utils/constants';
import FormInput from '../../components/FormInput';

export default function OnboardingFlow({ theme, onComplete }) {
  const [step, setStep] = useState(1);

  /* L1: Module selection */
  const MODULES = [
    { id: 'finance', emoji: '💰', label: 'Финансы', desc: 'Расходы, бюджеты, счета' },
    { id: 'tasks', emoji: '📋', label: 'Задачи', desc: 'To-do, проекты, дедлайны' },
    { id: 'nutrition', emoji: '🍎', label: 'Питание', desc: 'КБЖУ, вода, рецепты' },
    { id: 'sport', emoji: '🏋️', label: 'Спорт', desc: 'Тренировки, вес, обмеры' },
    { id: 'invest', emoji: '📈', label: 'Инвестиции', desc: 'Портфель, дивиденды' },
    { id: 'routines', emoji: '🔄', label: 'Рутины', desc: 'Привычки, стрики' },
    { id: 'subscriptions', emoji: '💳', label: 'Подписки', desc: 'Трекинг платежей' },
    { id: 'sleep', emoji: '😴', label: 'Сон', desc: 'Качество, тренды' },
    { id: 'notes', emoji: '📝', label: 'Заметки', desc: 'Дневник, настроение' },
    { id: 'documents', emoji: '🪪', label: 'Документы', desc: 'Паспорта, страховки' },
  ];
  const [enabledModules, setEnabledModules] = useState(
    () => new Set(MODULES.map(m => m.id))
  );
  const toggleModule = (id) => setEnabledModules(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Step 2: Profile
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(getCurrencyCode());
  const [budget, setBudget] = useState('');

  // Step 3: Goals
  const [calories, setCalories] = useState('2200');
  const [protein, setProtein] = useState('120');
  const [water, setWater] = useState('2000');
  const [weightGoal, setWeightGoal] = useState('');
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState('3');

  // Step 4: Security
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [saving, setSaving] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState(null);

  const handleFinish = async () => {
    setPinError('');
    if (pin.length < 4) { setPinError('Минимум 4 цифры'); return; }
    if (pin !== confirmPin) { setPinError('PIN-коды не совпадают'); return; }
    if (isPinBanned(pin)) { setPinError('Слишком простой PIN'); return; }

    setSaving(true);
    try {
      // 1. Seed categories + default settings
      await runSeeds();

      // L1: Save enabled modules
      await setSetting('enabled_modules', JSON.stringify([...enabledModules]));

      // 2. Save profile
      await setProfile({
        name: name || null,
        birth_year: null,
        height_cm: null,
        workouts_per_week: workoutsPerWeek ? parseInt(workoutsPerWeek) : 3,
      });

      // 3. Save settings
      await setSetting('default_currency', currency);
      if (budget) await setSetting('monthly_budget', parseFloat(budget));
      if (calories) await setSetting('daily_calorie_goal', parseInt(calories));
      if (protein) await setSetting('daily_protein_goal', parseInt(protein));
      if (water) await setSetting('daily_water_goal', parseInt(water));
      if (weightGoal) await setSetting('weight_goal', parseFloat(weightGoal));

      // 4. Create PIN + encryption
      try {
        const pinWrappingKey = await createPIN(pin);

        // Generate recovery key
        const recoveryRaw = crypto.getRandomValues(new Uint8Array(16));
        const recoveryStr = Array.from(recoveryRaw, b => b.toString(16).padStart(2, '0'))
          .join('').match(/.{4}/g).join('-').toUpperCase();

        const recoveryKeyMaterial = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(recoveryStr.replace(/-/g, '').padEnd(32, '0')),
          'PBKDF2', false, ['deriveKey']
        );
        const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
        const recoveryWrappingKey = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: recoverySalt, iterations: 600000, hash: 'SHA-256' },
          recoveryKeyMaterial,
          { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
        );
        await setSetting('recovery_salt', btoa(String.fromCharCode(...recoverySalt)));

        await setupEnvelopeEncryption(pinWrappingKey, recoveryWrappingKey);
        setRecoveryKey(recoveryStr);
      } catch (e) {
        console.warn('Crypto setup failed, using basic PIN:', e);
        // PIN hash is already saved by createPIN
      }

      // 5. Mark onboarding complete
      await setSetting('has_completed_onboarding', true);

      // 6. Load demo data so dashboard isn't empty
      try { await loadDemoData(); } catch (e) { console.warn('Demo seed failed:', e); }

      if (!recoveryKey) {
        // No recovery key to show, complete immediately
        onComplete();
      }
      // Otherwise step 5 (recovery key) will show
    } catch (err) {
      setPinError('Ошибка: ' + err.message);
    }
    setSaving(false);
  };

  const fieldStyle = { background: theme.card, color: theme.text };

  // Step 5: Recovery key display (shown after successful setup)
  if (recoveryKey) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center px-6" style={{ background: theme.bg }}>
        <div className="text-5xl mb-4">🔑</div>
        <h1 className="text-2xl font-bold mb-2 text-center" style={{ color: theme.text }}>
          Recovery Key
        </h1>
        <p className="text-sm text-center mb-6" style={{ color: theme.gray2 }}>
          Запиши этот ключ! Он нужен для восстановления данных, если забудешь PIN.
        </p>
        <Card theme={theme} style={{ width: '100%' }}>
          <div className="text-center font-mono text-lg font-bold tracking-wider py-2"
            style={{ color: theme.accent, wordBreak: 'break-all' }}>
            {recoveryKey}
          </div>
        </Card>
        <p className="text-xs text-center mt-4 mb-6" style={{ color: theme.orange }}>
          ⚠️ Этот ключ показывается ОДИН раз. Сохрани в надёжном месте.
        </p>
        <button
          onClick={onComplete}
          className="w-full py-3.5 rounded-xl font-semibold text-base"
          style={{ background: theme.green, color: '#fff' }}
        >
          ✓ Я сохранил ключ
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      {/* Header */}
      {step > 1 && (
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={() => setStep(step - 1)} className="text-sm font-medium" style={{ color: theme.accent }}>
            ← Назад
          </button>
          <span className="text-xs font-medium" style={{ color: theme.gray2 }}>
            Шаг {step} из 5
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 pb-12">
        {/* STEP 1: Welcome */}
        {step === 1 && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
            <div className="text-6xl mb-6">👋</div>
            <h1 className="text-3xl font-bold mb-3" style={{ color: theme.text }}>Привет!</h1>
            <p className="text-base leading-relaxed mb-2" style={{ color: theme.gray1 }}>
              <strong>LifeOS</strong> — твой персональный ассистент.
            </p>
            <p className="text-base leading-relaxed mb-1" style={{ color: theme.gray1 }}>
              Финансы, задачи, еда, спорт — всё в одном месте.
            </p>
            <p className="text-sm mt-4 mb-8" style={{ color: theme.gray2 }}>
              Данные хранятся только на устройстве.<br />
              Без облака. Без регистрации.
            </p>
            <button
              onClick={() => setStep(2)}
              className="w-full py-3.5 rounded-xl font-semibold text-base"
              style={{ background: theme.accent, color: '#fff' }}
            >
              Начать настройку →
            </button>
          </div>
        )}

        {/* L1 STEP 2: Module Selection */}
        {step === 2 && (
          <div className="space-y-4 pt-4">
            <h2 className="text-xl font-bold text-center mb-1" style={{ color: theme.text }}>
              Какие модули нужны?
            </h2>
            <p className="text-sm text-center mb-4" style={{ color: theme.gray2 }}>
              Выключенные модули не будут показываться. Можно изменить позже.
            </p>
            <div className="space-y-2">
              {MODULES.map(m => (
                <button key={m.id} onClick={() => toggleModule(m.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left"
                  style={{ background: enabledModules.has(m.id) ? theme.accent + '12' : theme.card,
                    border: enabledModules.has(m.id) ? `1.5px solid ${theme.accent}40` : `1.5px solid transparent` }}>
                  <span className="text-2xl">{m.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: theme.text }}>{m.label}</div>
                    <div className="text-xs" style={{ color: theme.gray2 }}>{m.desc}</div>
                  </div>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: enabledModules.has(m.id) ? theme.accent : 'transparent',
                      border: enabledModules.has(m.id) ? 'none' : `2px solid ${theme.gray3}`,
                    }}>
                    {enabledModules.has(m.id) && <span className="text-white text-xs">✓</span>}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEnabledModules(new Set(MODULES.map(m => m.id)))}
                className="flex-1 py-2 rounded-xl text-xs font-medium"
                style={{ background: theme.gray6, color: theme.accent }}>Все</button>
              <button onClick={() => setEnabledModules(new Set())}
                className="flex-1 py-2 rounded-xl text-xs font-medium"
                style={{ background: theme.gray6, color: theme.gray2 }}>Очистить</button>
            </div>
            <button
              onClick={() => setStep(3)}
              disabled={enabledModules.size === 0}
              className="w-full py-3.5 rounded-xl font-semibold text-base mt-2"
              style={{ background: enabledModules.size > 0 ? theme.accent : theme.gray3, color: '#fff' }}>
              Далее →
            </button>
          </div>
        )}

        {/* STEP 3: Profile */}
        {step === 3 && (
          <div className="space-y-5 pt-4">
            <h2 className="text-xl font-bold text-center mb-2" style={{ color: theme.text }}>
              Как тебя зовут?
            </h2>
            <FormInput value={name} onChange={setName} placeholder="Имя" autoFocus theme={theme} />

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: theme.gray1 }}>
                Валюта по умолчанию
              </label>
              <div className="flex gap-2">
                {CURRENCIES.map(c => (
                  <button key={c.code} onClick={() => setCurrency(c.code)}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-center"
                    style={{ background: currency === c.code ? theme.accent : theme.gray5, color: currency === c.code ? '#fff' : theme.text }}>
                    {c.flag} {c.code}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: theme.gray1 }}>
                Месячный бюджет
              </label>
              <div className="flex items-center rounded-xl px-4 py-3.5" style={fieldStyle}>
                <input
                  type="number" inputMode="numeric" value={budget}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === '' || (Number(v) >= 0 && Number(v) <= 99999999)) setBudget(v);
                  }}
                  onFocus={e => e.target.select()}
                  placeholder="80000"
                  className="flex-1 text-lg font-semibold bg-transparent outline-none tabular-nums"
                  style={{ color: theme.text }}
                />
                <span className="text-sm ml-2" style={{ color: theme.gray2 }}>
                  {getSymbolForCode(currency)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setStep(4)}
              className="w-full py-3.5 rounded-xl font-semibold text-base mt-4"
              style={{ background: theme.accent, color: '#fff' }}
            >
              Далее →
            </button>
          </div>
        )}

        {/* STEP 4: Goals */}
        {step === 4 && (
          <div className="space-y-4 pt-4">
            <h2 className="text-xl font-bold text-center mb-2" style={{ color: theme.text }}>
              Твои цели
            </h2>

            {[
              { label: 'Калории/день', value: calories, set: setCalories, unit: 'ккал', placeholder: '2200', max: 10000 },
              { label: 'Белок/день', value: protein, set: setProtein, unit: 'г', placeholder: '120', max: 500 },
              { label: 'Вода/день', value: water, set: setWater, unit: 'мл', placeholder: '2000', max: 10000 },
              { label: 'Цель по весу', value: weightGoal, set: setWeightGoal, unit: 'кг', placeholder: '75', max: 300 },
              { label: 'Тренировок/нед', value: workoutsPerWeek, set: setWorkoutsPerWeek, unit: '', placeholder: '3', max: 14 },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3">
                <span className="text-sm min-w-0 flex-1 truncate" style={{ color: theme.text }}>{f.label}</span>
                <div className="flex items-center rounded-xl px-3 py-2.5 shrink-0" style={{ ...fieldStyle, width: 120 }}>
                  <input
                    type="number" inputMode="numeric" value={f.value}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === '' || (Number(v) >= 0 && Number(v) <= f.max)) f.set(v);
                    }}
                    onFocus={e => e.target.select()}
                    placeholder={f.placeholder}
                    max={f.max}
                    className="flex-1 text-base font-semibold bg-transparent outline-none text-right tabular-nums w-full"
                    style={{ color: theme.text, maxWidth: 70 }}
                  />
                  {f.unit && <span className="text-xs ml-1.5 shrink-0" style={{ color: theme.gray2 }}>{f.unit}</span>}
                </div>
              </div>
            ))}

            <p className="text-xs text-center pt-2" style={{ color: theme.gray2 }}>
              Можно изменить позже в настройках
            </p>

            <button
              onClick={() => setStep(5)}
              className="w-full py-3.5 rounded-xl font-semibold text-base mt-2"
              style={{ background: theme.accent, color: '#fff' }}
            >
              Далее →
            </button>
          </div>
        )}

        {/* STEP 5: Security */}
        {step === 5 && (
          <div className="space-y-4 pt-4">
            <div className="text-center mb-2">
              <div className="text-4xl mb-2">🔒</div>
              <h2 className="text-xl font-bold" style={{ color: theme.text }}>Защита данных</h2>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: theme.gray1 }}>
                Придумай PIN-код (4–8 цифр)
              </label>
              <input
                type="password" inputMode="numeric" maxLength={8} value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                placeholder="••••" autoFocus
                className="w-full rounded-xl px-4 py-3.5 text-2xl text-center tracking-[0.5em] outline-none"
                style={fieldStyle}
              />
              {pin.length >= 4 && (() => {
                const s = pinStrength(pin);
                const widthMap = { weak: '33%', medium: '66%', strong: '100%' };
                return (
                  <div className="mt-2">
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: theme.gray5 }}>
                      <div style={{
                        height: '100%',
                        width: widthMap[s.level],
                        background: s.color,
                        borderRadius: 999,
                        transition: 'width 0.3s, background 0.3s',
                      }} />
                    </div>
                    <p className="text-xs text-right mt-1" style={{ color: s.color }}>{s.label}</p>
                  </div>
                );
              })()}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: theme.gray1 }}>
                Подтверди
              </label>
              <input
                type="password" inputMode="numeric" maxLength={8} value={confirmPin}
                onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                placeholder="••••"
                className="w-full rounded-xl px-4 py-3.5 text-2xl text-center tracking-[0.5em] outline-none"
                style={fieldStyle}
              />
            </div>

            {pinError && (
              <div className="text-sm text-center" style={{ color: theme.red }}>{pinError}</div>
            )}

            {/* PWA warning */}
            <Card theme={theme} style={{ background: theme.orange + '15' }}>
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div>
                  <div className="text-sm font-semibold" style={{ color: theme.text }}>
                    Добавь на домашний экран!
                  </div>
                  <div className="text-xs mt-1" style={{ color: theme.gray1 }}>
                    Без этого Safari может удалить данные через 7 дней неактивности.
                    Нажми «Поделиться» → «На экран Домой».
                  </div>
                </div>
              </div>
            </Card>

            <button
              onClick={handleFinish} disabled={saving}
              className="w-full py-3.5 rounded-xl font-semibold text-base"
              style={{ background: saving ? theme.gray4 : theme.green, color: '#fff' }}
            >
              {saving ? '⏳ Настройка...' : 'Завершить ✓'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
