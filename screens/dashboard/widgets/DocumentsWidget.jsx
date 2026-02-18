import { useLiveQuery } from '../../../hooks/useDB';
import WidgetCard from './WidgetCard';
import { getExpiringSoon } from '../../../services/documents';
import { WIDGET_COLORS } from '../widgetRegistry';

export default function DocumentsWidget({ theme, onNavigate, size = 'small' }) {
  const color = WIDGET_COLORS.documents(theme);

  const data = useLiveQuery(async () => {
    try {
      const docs = await getExpiringSoon(60);
      if (!docs || docs.length === 0) return null;
      return docs.slice(0, 3);
    } catch { return null; }
  });

  if (data === undefined) return (
    <WidgetCard title="Документы" iconName="note" color={color} theme={theme} size={size} onClick={() => onNavigate?.('documents')}>
      <span className="font-bold" style={{ fontSize: 28, color: theme.gray3 }}>—</span>
      <div className="text-[10px] mt-1" style={{ color: theme.gray2 }}>Нет документов</div>
    </WidgetCard>
  );
  if (!data) return (
    <WidgetCard title="Документы" iconName="note" color={color} theme={theme} size={size} onClick={() => onNavigate?.('documents')}>
      <span className="font-bold" style={{ fontSize: 28, color: theme.gray3 }}>—</span>
      <div className="text-[10px] mt-1" style={{ color: theme.gray2 }}>Нет документов</div>
    </WidgetCard>
  );

  return (
    <WidgetCard title="Документы" iconName="note" color={color} theme={theme} size={size} onClick={() => onNavigate?.('documents')}>
      {data.map((doc, i) => {
        const daysLeft = Math.ceil((new Date(doc.expires_at) - new Date()) / 86400000);
        return (
          <div
            key={doc.id}
            className="flex items-center justify-between py-1.5"
            style={{ borderTop: i > 0 ? `0.5px solid ${theme.gray5}` : 'none' }}
          >
            <span className="text-sm truncate" style={{ color: theme.text }}>{doc.name || doc.type}</span>
            <span className="text-xs font-semibold tabular-nums shrink-0 ml-2" style={{ color: daysLeft < 14 ? theme.red : theme.orange }}>
              {daysLeft} дн.
            </span>
          </div>
        );
      })}
    </WidgetCard>
  );
}
