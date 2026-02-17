import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import { getMuscleGroupLoad } from '../../services/workouts';

const MUSCLE_GROUPS = [
  { key: 'shoulders', label: 'Плечи' },
  { key: 'chest', label: 'Грудь' },
  { key: 'back', label: 'Спина' },
  { key: 'arms', label: 'Руки' },
  { key: 'core', label: 'Пресс' },
  { key: 'legs', label: 'Ноги' },
];

function getOpacity(sets, maxSets) {
  if (!sets || sets === 0) return 0.1;
  if (maxSets === 0) return 0.1;
  return Math.max(0.15, Math.min(1, sets / maxSets));
}

export default function MuscleMap({ theme }) {
  const [load, setLoad] = useState({});

  useEffect(() => {
    getMuscleGroupLoad(7).then(setLoad).catch(() => {});
  }, []);

  const maxSets = Math.max(1, ...Object.values(load).map(v => v || 0));

  return (
    <Card theme={theme}>
      <div className="mb-3" style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
        Мышечная карта (7 дней)
      </div>

      <div className="flex items-start gap-4">
        {/* SVG фигура */}
        <svg viewBox="0 0 120 260" style={{ width: 100, height: 220 }}>
          {/* Голова */}
          <circle cx="60" cy="20" r="14" fill={theme.gray4} />

          {/* Шея */}
          <rect x="54" y="34" width="12" height="10" rx="3" fill={theme.gray4} />

          {/* Плечи */}
          <ellipse cx="32" cy="56" rx="14" ry="10"
            fill={theme.accent}
            opacity={getOpacity(load.shoulders, maxSets)}
          />
          <ellipse cx="88" cy="56" rx="14" ry="10"
            fill={theme.accent}
            opacity={getOpacity(load.shoulders, maxSets)}
          />

          {/* Грудь */}
          <ellipse cx="48" cy="72" rx="16" ry="14"
            fill={theme.accent}
            opacity={getOpacity(load.chest, maxSets)}
          />
          <ellipse cx="72" cy="72" rx="16" ry="14"
            fill={theme.accent}
            opacity={getOpacity(load.chest, maxSets)}
          />

          {/* Спина (видна как фон за грудью — чуть шире) */}
          <rect x="36" y="60" width="48" height="30" rx="8"
            fill={theme.accent}
            opacity={getOpacity(load.back, maxSets) * 0.5}
          />

          {/* Пресс */}
          <rect x="46" y="88" width="28" height="32" rx="6"
            fill={theme.accent}
            opacity={getOpacity(load.core, maxSets)}
          />

          {/* Руки */}
          <rect x="14" y="60" width="14" height="44" rx="6"
            fill={theme.accent}
            opacity={getOpacity(load.arms, maxSets)}
          />
          <rect x="92" y="60" width="14" height="44" rx="6"
            fill={theme.accent}
            opacity={getOpacity(load.arms, maxSets)}
          />

          {/* Ноги */}
          <rect x="38" y="124" width="18" height="60" rx="8"
            fill={theme.accent}
            opacity={getOpacity(load.legs, maxSets)}
          />
          <rect x="64" y="124" width="18" height="60" rx="8"
            fill={theme.accent}
            opacity={getOpacity(load.legs, maxSets)}
          />

          {/* Голени */}
          <rect x="40" y="188" width="14" height="44" rx="6"
            fill={theme.accent}
            opacity={getOpacity(load.legs, maxSets) * 0.7}
          />
          <rect x="66" y="188" width="14" height="44" rx="6"
            fill={theme.accent}
            opacity={getOpacity(load.legs, maxSets) * 0.7}
          />

          {/* Стопы */}
          <ellipse cx="47" cy="238" rx="10" ry="5" fill={theme.gray4} />
          <ellipse cx="73" cy="238" rx="10" ry="5" fill={theme.gray4} />
        </svg>

        {/* Легенда */}
        <div className="flex-1 space-y-1.5 pt-1">
          {MUSCLE_GROUPS.map(({ key, label }) => {
            const sets = load[key] || 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{
                    background: theme.accent,
                    opacity: getOpacity(sets, maxSets),
                  }}
                />
                <span className="flex-1" style={{ color: theme.text, fontSize: 12 }}>
                  {label}
                </span>
                <span style={{ color: sets > 0 ? theme.text : theme.gray3, fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {sets}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
