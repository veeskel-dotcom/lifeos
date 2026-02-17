import { useState, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import ScreenWrapper from '../../components/ScreenWrapper';
import { getSetting, setSetting } from '../../db/helpers';

const THEME_OPTIONS = [
  { id: 'light', label: 'Светлая', bg: '#FFFFFF', border: '#E5E5EA' },
  { id: 'dark', label: 'Тёмная', bg: '#1C1C1E', border: '#333' },
  { id: 'system', label: 'Системная', bg: 'linear-gradient(135deg, #fff 50%, #1C1C1E 50%)', border: '#007AFF' },
];

const FONT_SIZES = [
  { id: 'small', label: 'Мелкий', scale: 0.85 },
  { id: 'default', label: 'Стандартный', scale: 1 },
  { id: 'large', label: 'Крупный', scale: 1.15 },
  { id: 'xlarge', label: 'Очень крупный', scale: 1.3 },
];

const TAB_MODULES = [
  { id: 'finance', label: '💰 Финансы' },
  { id: 'tasks', label: '📋 Задачи' },
  { id: 'nutrition', label: '🍎 Питание' },
  { id: 'sport', label: '🏋️ Спорт' },
  { id: 'invest', label: '📈 Инвестиции' },
  { id: 'calendar', label: '📅 Календарь' },
  { id: 'health', label: '❤️ Здоровье' },
];

export default function AppearanceScreen({ theme, onBack, onThemeChange }) {
  const [themeMode, setThemeMode] = useState('system');
  const [fontScale, setFontScale] = useState('default');
  const [enabledTabs, setEnabledTabs] = useState(new Set(['finance', 'tasks', 'nutrition']));

  useEffect(() => {
    getSetting('theme').then(t => { if (t) setThemeMode(t); });
    getSetting('font_scale').then(v => { if (v) setFontScale(v); });
    getSetting('enabled_modules').then(v => {
      if (v) try { setEnabledTabs(new Set(JSON.parse(v))); } catch {}
    });
  }, []);

  const handleTheme = async (mode) => {
    setThemeMode(mode);
    await setSetting('theme', mode);
    onThemeChange?.(mode);
  };

  const handleFontScale = async (id) => {
    setFontScale(id);
    await setSetting('font_scale', id);
  };

  const toggleTab = async (id) => {
    setEnabledTabs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      setSetting('enabled_modules', JSON.stringify([...next]));
      return next;
    });
  };

  const currentScale = FONT_SIZES.find(f => f.id === fontScale) || FONT_SIZES[1];
  const scaleIdx = FONT_SIZES.findIndex(f => f.id === fontScale);
  const pct = FONT_SIZES.length > 1 ? (scaleIdx / (FONT_SIZES.length - 1)) * 100 : 50;

  return (
    <ScreenWrapper theme={theme}>
      <NavHeader title="Внешний вид" onBack={onBack} theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {/* ТЕМА */}
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>ТЕМА</div>
        <Card theme={theme}>
          <div style={{ display: 'flex', gap: 10 }}>
            {THEME_OPTIONS.map(t => {
              const active = themeMode === t.id;
              return (
                <div key={t.id} style={{ flex: 1, textAlign: 'center', cursor: 'pointer' }} onClick={() => handleTheme(t.id)}>
                  <div style={{
                    width: '100%', height: 60, borderRadius: 10,
                    background: t.bg,
                    border: `2px solid ${active ? theme.accent : t.border}`,
                    marginBottom: 6,
                  }} />
                  <div style={{ fontSize: 12, color: active ? theme.accent : theme.gray2, fontWeight: active ? 600 : 400 }}>
                    {t.label}
                  </div>
                  {active && <div style={{ fontSize: 10, color: theme.accent }}>✓</div>}
                </div>
              );
            })}
          </div>
        </Card>

        {/* НАСТРОЙКА TAB BAR */}
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>НАСТРОЙКА TAB BAR</div>
        <Card theme={theme}>
          <div style={{ fontSize: 13, color: theme.gray2, marginBottom: 8 }}>
            Выберите 2-4 таба (центральная «+» всегда на месте)
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TAB_MODULES.map(m => {
              const active = enabledTabs.has(m.id);
              return (
                <div
                  key={m.id}
                  onClick={() => toggleTab(m.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    background: active ? theme.accent + '15' : theme.gray5,
                    color: active ? theme.accent : theme.gray2,
                    border: active ? `1.5px solid ${theme.accent}` : '1.5px solid transparent',
                  }}
                >
                  {m.label}{active ? ' ✓' : ''}
                </div>
              );
            })}
          </div>
        </Card>

        {/* РАЗМЕР ТЕКСТА */}
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>РАЗМЕР ТЕКСТА</div>
        <Card theme={theme}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: theme.gray2 }}>A</span>
            <div style={{ flex: 1, margin: '0 12px', height: 4, borderRadius: 2, background: theme.gray4, position: 'relative' }}>
              <div style={{
                position: 'absolute', left: `${pct}%`, top: -4,
                width: 12, height: 12, borderRadius: 6, background: theme.accent,
                transform: 'translateX(-50%)',
              }} />
            </div>
            <span style={{ fontSize: 18, color: theme.gray2 }}>A</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {FONT_SIZES.map(f => (
              <button
                key={f.id}
                onClick={() => handleFontScale(f.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                  fontSize: 11, fontWeight: fontScale === f.id ? 600 : 400,
                  color: fontScale === f.id ? theme.accent : theme.gray2,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </ScreenWrapper>
  );
}
