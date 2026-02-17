/**
 * Heatmap — тепловая карта активности (GitHub/Streaks стиль).
 * 12 недель × 7 дней, интенсивность по уровням 0-4.
 * @param {{ date: string, level: number }[]} data - массив { date: 'YYYY-MM-DD', level: 0-4 }
 * @param {object} theme
 * @param {string} color - базовый цвет (default accent)
 */
export default function Heatmap({ data = [], theme, color }) {
  const baseColor = color || theme.green || '#34C759';

  // Генерим 12 недель назад
  const today = new Date();
  const weeks = 12;
  const cells = [];

  // Находим понедельник 12 недель назад
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7) + (1 - (start.getDay() || 7)));

  const dataMap = {};
  for (const d of data) {
    dataMap[d.date] = d.level;
  }

  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(start);
      cellDate.setDate(start.getDate() + w * 7 + d);
      const dateStr = cellDate.toISOString().split('T')[0];
      const level = dataMap[dateStr] ?? 0;
      const isFuture = cellDate > today;
      cells.push({ week: w, day: d, date: dateStr, level, isFuture });
    }
  }

  const DAYS_LABELS = ['Пн', '', 'Ср', '', 'Пт', '', ''];
  const cellSize = 12;
  const gap = 2;

  // Уровни прозрачности
  const levelOpacity = [0.08, 0.25, 0.45, 0.7, 1.0];

  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="flex gap-0.5">
        {/* Day labels */}
        <div className="flex flex-col shrink-0" style={{ gap, marginRight: 4, paddingTop: 0 }}>
          {DAYS_LABELS.map((label, i) => (
            <div key={i} className="text-[9px] leading-none flex items-center"
              style={{ height: cellSize, color: theme.gray2 }}>
              {label}
            </div>
          ))}
        </div>

        {/* Grid */}
        {Array.from({ length: weeks }, (_, w) => (
          <div key={w} className="flex flex-col" style={{ gap }}>
            {Array.from({ length: 7 }, (_, d) => {
              const cell = cells[w * 7 + d];
              return (
                <div
                  key={d}
                  className="rounded-sm"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    background: cell.isFuture ? 'transparent' : baseColor,
                    opacity: cell.isFuture ? 0.03 : levelOpacity[cell.level],
                    border: cell.isFuture ? `0.5px solid ${theme.gray5}` : 'none',
                  }}
                  title={`${cell.date}: ${cell.level}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
