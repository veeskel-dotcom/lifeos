import { useState, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import SkeletonCard from '../../components/SkeletonCard';
import { getAllPRs } from '../../services/workouts';

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupByDate(prs) {
  const groups = [];
  let currentDate = null;
  let currentGroup = null;

  for (const pr of prs) {
    if (pr.date !== currentDate) {
      currentDate = pr.date;
      currentGroup = { date: pr.date, label: formatDate(pr.date), items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(pr);
  }

  return groups;
}

export default function PRList({ theme, onBack }) {
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllPRs()
      .then(setPrs)
      .catch(() => setPrs([]))
      .finally(() => setLoading(false));
  }, []);

  const groups = groupByDate(prs);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Рекорды 🏆" onBack={onBack} left="Спорт" theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard theme={theme} />
            <SkeletonCard variant="compact" theme={theme} />
            <SkeletonCard variant="compact" theme={theme} />
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon="🏆"
            title="Пока нет рекордов"
            subtitle="Продолжайте тренироваться — рекорды появятся!"
            theme={theme}
          />
        ) : (
          groups.map(group => (
            <div key={group.date}>
              <div className="py-2 px-1" style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                {group.label}
              </div>
              <div className="space-y-2">
                {group.items.map((pr, i) => (
                  <Card key={`${pr.date}-${pr.exercise_id}-${i}`} theme={theme}>
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: 24 }}>🏆</span>
                      <div className="flex-1 min-w-0">
                        <div style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>
                          {pr.exercise_name}
                        </div>
                        <div style={{ color: theme.accent, fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          {pr.weight} кг
                          <span className="ml-1" style={{ color: theme.green, fontSize: 14, fontWeight: 600 }}>
                            (+{pr.improvement} кг)
                          </span>
                        </div>
                        <div style={{ color: theme.gray2, fontSize: 12 }}>
                          Было: {pr.prev} кг
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
