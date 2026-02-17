import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import { fmtMoney } from '../../utils/currency';
import { shareText } from '../../utils/share';

import SkeletonList from '../../components/SkeletonList';
import { generateWeeklyReport, generateCrossAnalysis, checkDataSufficiency, collectDailyRecords } from '../../services/crossAnalysis';
import { findCorrelations } from '../../services/correlations';

export default function WeeklyReport({ theme, onBack }) {
  const [report, setReport] = useState(null);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [sufficiency, setSufficiency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [correlations, setCorrelations] = useState(null);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      const r = await generateWeeklyReport();
      setReport(r);

      // Проверить достаточность данных
      const records = await collectDailyRecords(30);
      const suf = checkDataSufficiency(records);
      setSufficiency(suf);

      // Q2.2: Корреляции
      const corr = await findCorrelations(30);
      setCorrelations(corr);
    } catch (err) {
      console.warn('Weekly report error:', err);
    }
    setLoading(false);
  };

  const loadInsights = async () => {
    setInsightsLoading(true);
    try {
      const result = await generateCrossAnalysis(30);
      if (result.insights) {
        setInsights(result.insights);
      } else if (result.error) {
        setInsights(`⚠️ ${result.error}`);
      } else if (!result.ready) {
        setInsights(`📊 ${result.message}`);
      }
    } catch (err) {
      setInsights(`❌ ${err.message}`);
    }
    setInsightsLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-sm" style={{ color: theme.gray2 }}>Загрузка...</div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="px-4 pb-8">
      {/* Period + Share */}
      <div className="flex items-center justify-between mb-4">
        <div />
        <div className="text-center">
          <div className="text-xs font-semibold uppercase" style={{ color: theme.gray1 }}>
            📊 Неделя
          </div>
          <div className="text-sm font-medium mt-0.5" style={{ color: theme.text }}>
            {report.period}
          </div>
        </div>
        <button onClick={async () => {
          const lines = [
            `📊 LifeOS — Неделя ${report.period}`,
            `💰 Потрачено: ${fmtMoney(report.totalExpenses)}`,
            `✅ Задач выполнено: ${report.tasksCompleted || 0}`,
            `🏋️ Тренировок: ${report.workoutsCount || 0}`,
            `😴 Средний сон: ${report.avgSleep ? report.avgSleep.toFixed(1) + 'ч' : '—'}`,
            `💧 Средняя вода: ${report.avgWater ? report.avgWater + 'мл' : '—'}`,
          ];
          const r = await shareText('LifeOS — Недельный отчёт', lines.join('\n'));
          if (r.copied) void 0;
        }} className="text-lg" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>📤</button>
      </div>

      {/* Stats grid */}
      <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
        <StatRow theme={theme} icon="💰" label="Потрачено" value={fmtMoney(report.totalExpenses)} border />
        <StatRow theme={theme} icon="💵" label="Ср. в день"
          value={fmtMoney(report.avgDailyExpenses)} sub border />
        <StatRow theme={theme} icon="📋" label="Задач закрыто" value={`${report.tasksCompleted}`} border />
        <StatRow theme={theme} icon="🍎" label="Ср. калории" value={
          report.avgCalories > 0 ? `${report.avgCalories} ккал/день` : '—'
        } border />
        <StatRow theme={theme} icon="🏋️" label="Тренировки" value={`${report.workouts}`} border />
        <StatRow theme={theme} icon="💤" label="Ср. сон" value={
          report.avgSleep > 0 ? `${report.avgSleep}ч` : '—'
        } border />
        <StatRow theme={theme} icon="💧" label="Ср. вода" value={
          report.avgWater > 0 ? `${report.avgWater} мл` : '—'
        } border />
        {report.weightStart && report.weightEnd && (
          <StatRow theme={theme} icon="⚖️" label="Вес"
            value={`${report.weightStart} → ${report.weightEnd} кг`}
            valueColor={report.weightEnd < report.weightStart ? theme.green : (report.weightEnd > report.weightStart ? theme.red : theme.text)}
          />
        )}
      </Card>

      {/* AI Insights */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-semibold uppercase" style={{ color: theme.gray1 }}>
          AI-инсайты
        </span>
        {sufficiency && (
          <span className="text-[10px]" style={{ color: sufficiency.ready ? theme.green : theme.gray2 }}>
            {sufficiency.ready ? '✅ Данных достаточно' : '⏳ Мало данных'}
          </span>
        )}
      </div>

      {insights ? (
        <Card theme={theme} style={{ padding: 12, marginBottom: 12 }}>
          <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: theme.text }}>
            {insights}
          </div>
        </Card>
      ) : (
        <Card theme={theme} style={{ padding: 12, marginBottom: 12 }}>
          {sufficiency?.ready ? (
            <button
              onClick={loadInsights}
              disabled={insightsLoading}
              className="w-full text-sm font-medium py-2"
              style={{ color: theme.accent }}
            >
              {insightsLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-pulse">●</span> Анализирую данные...
                </span>
              ) : (
                '🔮 Запросить AI-анализ (~$0.005)'
              )}
            </button>
          ) : (
            <div className="text-center">
              <p className="text-xs" style={{ color: theme.gray2 }}>
                {sufficiency?.message || 'Недостаточно данных для анализа'}
              </p>
              {sufficiency?.filled && (
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {Object.entries(sufficiency.filled).map(([key, val]) => (
                    <span key={key} className="text-[10px] px-2 py-0.5 rounded"
                      style={{ background: theme.gray6, color: theme.gray1 }}>
                      {labelMap[key] || key}: {val} дн
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Q2.2: Корреляции */}
      {correlations && correlations.length > 0 && (
        <>
          <div className="text-xs font-semibold uppercase mb-2 px-1" style={{ color: theme.gray1 }}>
            🔗 Найденные паттерны
          </div>
          {correlations.map((c, i) => {
            const barColor = c.correlation > 0 ? theme.green : theme.red;
            const barWidth = Math.round(c.strength * 100);
            return (
              <Card key={i} theme={theme} style={{ padding: 12, marginBottom: 8 }}>
                <div className="flex items-start gap-2">
                  <span className="text-lg">{c.icon}</span>
                  <div className="flex-1">
                    <div className="text-xs font-medium" style={{ color: theme.text }}>{c.text}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: theme.gray5 }}>
                        <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: barColor }} />
                      </div>
                      <span className="text-[10px] tabular-nums font-medium" style={{ color: barColor }}>
                        {c.correlation > 0 ? '+' : ''}{(c.correlation * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── WeeklyReportCard — компактная карточка для дашборда ──
export function WeeklyReportCard({ theme, onOpen }) {
  const [report, setReport] = useState(null);

  useEffect(() => {
    // Показывать только в понедельник утром
    const day = new Date().getDay();
    if (day !== 1) return; // 1 = Monday

    generateWeeklyReport().then(setReport).catch(() => {});
  }, []);

  if (!report) return null;

  return (
    <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
      <div className="px-4 pt-3 pb-2">
        <div className="text-xs font-semibold uppercase" style={{ color: theme.gray1 }}>
          📊 Недельный отчёт
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: theme.gray2 }}>
          {report.period}
        </div>
      </div>

      <div className="px-4 pb-2 flex flex-wrap gap-x-4 gap-y-1">
        <MiniStat label="Расходы" value={fmtMoney(report.totalExpenses)} theme={theme} />
        <MiniStat label="Задачи" value={String(report.tasksCompleted)} theme={theme} />
        <MiniStat label="Тренировки" value={String(report.workouts)} theme={theme} />
        {report.avgSleep > 0 && <MiniStat label="Сон" value={`${report.avgSleep}ч`} theme={theme} />}
      </div>

      {onOpen && (
        <div className="border-t px-4 py-2" style={{ borderColor: theme.gray5 }}>
          <button onClick={onOpen} className="text-xs font-medium" style={{ color: theme.accent }}>
            Подробнее →
          </button>
        </div>
      )}
    </Card>
  );
}

// ── Sub-components ──
function StatRow({ theme, icon, label, value, valueColor, sub, border }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5"
      style={{ borderBottom: border ? `0.5px solid ${theme.gray5}` : 'none' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">{icon}</span>
        <span className={`text-sm ${sub ? 'pl-2' : ''}`} style={{ color: theme.gray1 }}>{label}</span>
      </div>
      <span className="text-sm font-medium" style={{ color: valueColor || theme.text }}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value, theme }) {
  return (
    <div>
      <div className="text-[10px]" style={{ color: theme.gray2 }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color: theme.text }}>{value}</div>
    </div>
  );
}

const labelMap = {
  sleep: '💤 Сон',
  calories: '🍎 Калории',
  workouts: '🏋️ Тренировки',
  expenses: '💰 Расходы',
  mood: '😊 Настроение',
  water: '💧 Вода',
};
