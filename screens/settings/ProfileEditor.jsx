import { useState, useEffect } from 'react';
import { getProfile, setProfile, getSetting, setSetting } from '../../db/helpers';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import IOSKeyboardSpacer from '../../components/IOSKeyboardSpacer';

import { getSymbolForCode } from '../../utils/currency';

import { CURRENCIES } from '../../utils/constants';
import FormInput from '../../components/FormInput';

export default function ProfileEditor({ theme, onBack }) {
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [height, setHeight] = useState('');
  const [weightGoal, setWeightGoal] = useState('');
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [currency, setCurrency] = useState('KZT');
  const [dailyCalories, setDailyCalories] = useState('');
  const [dailyProtein, setDailyProtein] = useState('');
  const [dailyWater, setDailyWater] = useState('');
  const [activityLevel, setActivityLevel] = useState('medium');
  const [language] = useState('Русский');
  const [timezone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await getProfile();
      if (p) {
        setName(p.name || '');
        setBirthYear(p.birth_year ? String(p.birth_year) : '');
        setHeight(p.height_cm ? String(p.height_cm) : '');
        setWorkoutsPerWeek(p.workouts_per_week ? String(p.workouts_per_week) : '');
      }
      const cur = await getSetting('default_currency');
      if (cur) setCurrency(cur);
      const budget = await getSetting('monthly_budget');
      if (budget) setMonthlyBudget(String(budget));
      const wg = await getSetting('weight_goal');
      if (wg) setWeightGoal(String(wg));
      const cal = await getSetting('daily_calorie_goal');
      if (cal) setDailyCalories(String(cal));
      const prot = await getSetting('daily_protein_goal');
      if (prot) setDailyProtein(String(prot));
      const water = await getSetting('daily_water_goal');
      if (water) setDailyWater(String(water));
    })();
  }, []);

  const handleSave = async () => {
    await setProfile({
      name,
      birth_year: birthYear ? parseInt(birthYear) : null,
      height_cm: height ? parseInt(height) : null,
      workouts_per_week: workoutsPerWeek ? parseInt(workoutsPerWeek) : null,
    });
    await setSetting('default_currency', currency);
    if (monthlyBudget) await setSetting('monthly_budget', parseFloat(monthlyBudget));
    if (weightGoal) await setSetting('weight_goal', parseFloat(weightGoal));
    if (dailyCalories) await setSetting('daily_calorie_goal', parseInt(dailyCalories));
    if (dailyProtein) await setSetting('daily_protein_goal', parseInt(dailyProtein));
    if (dailyWater) await setSetting('daily_water_goal', parseInt(dailyWater));

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const fieldStyle = { background: theme.card, color: theme.text };
  const labelCls = "text-xs font-semibold uppercase tracking-wide mb-1.5 block";

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Профиль" onBack={onBack} theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {/* Avatar */}
        <div className="text-center py-2">
          <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl"
            style={{ background: theme.accent + '15' }}>
            {name ? name.charAt(0).toUpperCase() : '👤'}
          </div>
          <div className="text-sm mt-2 font-medium" style={{ color: theme.accent }}>
            Изменить фото
          </div>
        </div>
        {/* ── ЛИЧНЫЕ ДАННЫЕ ── */}
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1, padding: '0 4px' }}>ЛИЧНЫЕ ДАННЫЕ</div>

        {/* Name */}
        <div>
          <label className={labelCls} style={{ color: theme.gray1 }}>Имя</label>
          <FormInput value={name} onChange={setName} placeholder="Алексей" theme={theme} />
        </div>

        {/* Birth year + Height */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelCls} style={{ color: theme.gray1 }}>Год рождения</label>
            <FormInput type="number" value={birthYear} onChange={setBirthYear} placeholder="1995" theme={theme} />
          </div>
          <div className="flex-1">
            <label className={labelCls} style={{ color: theme.gray1 }}>Рост, см</label>
            <FormInput type="number" value={height} onChange={setHeight} placeholder="175" theme={theme} />
          </div>
        </div>

        {/* Activity level — proto S6 */}
        <div>
          <label className={labelCls} style={{ color: theme.gray1 }}>Уровень активности</label>
          <div className="flex" style={{ gap: 6 }}>
            {[
              { v: 'low', l: 'Низкий' },
              { v: 'medium', l: 'Средний' },
              { v: 'high', l: 'Высокий' },
            ].map(o => (
              <button key={o.v} onClick={() => setActivityLevel(o.v)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-center"
                style={{ background: activityLevel === o.v ? theme.accent : theme.gray5, color: activityLevel === o.v ? '#fff' : theme.text }}>
                {o.l}
              </button>
            ))}
          </div>
        </div>

        {/* ── ЦЕЛИ ── */}
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1, padding: '4px 4px 0' }}>ЦЕЛИ</div>

        {/* Budget */}
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
          {[
            { icon: '💰', color: theme.green, label: 'Бюджет/мес', value: monthlyBudget, onChange: setMonthlyBudget, ph: '80000', suffix: getSymbolForCode(currency) },
            { icon: '⚖️', color: theme.purple || '#AF52DE', label: 'Цель по весу', value: weightGoal, onChange: setWeightGoal, ph: '75', suffix: 'кг' },
            { icon: '🔥', color: theme.orange, label: 'Калории/день', value: dailyCalories, onChange: setDailyCalories, ph: '2200', suffix: 'ккал' },
            { icon: '💧', color: theme.teal || '#30B0C7', label: 'Вода/день', value: dailyWater, onChange: setDailyWater, ph: '2000', suffix: 'мл' },
          ].map((g, i, arr) => (
            <div key={g.label} className="flex items-center" style={{ padding: '10px 14px', gap: 10, borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
              <div className="flex items-center justify-center shrink-0" style={{ width: 32, height: 32, borderRadius: 8, background: g.color + '15', fontSize: 16 }}>{g.icon}</div>
              <span className="flex-1" style={{ fontSize: 15, color: theme.text }}>{g.label}</span>
              <div className="flex items-center" style={{ gap: 4 }}>
                <input type="number" value={g.value} onChange={e => g.onChange(e.target.value)} placeholder={g.ph}
                  className="text-right" style={{ width: 70, fontSize: 15, fontWeight: 600, color: theme.text, background: 'transparent', border: 'none', outline: 'none' }} />
                <span style={{ fontSize: 13, color: theme.gray2 }}>{g.suffix}</span>
              </div>
            </div>
          ))}
        </Card>

        {/* ── РЕГИОНАЛЬНЫЕ ── */}
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1, padding: '4px 4px 0' }}>РЕГИОНАЛЬНЫЕ</div>

        {/* Currency */}
        <div>
          <label className={labelCls} style={{ color: theme.gray1 }}>Валюта</label>
          <div className="flex gap-2">
            {CURRENCIES.map(c => (
              <button key={c.code} onClick={() => setCurrency(c.code)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-center"
                style={{ background: currency === c.code ? theme.accent : theme.gray5, color: currency === c.code ? '#fff' : theme.text }}>
                {c.flag} {c.code}
              </button>
            ))}
          </div>
        </div>

        {/* Language + Timezone — proto S6 */}
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
          <div className="flex items-center justify-between" style={{ padding: '12px 14px', borderBottom: `0.5px solid ${theme.gray5}` }}>
            <span style={{ fontSize: 15, color: theme.text }}>Язык</span>
            <span style={{ fontSize: 15, color: theme.gray1 }}>{language}</span>
          </div>
          <div className="flex items-center justify-between" style={{ padding: '12px 14px' }}>
            <span style={{ fontSize: 15, color: theme.text }}>Часовой пояс</span>
            <span style={{ fontSize: 15, color: theme.gray1 }}>{timezone}</span>
          </div>
        </Card>

        {/* Save */}
        <button onClick={handleSave}
          className="w-full py-3.5 rounded-xl font-semibold text-base"
          style={{ background: saved ? theme.green : theme.accent, color: '#fff' }}>
          {saved ? '✓ Сохранено' : '💚 Сохранить'}
        </button>
      </div>
      <IOSKeyboardSpacer />
    </div>
  );
}
