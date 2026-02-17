import { useState, useEffect, useCallback } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';

const SECTIONS = [
  {
    emoji: '💰', title: 'Финансы', color: '#34C759',
    items: [
      { key: 'budget_exceed', label: 'Превышение бюджета', sub: 'Когда категория > 90% лимита', default: true },
      { key: 'credit_payment', label: 'Платёж по кредиту', sub: 'За 3 дня до даты платежа', default: true },
      { key: 'subscription_charge', label: 'Подписка списание', sub: 'За 1 день до списания', default: true },
    ],
  },
  {
    emoji: '✅', title: 'Задачи', color: '#007AFF',
    items: [
      { key: 'task_deadline', label: 'Дедлайн задачи', sub: 'За 1 час и при наступлении', default: true },
      { key: 'overdue_tasks', label: 'Просроченные задачи', sub: 'Ежедневно в 9:00', default: true },
    ],
  },
  {
    emoji: '🍎', title: 'Питание', color: '#FF9500',
    items: [
      { key: 'log_food', label: 'Напоминание логировать', sub: '12:00, 15:00, 19:00', default: true },
      { key: 'water_reminder', label: 'Вода', sub: 'Каждые 2 часа с 8:00 до 22:00', default: true },
    ],
  },
  {
    emoji: '🏋️', title: 'Спорт', color: '#FF3B30',
    items: [
      { key: 'workout_day', label: 'День тренировки', sub: 'Утром в день по расписанию', default: true },
      { key: 'missed_workout', label: 'Пропущена тренировка', sub: 'Если не начата до 20:00', default: false },
    ],
  },
  {
    emoji: '🏠', title: 'ЖКХ', color: '#5AC8FA',
    items: [
      { key: 'utility_readings', label: 'Передать показания', sub: 'До 25-го числа каждого месяца', default: true },
    ],
  },
  {
    emoji: '🔁', title: 'Рутины', color: '#AF52DE',
    items: [
      { key: 'morning_routine', label: 'Утренняя рутина', sub: '7:00', default: true },
      { key: 'evening_routine', label: 'Вечерняя рутина', sub: '22:00', default: true },
    ],
  },
];

function ToggleRow({ label, sub, enabled, onToggle, last, theme }) {
  return (
    <div className="flex items-center gap-2.5 py-3 px-3.5"
      style={{ borderBottom: last ? 'none' : `0.5px solid ${theme.gray5}` }}>
      <div className="flex-1">
        <div style={{ color: theme.text, fontSize: 15, fontWeight: 400 }}>{label}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: theme.gray2 }}>{sub}</div>}
      </div>
      <button
        className="relative transition-colors"
        style={{ width: 44, height: 26, borderRadius: 13, background: enabled ? theme.green : theme.gray4, padding: 2 }}
        onClick={onToggle}
      >
        <div className="rounded-full bg-white"
          style={{ width: 22, height: 22, borderRadius: 11, boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transform: enabled ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
      </button>
    </div>
  );
}

export default function NotificationsScreen({ onBack, theme }) {
  const [settings, setSettings] = useState({});

  useEffect(() => {
    (async () => {
      const db = (await import('../../db')).default;
      const saved = await db.settings.get('notification_settings').catch(() => null);
      if (saved?.value) {
        setSettings(saved.value);
      } else {
        // Defaults
        const defaults = {};
        SECTIONS.forEach(s => s.items.forEach(item => { defaults[item.key] = item.default; }));
        setSettings(defaults);
      }
    })();
  }, []);

  const toggle = useCallback(async (key) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    const db = (await import('../../db')).default;
    await db.settings.put({ key: 'notification_settings', value: newSettings });
  }, [settings]);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Уведомления" onBack={onBack} theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {SECTIONS.map(section => (
          <div key={section.title}>
            <div className="text-xs font-semibold uppercase tracking-wide mt-4 mb-1"
              style={{ color: theme.gray1 }}>
              {section.emoji} {section.title}
            </div>
            <Card theme={theme} style={{ padding: 0, marginBottom: 4 }}>
              {section.items.map((item, i) => (
                <ToggleRow
                  key={item.key}
                  label={item.label}
                  sub={item.sub}
                  enabled={settings[item.key] ?? item.default}
                  onToggle={() => toggle(item.key)}
                  last={i === section.items.length - 1}
                  theme={theme}
                />
              ))}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
