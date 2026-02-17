import { useState, useEffect } from 'react';
import { getSetting, setSetting } from '../../db/helpers';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import FormInput from '../../components/FormInput';

const BRIEFING_MODES = [
  { id: 'always', label: 'Всегда' },
  { id: 'smart', label: 'Умный' },
  { id: 'off', label: 'Выключен' },
];

export default function AISettings({ theme, onBack }) {
  const [apiKey, setApiKey] = useState('');
  const [maskedKey, setMaskedKey] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [monthlyLimit, setMonthlyLimit] = useState('10');
  const [briefingMode, setBriefingMode] = useState('smart');
  const [stats, setStats] = useState({ calls_today: 0, cost_month: 0 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const key = await getSetting('openrouter_key');
      if (key) {
        setApiKey(key);
        setMaskedKey('••••••••' + key.slice(-4));
      }
      const limit = await getSetting('ai_monthly_limit');
      if (limit) setMonthlyLimit(String(limit));
      const mode = await getSetting('briefing_mode');
      if (mode) setBriefingMode(mode);

      // Try to load AI stats
      try {
        const { getStats } = await import('../../ai/cost.js');
        const s = await getStats();
        if (s) setStats(s);
      } catch {
        // ai/cost.js may not exist yet
      }
    })();
  }, []);

  const handleSaveKey = async () => {
    await setSetting('openrouter_key', apiKey);
    setMaskedKey('••••••••' + apiKey.slice(-4));
    setEditingKey(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleSaveLimit = async () => {
    await setSetting('ai_monthly_limit', parseFloat(monthlyLimit));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleBriefingChange = async (mode) => {
    setBriefingMode(mode);
    await setSetting('briefing_mode', mode);
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="AI-ассистент" onBack={onBack} theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24">

        {/* Утренний брифинг — proto: FIRST section */}
        <div className="mt-3 mb-1" style={{ padding: '0 0 4px' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>УТРЕННИЙ БРИФИНГ</span>
        </div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          {/* Row: toggle */}
          <div className="flex items-center" style={{ gap: 10, padding: '12px 14px', borderBottom: `0.5px solid ${theme.gray5}` }}>
            <div className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 9, background: (theme.purple || '#AF52DE') + '18' }}>
              <span style={{ fontSize: 16 }}>🤖</span>
            </div>
            <span className="flex-1" style={{ fontSize: 15, fontWeight: 400, color: theme.text }}>Утренний брифинг</span>
            <div
              onClick={() => handleBriefingChange(briefingMode === 'off' ? 'smart' : 'off')}
              className="relative cursor-pointer"
              style={{ width: 44, height: 26, borderRadius: 13, background: briefingMode !== 'off' ? theme.green : theme.gray4, padding: 2 }}
            >
              <div className="rounded-full bg-white"
                style={{ width: 22, height: 22, borderRadius: 11, boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transform: briefingMode !== 'off' ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
            </div>
          </div>
          {/* Row: Режим */}
          <div className="flex items-center" style={{ gap: 10, padding: '12px 14px', borderBottom: `0.5px solid ${theme.gray5}` }}>
            <div className="flex-1">
              <div style={{ fontSize: 15, fontWeight: 400, color: theme.text }}>Режим</div>
              <div style={{ fontSize: 12, color: theme.gray2 }}>Только важное</div>
            </div>
            <select
              value={briefingMode === 'off' ? 'smart' : briefingMode}
              onChange={e => handleBriefingChange(e.target.value)}
              style={{ fontSize: 14, color: theme.gray1, background: 'transparent', border: 'none', textAlign: 'right' }}
            >
              <option value="smart">Smart</option>
              <option value="always">Всегда</option>
            </select>
          </div>
          {/* Row: Время */}
          <div className="flex items-center" style={{ gap: 10, padding: '12px 14px' }}>
            <span className="flex-1" style={{ fontSize: 15, fontWeight: 400, color: theme.text }}>Время</span>
            <span style={{ fontSize: 14, color: theme.gray1 }}>07:00 ▾</span>
          </div>
        </Card>

        {/* API ключ (функционал, нет в прото) */}
        <div style={{ padding: '0 0 4px' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>API КЛЮЧ</span>
        </div>
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

        {/* Использование */}
        <div style={{ padding: '0 0 4px' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>ИСПОЛЬЗОВАНИЕ</span>
        </div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ padding: 14 }}>
            <div className="flex justify-between items-baseline" style={{ marginBottom: 6 }}>
              <span className="tabular-nums" style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>
                ${(stats.cost_month || 0).toFixed(2)}
              </span>
              <span style={{ fontSize: 14, color: theme.gray2 }}>
                из ${parseFloat(monthlyLimit || 10).toFixed(2)}
              </span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 6, background: theme.gray5 }}>
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.min(100, ((stats.cost_month || 0) / (parseFloat(monthlyLimit) || 10)) * 100)}%`,
                background: theme.purple || '#AF52DE',
              }} />
            </div>
            <div style={{ fontSize: 12, color: theme.gray2, marginTop: 4 }}>
              AI за {new Date().toLocaleDateString('ru-RU', { month: 'long' })} · обновлено сегодня
            </div>
          </div>
          <div style={{ borderTop: `0.5px solid ${theme.gray5}` }}>
            {[
              { label: 'Вызовов сегодня', value: `${stats.calls_today} / 60` },
              { label: 'Лимит/мес', value: `$${parseFloat(monthlyLimit || 10).toFixed(2)} →`, onClick: () => {} },
              { label: 'Всего за всё время', value: `$${(stats.cost_total || 0).toFixed(2)}` },
            ].map((row, i, arr) => (
              <div key={row.label} className="flex justify-between"
                style={{ padding: '12px 14px', borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                <span style={{ fontSize: 15, fontWeight: 400, color: theme.text }}>{row.label}</span>
                <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 400, color: theme.gray1 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Модель */}
        <div style={{ padding: '0 0 4px' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>МОДЕЛЬ</span>
        </div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 13, color: theme.gray2, marginBottom: 8 }}>
              4-уровневый каскад (дешёвые → мощные)
            </div>
            {[
              { name: 'Haiku', desc: 'Быстрые задачи', cost: '$0.001', active: true },
              { name: 'Sonnet', desc: 'Стандартные запросы', cost: '$0.01', active: true },
              { name: 'Opus', desc: 'Сложный анализ', cost: '$0.05', active: true },
              { name: 'GPT-4o', desc: 'Резерв (если Opus не справ.)', cost: '$0.03', active: false },
            ].map((m, i) => (
              <div key={m.name} className="flex items-center"
                style={{ gap: 10, padding: '8px 0', borderBottom: i < 3 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: m.active ? theme.green : theme.gray4 }} />
                <div className="flex-1">
                  <span style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{m.name}</span>
                  <span style={{ fontSize: 12, color: theme.gray2, marginLeft: 6 }}>{m.desc}</span>
                </div>
                <span className="tabular-nums" style={{ fontSize: 12, color: theme.gray2 }}>{m.cost}/запрос</span>
              </div>
            ))}
          </div>
        </Card>

        {saved && <div className="text-center" style={{ fontSize: 14, color: theme.green }}>✓ Сохранено</div>}
      </div>
    </div>
  );
}
