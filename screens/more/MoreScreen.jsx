import { useState, useEffect } from 'react';
import { getDailyCompletion } from '../../services/routines';
import { getMonthlyTotal } from '../../services/subscriptions';
import { getNotesCount } from '../../services/notes';
import { getExpiringSoon } from '../../services/documents';
import { fmtMoney } from '../../utils/currency';
import { getLatestSleep } from '../../services/sleep';

export default function MoreScreen({ theme, onNavigate }) {
  const [summaries, setSummaries] = useState({});

  useEffect(() => {
    (async () => {
      const [routines, monthlyTotal, notesCount, expiring, lastSleep] = await Promise.all([
        getDailyCompletion().catch(() => null),
        getMonthlyTotal().catch(() => 0),
        getNotesCount().catch(() => 0),
        getExpiringSoon(60).catch(() => []),
        getLatestSleep().catch(() => null),
      ]);
      setSummaries({ routines, monthlyTotal, notesCount, expiring: expiring.length, lastSleep });
    })();
  }, []);

  const items = [
    { emoji: '💰', color: theme.green || '#34C759', label: 'Финансы', screen: 'finance' },
    { emoji: '📈', color: theme.accent || '#007AFF', label: 'Инвестиции', screen: 'invest' },
    { emoji: '🏋️', color: theme.red || '#FF3B30', label: 'Спорт', screen: 'sport' },
    { emoji: '❤️', color: '#FF2D55', label: 'Здоровье', screen: 'health' },
    { emoji: '📅', color: theme.orange || '#FF9500', label: 'Календарь', screen: 'calendar' },
    {
      emoji: '🔄', color: theme.accent, label: 'Рутины', screen: 'routines',
      detail: summaries.routines ? `${summaries.routines.completed}/${summaries.routines.total} сегодня` : null,
    },
    {
      emoji: '💳', color: '#FF2D55', label: 'Подписки', screen: 'subscriptions',
      detail: summaries.monthlyTotal ? `${fmtMoney(summaries.monthlyTotal)}/мес` : null,
    },
    {
      emoji: '😴', color: theme.purple || '#AF52DE', label: 'Сон', screen: 'sleep',
      detail: summaries.lastSleep?.duration_hours ? `${summaries.lastSleep.duration_hours}ч вчера` : null,
    },
    {
      emoji: '📝', color: '#FFCC00', label: 'Заметки', screen: 'notes',
      detail: summaries.notesCount ? `${summaries.notesCount} заметок` : null,
    },
    {
      emoji: '📄', color: theme.teal || '#30B0C7', label: 'Документы', screen: 'documents',
      detail: summaries.expiring ? `${summaries.expiring} скоро ⚠️` : null,
      warn: summaries.expiring > 0,
    },
    { emoji: '🛒', color: theme.green || '#34C759', label: 'Покупки', screen: 'shopping' },
    { emoji: '🤖', color: theme.purple || '#AF52DE', label: 'AI-чат', screen: 'ai-chat' },
    { emoji: '📊', color: theme.orange || '#FF9500', label: 'Аналитика', screen: 'analytics' },
    { emoji: '🔔', color: theme.red || '#FF3B30', label: 'Уведомления', screen: 'notifications' },
    { emoji: '🏠', color: theme.orange || '#FF9500', label: 'ЖКХ', screen: 'utilities' },
  ];

  return (
    <div className="flex flex-col gap-3 px-4 pt-2 pb-28">
      <h1 className="font-bold px-1" style={{ color: theme.text, fontSize: 28 }}>Ещё</h1>

      <div className="rounded-2xl overflow-hidden" style={{ background: theme.card }}>
        {items.map((item, i) => (
          <button
            key={item.screen}
            onClick={() => onNavigate?.(item.screen)}
            className="flex items-center gap-3 w-full px-4 py-3 text-left active:opacity-70"
            style={{ borderBottom: i < items.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}
          >
            <div className="flex items-center justify-center shrink-0"
              style={{ width: 32, height: 32, borderRadius: 8, background: item.color + '18' }}>
              <span style={{ fontSize: 16 }}>{item.emoji}</span>
            </div>
            <span className="flex-1 font-medium" style={{ color: theme.text, fontSize: 15 }}>
              {item.label}
            </span>
            {item.detail && (
              <span className="text-sm tabular-nums" style={{ color: item.warn ? theme.orange : theme.gray1 }}>
                {item.detail}
              </span>
            )}
            <span style={{ color: theme.gray3, fontSize: 18 }}>→</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: theme.card }}>
        <button
          onClick={() => onNavigate?.('settings')}
          className="flex items-center gap-3 w-full px-4 py-3 text-left active:opacity-70"
        >
          <div className="flex items-center justify-center shrink-0"
            style={{ width: 32, height: 32, borderRadius: 8, background: (theme.gray1 || '#8E8E93') + '18' }}>
            <span style={{ fontSize: 16 }}>⚙️</span>
          </div>
          <span className="flex-1 font-medium" style={{ color: theme.text, fontSize: 15 }}>Настройки</span>
          <span style={{ color: theme.gray3, fontSize: 18 }}>→</span>
        </button>
      </div>
    </div>
  );
}
