import { useState, useEffect } from 'react';
import { useLiveQuery } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import { getMonthlyTonnage, getExerciseProgress, calculate1RM, getFrequencyByDay } from '../../services/workouts';
import { getExercises } from '../../services/exercises';
import { getWeights, getTrend, getGoal } from '../../services/bodyweight';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import MuscleMap from './MuscleMap';

const PERIODS = [
  { id: 1, label: '1М' },
  { id: 3, label: '3М' },
  { id: 6, label: '6М' },
  { id: 12, label: '1Г' },
];

const MONTHS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Мая', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

export default function SportProgress({ theme, onBack, onNavigate }) {
  const [period, setPeriod] = useState(3);
  const [tonnageData, setTonnageData] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [exerciseData, setExerciseData] = useState([]);
  const [weightData, setWeightData] = useState([]);
  const [weightGoal, setWeightGoal] = useState(null);
  const [frequencyData, setFrequencyData] = useState([]);

  const exercises = useLiveQuery(() => getExercises().catch(() => []));

  useEffect(() => {
    getMonthlyTonnage(period).then(data => {
      setTonnageData(data.map(d => ({
        month: MONTHS_SHORT[parseInt(d.month.slice(5)) - 1],
        tonnage: d.tonnage,
      })));
    });
  }, [period]);

  useEffect(() => {
    if (!selectedExercise) return;
    getExerciseProgress(selectedExercise, period).then(setExerciseData);
  }, [selectedExercise, period]);

  useEffect(() => {
    getWeights(period * 30).then(setWeightData);
    getGoal().then(g => setWeightGoal(g));
  }, [period]);

  // D2.2: частота по дням недели
  useEffect(() => {
    getFrequencyByDay(30).then(setFrequencyData).catch(() => {});
  }, []);

  const chartColors = {
    bar: theme.accent,
    line: theme.accent,
    grid: theme.gray5,
    text: theme.gray2,
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Прогресс" onBack={onBack} left="Спорт" theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {/* Период */}
        <div className="flex gap-2 justify-center">
          {PERIODS.map(p => (
            <button
              key={p.id} onClick={() => setPeriod(p.id)}
              style={{ padding: '6px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: period === p.id ? theme.accent : theme.gray5, color: period === p.id ? '#fff' : theme.text }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* D2.1: Мышечная карта */}
        <MuscleMap theme={theme} />

        {/* D2.2: Частота по дням недели */}
        <Card theme={theme}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1, textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: 12 }}>
            Когда тренируюсь
          </div>
          {frequencyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={frequencyData}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: chartColors.text }} axisLine={false} tickLine={false} width={20} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: theme.card, border: 'none', borderRadius: 8, fontSize: 12, color: theme.text }}
                  formatter={v => [`${v}`, 'Тренировок']}
                />
                <Bar
                  dataKey="count"
                  radius={[4, 4, 0, 0]}
                  fill={theme.accent}
                  /* Дни без тренировок — серые */
                  shape={(props) => {
                    const { x, y, width, height, payload } = props;
                    const fill = payload.count > 0 ? theme.accent : theme.gray5;
                    const barH = payload.count > 0 ? height : 4;
                    const barY = payload.count > 0 ? y : y + height - 4;
                    return <rect x={x} y={barY} width={width} height={barH} rx={4} fill={fill} />;
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ fontSize: 14, textAlign: 'center', padding: '24px 0', color: theme.gray2 }}>Нет данных</p>
          )}
        </Card>

        {/* Навигация: PR + Обмеры */}
        <div className="flex gap-2">
          <button
            onClick={() => onNavigate?.('prList')}
            style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, background: theme.card, color: theme.text, border: `0.5px solid ${theme.gray5}` }}
          >
            🏆 Рекорды
          </button>
          <button
            onClick={() => onNavigate?.('measurements')}
            style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, background: theme.card, color: theme.text, border: `0.5px solid ${theme.gray5}` }}
          >
            📐 Обмеры
          </button>
        </div>

        {/* Тоннаж */}
        <Card theme={theme}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1, textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: 12 }}>
            Тоннаж по месяцам
          </div>
          {tonnageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={tonnageData}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: chartColors.text }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: theme.card, border: 'none', borderRadius: 8, fontSize: 12, color: theme.text }}
                  formatter={v => [`${v.toLocaleString('ru-RU')} кг`, 'Тоннаж']}
                />
                <Bar dataKey="tonnage" fill={chartColors.bar} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ padding: '32px 0', color: theme.gray2, fontSize: 14, textAlign: 'center' }}>Нет данных</p>
          )}
        </Card>

        {/* Прогресс упражнения */}
        <Card theme={theme}>
          <div style={{ marginBottom: 8, color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
            Прогресс упражнения
          </div>
          <select
            value={selectedExercise || ''}
            onChange={e => setSelectedExercise(Number(e.target.value) || null)}
            style={{ width: '100%', borderRadius: 12, padding: '10px 16px', outline: 'none', appearance: 'none', marginBottom: 12, fontSize: 14, background: theme.gray6, color: theme.text, border: 'none' }}
          >
            <option value="">Выберите упражнение</option>
            {exercises?.filter(e => e.is_compound).map(ex => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>

          {selectedExercise && exerciseData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={exerciseData}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: chartColors.text }}
                  axisLine={false} tickLine={false}
                  tickFormatter={d => d.slice(5)}
                />
                <YAxis tick={{ fontSize: 10, fill: chartColors.text }} axisLine={false} tickLine={false} width={35} />
                <Tooltip
                  contentStyle={{ background: theme.card, border: 'none', borderRadius: 8, fontSize: 12, color: theme.text }}
                  formatter={(v, name) => [
                    `${v} кг`,
                    name === 'maxWeight' ? 'Макс вес' : '1RM (Epley)',
                  ]}
                />
                <Line type="monotone" dataKey="maxWeight" stroke={chartColors.line} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="estimated1RM" stroke={theme.green} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          ) : selectedExercise ? (
            <p style={{ padding: '32px 0', color: theme.gray2, fontSize: 14, textAlign: 'center' }}>Нет данных за этот период</p>
          ) : null}
        </Card>

        {/* Вес тела */}
        <Card theme={theme}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1, textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: 12 }}>
            Вес тела
          </div>
          {weightData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={weightData.map(d => ({ date: d.date, weight: d.weight }))}>
                <XAxis
                  dataKey="date" tick={{ fontSize: 10, fill: chartColors.text }}
                  axisLine={false} tickLine={false}
                  tickFormatter={d => d.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: chartColors.text }}
                  axisLine={false} tickLine={false}
                  width={35} domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{ background: theme.card, border: 'none', borderRadius: 8, fontSize: 12, color: theme.text }}
                  formatter={v => [`${v} кг`, 'Вес']}
                />
                {weightGoal && <ReferenceLine y={weightGoal} stroke={theme.green} strokeDasharray="4 4" label={{ value: `Цель ${weightGoal}`, fontSize: 10, fill: theme.green }} />}
                <Line type="monotone" dataKey="weight" stroke={chartColors.line} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ padding: '32px 0', color: theme.gray2, fontSize: 14, textAlign: 'center' }}>
              Нужно минимум 2 записи веса
            </p>
          )}
          {weightData.length >= 2 && (() => {
            const t = getTrend(weightData);
            return t !== null ? (
              <div style={{ marginTop: 4, color: t < 0 ? theme.green : t > 0 ? theme.orange : theme.gray2, fontSize: 12, textAlign: 'center' }}>
                Тренд: {t > 0 ? '+' : ''}{t} кг/нед
              </div>
            ) : null;
          })()}
        </Card>
      </div>
    </div>
  );
}
