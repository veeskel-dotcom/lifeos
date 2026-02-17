import { useState } from 'react';
import { useSportVideos } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import { analyzeVideo } from '../../services/videoAnalysis';

const SPORTS = [
  { id: 'tennis', label: '🎾 Теннис', strokes: ['forehand', 'backhand', 'serve', 'volley'] },
  { id: 'skiing', label: '⛷ Лыжи', strokes: ['parallel', 'carving', 'moguls'] },
];

const STROKE_LABELS = {
  forehand: 'Форхенд', backhand: 'Бэкхенд', serve: 'Подача', volley: 'Воллей',
  parallel: 'Параллельные', carving: 'Карвинг', moguls: 'Могул',
};

const SCORE_LABELS = {
  stance: 'Стойка', grip: 'Хватка', swing: 'Замах', follow_through: 'Сопровождение',
  edging: 'Кантование', pole_plant: 'Укол палкой', weight_transfer: 'Перенос веса',
};

export default function VideoAnalysis({ theme, onBack }) {
  const [sport, setSport] = useState('tennis');
  const [stroke, setStroke] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const analyses = useSportVideos(sport);

  const sportConfig = SPORTS.find(s => s.id === sport);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      await analyzeVideo(file, sport, stroke || null);
    } catch (err) {
      setError(err.message || 'Ошибка анализа');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Видеоанализ" onBack={onBack} left="Спорт" theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        <div className="mx-4 mt-2 px-3 py-2 rounded-xl text-xs" style={{ background: theme.accent + '10', color: theme.accent }}>
          Анализ видео в разработке. Результаты демонстрационные.
        </div>

        {/* Sport selector */}
        <div className="flex gap-2">
          {SPORTS.map(s => (
            <button
              key={s.id} onClick={() => { setSport(s.id); setStroke(''); }}
              style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, textAlign: 'center', background: sport === s.id ? theme.accent : theme.gray5, color: sport === s.id ? '#fff' : theme.text }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Stroke selector */}
        <div className="flex gap-2 flex-wrap">
          {sportConfig?.strokes.map(st => (
            <button
              key={st} onClick={() => setStroke(stroke === st ? '' : st)}
              style={{ padding: '6px 12px', paddingRight: 12, borderRadius: 9999, fontSize: 12, fontWeight: 500, background: stroke === st ? theme.accent : theme.gray5, color: stroke === st ? '#fff' : theme.text }}
            >
              {STROKE_LABELS[st] || st}
            </button>
          ))}
        </div>

        {/* Upload */}
        <Card theme={theme}>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', paddingTop: 24, paddingBottom: 24 }}>
            {isAnalyzing ? (
              <>
                <div className="animate-pulse" style={{ fontSize: 30, marginBottom: 8 }}>🔄</div>
                <span style={{ color: theme.accent, fontSize: 14, fontWeight: 500 }}>Анализ видео...</span>
                <span style={{ color: theme.gray2, fontSize: 12, marginTop: 4 }}>Извлечение кадров и AI-оценка</span>
              </>
            ) : (
              <>
                <div style={{ fontSize: 30, marginBottom: 8 }}>📹</div>
                <span style={{ color: theme.accent, fontSize: 14, fontWeight: 500 }}>Записать видео (10-30 сек)</span>
                <span style={{ color: theme.gray2, fontSize: 12, marginTop: 4 }}>Или выбрать из галереи</span>
              </>
            )}
            <input
              type="file" accept="video/*" capture="environment"
              onChange={handleFileSelect} disabled={isAnalyzing}
              style={{ display: 'none' }}
            />
          </label>
        </Card>

        {error && (
          <div style={{ color: theme.red, fontSize: 14, textAlign: 'center', paddingTop: 8, paddingBottom: 8 }}>{error}</div>
        )}

        {/* Past analyses */}
        <div>
          <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em', paddingTop: 8, paddingBottom: 8 }}>
            Последние анализы
          </div>
          {!analyses || analyses.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>📊</div>
              <p style={{ color: theme.gray2, fontSize: 14 }}>Анализов пока нет</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {analyses.map(a => (
                <Card key={a.id} theme={theme}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: theme.text, fontSize: 14, fontWeight: 500 }}>
                      {sport === 'tennis' ? '🎾' : '⛷'} {STROKE_LABELS[a.stroke_type] || 'Общий'} · {a.date}
                    </span>
                  </div>

                  {/* Scores */}
                  {a.ai_analysis?.scores && (
                    <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                      {Object.entries(a.ai_analysis.scores).map(([key, val]) => (
                        <div key={key} style={{ textAlign: 'center' }}>
                          <div style={{ color: val >= 7 ? theme.green : val >= 5 ? theme.orange : theme.red, fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {val}
                          </div>
                          <div style={{ color: theme.gray2, fontSize: 10 }}>
                            {SCORE_LABELS[key] || key}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary */}
                  {a.ai_analysis?.summary && (
                    <p style={{ color: theme.gray1, fontSize: 13, lineHeight: '18px' }}>
                      {a.ai_analysis.summary}
                    </p>
                  )}

                  {/* Drills */}
                  {a.ai_analysis?.drills?.length > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `0.5px solid ${theme.gray5}` }}>
                      <span style={{ color: theme.gray2, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Упражнения:</span>
                      {a.ai_analysis.drills.map((d, i) => (
                        <div key={i} style={{ color: theme.gray1, fontSize: 12, marginTop: 4 }}>• {d}</div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
