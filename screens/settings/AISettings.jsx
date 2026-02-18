import { useState, useEffect } from 'react';
import { getSetting, setSetting } from '../../db/helpers';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import FormInput from '../../components/FormInput';
import Ic from '../../components/Icon';
import { AVAILABLE_MODELS, MODEL_REGISTRY, TASK_TYPE_LABELS } from '../../utils/constants';

export default function AISettings({ theme, onBack }) {
  const [apiKey, setApiKey] = useState('');
  const [maskedKey, setMaskedKey] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [briefingMode, setBriefingMode] = useState('smart');
  const [stats, setStats] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [limits, setLimits] = useState({ daily_calls: 60, daily_cost: 1.00, monthly_cost: 15.00 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const key = await getSetting('openrouter_key');
      if (key) {
        setApiKey(key);
        setMaskedKey('••••••••' + key.slice(-4));
      }
      const mode = await getSetting('briefing_mode');
      if (mode) setBriefingMode(mode);

      // Overrides
      const ov = await getSetting('ai_model_overrides');
      if (ov) setOverrides(ov);

      // Limits
      const dc = await getSetting('ai_daily_calls_limit');
      const dco = await getSetting('ai_daily_cost_limit');
      const mc = await getSetting('ai_monthly_limit');
      setLimits({
        daily_calls: dc || 60,
        daily_cost: dco || 1.00,
        monthly_cost: mc || 15.00,
      });

      // Stats
      try {
        const { getStats } = await import('../../ai/cost.js');
        const s = await getStats();
        if (s) setStats(s);
      } catch {}
    })();
  }, []);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const handleSaveKey = async () => {
    await setSetting('openrouter_key', apiKey);
    setMaskedKey('••••••••' + apiKey.slice(-4));
    setEditingKey(false);
    flash();
  };

  const handleBriefingChange = async (mode) => {
    setBriefingMode(mode);
    await setSetting('briefing_mode', mode);
  };

  const handleModelChange = async (taskKey, slug) => {
    const next = { ...overrides };
    if (slug === MODEL_REGISTRY[taskKey]) {
      delete next[taskKey];
    } else {
      next[taskKey] = slug;
    }
    setOverrides(next);
    await setSetting('ai_model_overrides', next);
    flash();
  };

  const handleLimitChange = async (key, value) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    const next = { ...limits, [key]: num };
    setLimits(next);
    if (key === 'daily_calls') await setSetting('ai_daily_calls_limit', num);
    if (key === 'daily_cost') await setSetting('ai_daily_cost_limit', num);
    if (key === 'monthly_cost') await setSetting('ai_monthly_limit', num);
    flash();
  };

  const monthlyLimit = limits.monthly_cost;
  const costMonth = stats?.cost_month || 0;
  const pct = monthlyLimit > 0 ? Math.min(100, (costMonth / monthlyLimit) * 100) : 0;

  const TASK_ICONS = {
    parsing: 'bot', analysis: 'chart', reports: 'note', briefing: 'bell',
    ocr: 'camera', food_vision: 'food', food_disambig: 'leaf', video_analysis: 'gym',
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="AI-ассистент" onBack={onBack} theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24">

        {/* Утренний брифинг */}
        <SectionLabel theme={theme}>УТРЕННИЙ БРИФИНГ</SectionLabel>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          <div className="flex items-center" style={{ gap: 10, padding: '12px 14px', borderBottom: `0.5px solid ${theme.gray5}` }}>
            <Ic name="bot" color={theme.purple || '#AF52DE'} size={32} r={9} />
            <span className="flex-1" style={{ fontSize: 15, color: theme.text }}>Утренний брифинг</span>
            <Toggle on={briefingMode !== 'off'} theme={theme}
              onToggle={() => handleBriefingChange(briefingMode === 'off' ? 'smart' : 'off')} />
          </div>
          <div className="flex items-center" style={{ gap: 10, padding: '12px 14px', borderBottom: `0.5px solid ${theme.gray5}` }}>
            <div className="flex-1">
              <div style={{ fontSize: 15, color: theme.text }}>Режим</div>
              <div style={{ fontSize: 12, color: theme.gray2 }}>Только важное</div>
            </div>
            <select value={briefingMode === 'off' ? 'smart' : briefingMode}
              onChange={e => handleBriefingChange(e.target.value)}
              style={{ fontSize: 14, color: theme.gray1, background: 'transparent', border: 'none', textAlign: 'right' }}>
              <option value="smart">Smart</option>
              <option value="always">Всегда</option>
            </select>
          </div>
        </Card>

        {/* Модели по задачам */}
        <SectionLabel theme={theme}>МОДЕЛИ ПО ЗАДАЧАМ</SectionLabel>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          {Object.keys(TASK_TYPE_LABELS).map((taskKey, i, arr) => {
            const current = overrides[taskKey] || MODEL_REGISTRY[taskKey];
            const isOverridden = !!overrides[taskKey];
            return (
              <div key={taskKey} className="flex items-center"
                style={{ gap: 10, padding: '10px 14px', borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                <Ic name={TASK_ICONS[taskKey] || 'bot'} color={isOverridden ? theme.accent : theme.gray2} size={28} r={8} />
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{TASK_TYPE_LABELS[taskKey]}</div>
                  {isOverridden && <div style={{ fontSize: 10, color: theme.accent }}>Переопределено</div>}
                </div>
                <select value={current} onChange={e => handleModelChange(taskKey, e.target.value)}
                  style={{ fontSize: 12, color: theme.gray1, background: theme.bg, border: `1px solid ${theme.gray4}`, borderRadius: 8, padding: '4px 6px', maxWidth: 130 }}>
                  {AVAILABLE_MODELS.map(m => (
                    <option key={m.slug} value={m.slug}>{m.short}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </Card>

        {/* Лимиты */}
        <SectionLabel theme={theme}>ЛИМИТЫ</SectionLabel>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          {[
            { key: 'daily_calls', label: 'Вызовов/день', suffix: '', step: 10 },
            { key: 'daily_cost', label: 'Лимит/день', suffix: '$', step: 0.25 },
            { key: 'monthly_cost', label: 'Лимит/месяц', suffix: '$', step: 1 },
          ].map((row, i, arr) => (
            <div key={row.key} className="flex items-center justify-between"
              style={{ padding: '12px 14px', borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
              <span style={{ fontSize: 15, color: theme.text }}>{row.label}</span>
              <div className="flex items-center gap-1">
                {row.suffix && <span style={{ fontSize: 14, color: theme.gray2 }}>{row.suffix}</span>}
                <input type="number" value={limits[row.key]} step={row.step} min={0}
                  onChange={e => handleLimitChange(row.key, e.target.value)}
                  style={{ width: 70, fontSize: 14, color: theme.text, background: theme.bg, border: `1px solid ${theme.gray4}`, borderRadius: 8, padding: '4px 8px', textAlign: 'right' }} />
              </div>
            </div>
          ))}
        </Card>

        {/* Использование */}
        <SectionLabel theme={theme}>ИСПОЛЬЗОВАНИЕ</SectionLabel>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ padding: 14 }}>
            <div className="flex justify-between items-baseline" style={{ marginBottom: 6 }}>
              <span className="tabular-nums" style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>
                ${costMonth.toFixed(2)}
              </span>
              <span style={{ fontSize: 14, color: theme.gray2 }}>из ${monthlyLimit.toFixed(2)}</span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 6, background: theme.gray5 }}>
              <div className="h-full rounded-full transition-all" style={{
                width: `${pct}%`,
                background: pct > 80 ? theme.red : theme.purple || '#AF52DE',
              }} />
            </div>
            <div style={{ fontSize: 12, color: theme.gray2, marginTop: 4 }}>
              AI за {new Date().toLocaleDateString('ru-RU', { month: 'long' })}
            </div>
          </div>
          <div style={{ borderTop: `0.5px solid ${theme.gray5}` }}>
            {[
              { label: 'Вызовов сегодня', value: `${stats?.calls_today || 0} / ${limits.daily_calls}` },
              { label: 'Расходы сегодня', value: `$${(stats?.cost_today || 0).toFixed(3)}` },
              { label: 'Вызовов за месяц', value: String(stats?.calls_month || 0) },
              { label: 'Всего за всё время', value: `$${(stats?.cost_total || 0).toFixed(2)}` },
            ].map((row, i, arr) => (
              <div key={row.label} className="flex justify-between"
                style={{ padding: '12px 14px', borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                <span style={{ fontSize: 15, color: theme.text }}>{row.label}</span>
                <span className="tabular-nums" style={{ fontSize: 14, color: theme.gray1 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* API ключ */}
        <SectionLabel theme={theme}>API КЛЮЧ</SectionLabel>
        <Card theme={theme} style={{ marginBottom: 12 }}>
          {editingKey ? (
            <div className="space-y-2">
              <FormInput value={apiKey} onChange={setApiKey} placeholder="sk-or-..." theme={theme} />
              <div className="flex gap-2">
                <button onClick={handleSaveKey}
                  className="flex-1 py-2.5 rounded-xl font-semibold"
                  style={{ fontSize: 14, background: theme.green, color: '#fff' }}>
                  Сохранить
                </button>
                <button onClick={() => setEditingKey(false)}
                  className="py-2.5 px-4 rounded-xl font-medium"
                  style={{ fontSize: 14, background: theme.gray5, color: theme.text }}>
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: theme.text }}>OpenRouter</div>
                <div className="font-mono mt-0.5" style={{ fontSize: 12, color: theme.gray2 }}>
                  {maskedKey || 'Не установлен'}
                </div>
              </div>
              <button onClick={() => setEditingKey(true)}
                className="px-3 py-1.5 rounded-lg font-medium"
                style={{ fontSize: 12, background: theme.accent, color: '#fff' }}>
                {maskedKey ? 'Изменить' : 'Добавить'}
              </button>
            </div>
          )}
        </Card>

        {saved && <div className="text-center" style={{ fontSize: 14, color: theme.green, padding: '8px 0' }}>✓ Сохранено</div>}
      </div>
    </div>
  );
}

function SectionLabel({ theme, children }) {
  return (
    <div className="mt-3 mb-1" style={{ padding: '0 0 4px' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>{children}</span>
    </div>
  );
}

function Toggle({ on, onToggle, theme }) {
  return (
    <div onClick={onToggle} className="relative cursor-pointer"
      style={{ width: 44, height: 26, borderRadius: 13, background: on ? theme.green : theme.gray4, padding: 2 }}>
      <div className="rounded-full bg-white"
        style={{ width: 22, height: 22, borderRadius: 11, boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transform: on ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
    </div>
  );
}
