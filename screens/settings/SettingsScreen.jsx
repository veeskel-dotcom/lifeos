import { useState, useEffect } from 'react';
import { useProfile, useSetting } from '../../hooks/useDB';
import { getSetting, setSetting } from '../../db/helpers';
import { fmtMoney } from '../../utils/currency';
import { getThemeColors } from '../../theme/colors';
import NavHeader from '../../components/NavHeader';
import { resetAllTips } from '../../components/TutorialTip';
import Card from '../../components/Card';
import Ic from '../../components/Icon';
import { getStorageEstimate } from '../../db/backup';
import ScreenWrapper from '../../components/ScreenWrapper';

function SettingsRow({ label, value, arrow, toggle, onToggle, onClick, theme, danger, icon, iconName, iconColor }) {
  return (
    <div
      className={`flex items-center ${onClick ? 'cursor-pointer active:opacity-70' : ''}`}
      style={{ gap: 10, padding: '12px 14px' }}
      onClick={onClick}
    >
      {iconName ? (
        <Ic name={iconName} color={iconColor || theme.accent} size={32} r={9} />
      ) : icon ? (
        <div className="flex items-center justify-center shrink-0"
          style={{ width: 32, height: 32, borderRadius: 9, background: (iconColor || theme.accent) + '18' }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
        </div>
      ) : null}
      <span className="flex-1" style={{ fontSize: 15, fontWeight: 400, color: danger ? theme.red : theme.text }}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        {value && (
          <span className="tabular-nums" style={{ fontSize: 14, color: theme.gray1 }}>{value}</span>
        )}
        {toggle !== undefined && (
          <div
            onClick={e => { e.stopPropagation(); onToggle?.(); }}
            className="relative cursor-pointer"
            style={{ width: 44, height: 26, borderRadius: 13, background: toggle ? theme.green : theme.gray4, padding: 2 }}
          >
            <div className="rounded-full bg-white"
              style={{ width: 22, height: 22, borderRadius: 11, boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transform: toggle ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
          </div>
        )}
        {arrow && <span style={{ fontSize: 14, color: theme.gray3 }}>→</span>}
      </div>
    </div>
  );
}

function Divider({ theme }) {
  return <div className="mx-4" style={{ borderTop: `0.5px solid ${theme.gray5}` }} />;
}

export default function SettingsScreen({ theme, onThemeChange, onBack, onNavigate }) {
  const [themeMode, setThemeMode] = useState('system');
  const [storageMB, setStorageMB] = useState(null);
  const [aiCost, setAiCost] = useState(null);
  const [aiCalls, setAiCalls] = useState(null);
  /* L2: module toggles */
  const ALL_MODULES = [
    { id: 'finance', label: 'Финансы' },
    { id: 'tasks', label: 'Задачи' },
    { id: 'nutrition', label: 'Питание' },
    { id: 'sport', label: 'Спорт' },
    { id: 'invest', label: 'Инвестиции' },
    { id: 'routines', label: 'Рутины' },
    { id: 'subscriptions', label: 'Подписки' },
    { id: 'sleep', label: 'Сон' },
    { id: 'notes', label: 'Заметки' },
    { id: 'documents', label: 'Документы' },
  ];
  const [enabledModules, setEnabledModules] = useState(new Set(ALL_MODULES.map(m => m.id)));

  const toggleModuleSetting = async (id) => {
    setEnabledModules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      setSetting('enabled_modules', JSON.stringify([...next]));
      return next;
    });
  };

  const profile = useProfile();
  const budget = useSetting('monthly_budget');
  const weightGoal = useSetting('weight_goal');
  const calorieGoal = useSetting('daily_calorie_goal');
  const currency = useSetting('default_currency');

  useEffect(() => {
    getSetting('theme').then(t => { if (t) setThemeMode(t); });
    getStorageEstimate().then(s => { if (s) setStorageMB(s.used_mb); });
    /* L2: load enabled modules */
    getSetting('enabled_modules').then(v => {
      if (v) try { setEnabledModules(new Set(JSON.parse(v))); } catch {}
    });
    // Try loading AI stats
    (async () => {
      try {
        const { getStats } = await import('../../ai/cost.js');
        const s = await getStats();
        if (s) { setAiCost(s.cost_month); setAiCalls(s.calls_today); }
      } catch { /* ai/cost.js may not exist */ }
    })();
  }, []);

  const handleThemeChange = async (mode) => {
    setThemeMode(mode);
    await setSetting('theme', mode);
    onThemeChange?.(mode);
  };

  const profileData = profile || {};
  const currCode = currency || 'KZT';

  return (
    <ScreenWrapper theme={theme}>
      <NavHeader title="Настройки" onBack={onBack} theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {/* ПРОФИЛЬ */}
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
          Профиль
        </div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
          <SettingsRow
            iconName="shield" iconColor="#007AFF"
            label="Имя" value={profileData.name || '—'} arrow
            onClick={() => onNavigate('profile')} theme={theme}
          />
          <Divider theme={theme} />
          <SettingsRow
            iconName="wallet" iconColor="#34C759"
            label="Месячный бюджет"
            value={budget ? fmtMoney(budget) : '—'}
            arrow onClick={() => onNavigate('profile')} theme={theme}
          />
          <Divider theme={theme} />
          <SettingsRow
            iconName="weight" iconColor="#AF52DE"
            label="Цель по весу"
            value={weightGoal ? `${weightGoal} кг` : '—'}
            arrow onClick={() => onNavigate('profile')} theme={theme}
          />
          <Divider theme={theme} />
          <SettingsRow
            iconName="flame" iconColor="#FF9500"
            label="Калории/день"
            value={calorieGoal ? `${Number(calorieGoal).toLocaleString('ru-RU')}` : '—'}
            arrow onClick={() => onNavigate('profile')} theme={theme}
          />
        </Card>

        {/* ВНЕШНИЙ ВИД */}
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1, padding: '0 0 4px' }}>ВНЕШНИЙ ВИД</div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          {/* Row: Тема */}
          <div className="flex items-center" style={{ gap: 10, padding: '12px 14px', borderBottom: `0.5px solid ${theme.gray5}` }}>
            <Ic name="moon" color={theme.purple || '#AF52DE'} size={32} r={9} />
            <span className="flex-1" style={{ fontSize: 15, fontWeight: 400, color: theme.text }}>Тема</span>
            <select
              value={themeMode}
              onChange={e => handleThemeChange(e.target.value)}
              style={{ fontSize: 14, color: theme.gray1, background: 'transparent', border: 'none', textAlign: 'right' }}
            >
              <option value="light">Светлая</option>
              <option value="dark">Тёмная</option>
              <option value="system">Системная</option>
            </select>
          </div>
          {/* Tab Bar customizer */}
          <div style={{ padding: '12px 14px', borderBottom: `0.5px solid ${theme.gray5}` }}>
            <div className="flex items-center" style={{ gap: 10, marginBottom: 10 }}>
              <Ic name="more" color={theme.accent} size={32} r={9} />
              <span style={{ fontSize: 15, color: theme.text }}>Настройка Tab Bar</span>
              <span style={{ fontSize: 12, color: theme.gray2, marginLeft: 'auto' }}>2-4 таба</span>
            </div>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              {ALL_MODULES.map(m => {
                const active = enabledModules.has(m.id);
                return (
                  <div key={m.id} onClick={() => toggleModuleSetting(m.id)}
                    className="cursor-pointer"
                    style={{
                      padding: '6px 12px', borderRadius: 12, fontSize: 13, fontWeight: 500,
                      background: active ? theme.accent + '15' : theme.gray5,
                      color: active ? theme.accent : theme.gray2,
                      border: active ? `1.5px solid ${theme.accent}` : '1.5px solid transparent',
                    }}>
                    {m.label}{active ? ' ✓' : ''}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: theme.gray2, marginTop: 6 }}>Центральная «+» всегда на месте</div>
          </div>
          {/* Row: Модули на дашборде */}
          <SettingsRow label="Модули на дашборде" arrow onClick={() => {}} theme={theme} />
        </Card>

        {/* БЕЗОПАСНОСТЬ */}
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
          Безопасность
        </div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
          <SettingsRow
            iconName="lock" iconColor="#FF3B30"
            label="Сменить PIN" arrow
            onClick={() => onNavigate('security')} theme={theme}
          />
          <Divider theme={theme} />
          <SettingsRow
            iconName="shield" iconColor="#34C759"
            label="Face ID / Touch ID" arrow
            onClick={() => onNavigate('security')} theme={theme}
          />
        </Card>

        {/* AI-АССИСТЕНТ */}
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
          AI-ассистент
        </div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
          <SettingsRow
            label="API ключ (OpenRouter)" value="••••" arrow
            onClick={() => onNavigate('ai')} theme={theme}
          />
          <Divider theme={theme} />
          <SettingsRow
            label="AI за этот месяц"
            value={aiCost != null ? `$${aiCost.toFixed(2)}` : '—'}
            onClick={() => onNavigate('ai')} theme={theme}
          />
          <Divider theme={theme} />
          <SettingsRow
            label="Вызовов сегодня"
            value={aiCalls != null ? `${aiCalls} / 60` : '—'}
            onClick={() => onNavigate('ai')} theme={theme}
          />
        </Card>

        {/* УВЕДОМЛЕНИЯ */}
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
          Уведомления
        </div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
          <SettingsRow
            label="Настройка уведомлений" arrow
            onClick={() => onNavigate('notifications')} theme={theme}
          />
        </Card>

        {/* ДАННЫЕ */}
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
          Данные
        </div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
          <SettingsRow
            label="Размер базы"
            value={storageMB ? `${storageMB} МБ` : '...'}
            theme={theme}
          />
          <Divider theme={theme} />
          <SettingsRow
            label="Экспорт / Импорт / Очистка" arrow
            onClick={() => onNavigate('data')} theme={theme}
          />
        </Card>

        {/* АНАЛИТИКА */}
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
          Аналитика
        </div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
          <SettingsRow
            iconName="chart" iconColor={theme.orange || '#FF9500'} label="Статистика использования" arrow
            onClick={() => onNavigate('analytics')} theme={theme}
          />
          <Divider theme={theme} />
          <SettingsRow
            iconName="flag" iconColor={theme.red || '#FF3B30'} label="Логи ошибок" arrow
            onClick={() => onNavigate('error-log')} theme={theme}
          />
        </Card>

        {/* О ПРИЛОЖЕНИИ */}
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
          <SettingsRow
            label="О приложении" value="LifeOS v1.0.0" arrow
            onClick={() => onNavigate('about')} theme={theme}
          />
        </Card>
      </div>
    </ScreenWrapper>
  );
}
