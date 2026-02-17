import { useTemplates } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import SkeletonList from '../../components/SkeletonList';
import ScreenWrapper from '../../components/ScreenWrapper';

const DAY_LABELS = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const TYPE_COLORS = {
  push: '#FF3B30',
  pull: '#007AFF',
  legs: '#AF52DE',
  upper: '#FF9500',
};

export default function TemplateList({ theme, onBack, onStart, onEdit, onCreate }) {
  const templates = useTemplates();

  if (templates === undefined) {
    return (
      <ScreenWrapper theme={theme}>
        <NavHeader title="Шаблоны" onBack={onBack} left="Спорт" theme={theme}
          right={<button style={{ color: theme.accent, fontSize: 16 }}>＋</button>} />
        <div className="p-4"><SkeletonList count={4} theme={theme} /></div>
      </ScreenWrapper>
    );
  }

  // Attempt to detect AI-generated templates (have day_of_week set)
  const aiTemplates = templates?.filter(t => t.day_of_week) || [];
  const customTemplates = templates?.filter(t => !t.day_of_week) || [];

  return (
    <ScreenWrapper theme={theme}>
      <NavHeader title="Шаблоны" onBack={onBack} left="Спорт" theme={theme}
        right={<button onClick={onCreate} style={{ color: theme.accent, fontSize: 16 }}>＋</button>} />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
        {templates?.length === 0 ? (
          <EmptyState
            icon="📋"
            title="Нет шаблонов"
            subtitle="Создайте шаблон тренировки для быстрого старта"
            actionLabel="＋ Создать шаблон"
            onAction={onCreate}
            theme={theme}
          />
        ) : (
          <>
            {/* AI Program */}
            {aiTemplates.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.purple || '#AF52DE' }}>
                  AI-ПРОГРАММА (PPL)
                </div>
                <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
                  {aiTemplates.map((t, i) => {
                    const color = TYPE_COLORS[t.type] || theme.accent;
                    const exCount = t.exercises?.length || 0;
                    return (
                      <div key={t.id} style={{ padding: '12px 14px', borderBottom: i < aiTemplates.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{ width: 6, height: 24, borderRadius: 3, background: color }} />
                          <div className="flex-1" onClick={() => onEdit?.(t)}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{t.name}</div>
                            <div style={{ fontSize: 12, color: theme.gray2 }}>
                              {t.day_of_week ? DAY_LABELS[t.day_of_week] : ''}
                              {exCount > 0 ? ` · ${exCount} упр` : ''}
                            </div>
                          </div>
                          <button onClick={() => onStart?.(t.id)}
                            style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', background: theme.accent, border: 'none', cursor: 'pointer' }}>
                            Начать
                          </button>
                        </div>
                        {/* Exercise chips */}
                        {t.exercises?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginLeft: 14 }}>
                            {t.exercises.map((ex, j) => (
                              <span key={j} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: theme.gray5, color: theme.gray2 }}>
                                {ex.name || ex.exercise_id}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Card>
              </>
            )}

            {/* Custom templates */}
            {customTemplates.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>
                  МОИ ШАБЛОНЫ
                </div>
                <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
                  {customTemplates.map((t, i) => {
                    const exCount = t.exercises?.length || 0;
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: i < customTemplates.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                        <div style={{ width: 6, height: 24, borderRadius: 3, background: theme.gray3 }} />
                        <div className="flex-1" onClick={() => onEdit?.(t)}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{t.name}</div>
                          <div style={{ fontSize: 12, color: theme.gray2 }}>
                            {exCount > 0 ? `${exCount} упр` : 'Пустой шаблон'}
                          </div>
                        </div>
                        <button onClick={() => onStart?.(t.id)}
                          style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: theme.gray5, color: theme.gray1, border: 'none', cursor: 'pointer' }}>
                          Начать
                        </button>
                      </div>
                    );
                  })}
                </Card>
              </>
            )}
          </>
        )}

        {/* Create buttons */}
        <div className="flex gap-2">
          <button onClick={onCreate}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl"
            style={{ background: (theme.purple || '#AF52DE') + '10' }}>
            <span style={{ fontSize: 12 }}>🤖</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: theme.purple || '#AF52DE' }}>AI создаст</span>
          </button>
          <button onClick={onCreate}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl"
            style={{ background: theme.gray5 }}>
            <span style={{ fontSize: 12 }}>📝</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: theme.gray1 }}>Создать свой</span>
          </button>
        </div>
      </div>
    </ScreenWrapper>
  );
}
