import { useState, useEffect } from 'react';
import { useLiveQuery } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import { addWeight, getLatest, getTrend, getGoal, getWeights, setWeightGoal, getWeightGoal, getWeightPrediction } from '../../services/bodyweight';
import FormInput from '../../components/FormInput';
import DatePicker from '../../components/DatePicker';
import Ic from '../../components/Icon';
import EmptyState from '../../components/EmptyState';
import PullToRefresh from '../../components/PullToRefresh';


function MiniChart({ data, goal, theme }) {
  if (!data || data.length < 2) return null;
  const weights = data.map(d => d.weight);
  const min = Math.min(...weights, goal || Infinity) - 1;
  const max = Math.max(...weights) + 1;
  const range = max - min || 1;
  const w = 300;
  const h = 100;
  const step = w / (data.length - 1);

  const points = data.map((d, i) => `${i * step},${h - ((d.weight - min) / range) * h}`).join(' ');
  const goalY = goal ? h - ((goal - min) / range) * h : null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 120 }}>
      {goalY != null && goalY >= 0 && goalY <= h && (
        <line x1="0" y1={goalY} x2={w} y2={goalY} stroke={theme.green} strokeWidth="1" strokeDasharray="4 4" />
      )}
      <polyline points={points} fill="none" stroke={theme.accent} strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={i * step} cy={h - ((d.weight - min) / range) * h} r="3" fill={theme.accent} />
      ))}
    </svg>
  );
}

export default function BodyWeightLog({ theme, onBack }) {
  const [weight, setWeight] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [goal, setGoal] = useState(null);
  const [goalInput, setGoalInput] = useState('');
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [prediction, setPrediction] = useState(null);

  const entries = useLiveQuery(
    () => getWeights(60).catch(() => [])
  );

  const latest = entries?.length ? entries[entries.length - 1] : null;
  const trend = entries ? getTrend(entries) : null;

  const loadGoalAndPrediction = async () => {
    try {
      const g = await getWeightGoal();
      if (g) {
        setGoal(g);
        setGoalInput(String(g));
      }
      const p = await getWeightPrediction();
      setPrediction(p);
    } catch { /* тихая ошибка */ }
  };

  useEffect(() => {
    loadGoalAndPrediction();
  }, [entries]);

  const handleSave = async () => {
    if (!weight) return;
    await addWeight(date, parseFloat(weight));
    setWeight('');
  };

  const handleSaveGoal = async () => {
    const kg = parseFloat(goalInput);
    if (!kg || kg <= 0) return;
    await setWeightGoal(kg);
    setGoal(kg);
    setShowGoalForm(false);
    loadGoalAndPrediction();
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Вес тела" onBack={onBack} left="Спорт" theme={theme} />

      <PullToRefresh onRefresh={async () => { await new Promise(r => setTimeout(r, 400)); }} theme={theme}>
      <div className="px-4 pb-24 space-y-4">
        {/* Текущий вес */}
        {entries && entries.length === 0 ? (
          <EmptyState
            icon="⚖️" title="Нет записей"
            subtitle="Начните отслеживать вес"
            tip="Записывайте вес утром натощак для точности"
            theme={theme}
          />
        ) : (
          <Card theme={theme}>
            <div style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 12, color: theme.gray1 }}>Текущий вес</div>
              <div style={{ color: theme.text, fontSize: 36, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                {latest ? `${latest.weight}` : '—'} <span style={{ color: theme.gray2, fontSize: 18, fontWeight: 400 }}>кг</span>
              </div>
              {goal && (
                <div style={{ color: theme.gray2, fontSize: 14, marginTop: 4 }}>
                  Цель: {goal} кг
                  {latest && ` · ${latest.weight > goal ? 'осталось' : 'набрать'} ${Math.abs(latest.weight - goal).toFixed(1)} кг`}
                </div>
              )}
              {trend !== null && (
                <div style={{ color: trend < 0 ? theme.green : trend > 0 ? theme.orange : theme.gray2, fontSize: 14, marginTop: 4 }}>
                  Тренд: {trend > 0 ? '+' : ''}{trend} кг/нед
                </div>
              )}
              {/* D3.3: Прогноз */}
              {prediction?.message && (
                <div style={{ display: 'inline-block', padding: '6px 12px', background: theme.accent + '15', color: theme.accent, fontSize: 12, marginTop: 8, paddingLeft: 12, paddingRight: 12, borderRadius: 8 }}>
                  <Ic name="chart" color={theme.accent} size={14} r={3} raw /> {prediction.message}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Stats row: от начала / цель / осталось */}
        {latest && goal && entries?.length >= 2 && (() => {
          const first = entries[0];
          const fromStart = (latest.weight - first.weight).toFixed(1);
          const remaining = Math.abs(latest.weight - goal).toFixed(1);
          return (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: theme.gray2, fontSize: 11 }}>с начала</div>
                <div style={{ color: parseFloat(fromStart) <= 0 ? theme.green : theme.red, fontSize: 14, fontWeight: 600 }}>
                  {parseFloat(fromStart) > 0 ? '+' : ''}{fromStart} кг
                </div>
              </div>
              <div style={{ width: 1, background: theme.gray5 }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: theme.gray2, fontSize: 11 }}>цель</div>
                <div style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>{goal} кг</div>
              </div>
              <div style={{ width: 1, background: theme.gray5 }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: theme.gray2, fontSize: 11 }}>осталось</div>
                <div style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>{remaining} кг</div>
              </div>
            </div>
          );
        })()}

        {/* Цель */}
        {!goal && !showGoalForm && (
          <button
            onClick={() => setShowGoalForm(true)}
            style={{ width: '100%', padding: 12, borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer', background: theme.card, color: theme.accent, border: `1px solid ${theme.accent}30` }}
          >
            <Ic name="target" color={theme.accent} size={16} r={4} raw /> Установить цель
          </button>
        )}
        {showGoalForm && (
          <Card theme={theme}>
            <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: 8 }}>
              Цель по весу
            </div>
            <div className="flex gap-2">
              <div className="flex items-center flex-1 px-4" style={{ background: theme.gray6, borderRadius: 12, paddingTop: 12, paddingBottom: 12 }}>
                <FormInput type="number" inputMode="decimal" value={goalInput} onChange={setGoalInput} placeholder="75.0" autoFocus theme={theme} />
                <span style={{ color: theme.gray2, fontSize: 14, marginLeft: 4 }}>кг</span>
              </div>
              <button
                onClick={handleSaveGoal}
                className="px-5" style={{ paddingTop: 12, paddingBottom: 12, borderRadius: 12, fontWeight: 600, fontSize: 14, color: '#fff', background: theme.accent }}
              >
                ✓
              </button>
            </div>
          </Card>
        )}
        {goal && !showGoalForm && (
          <button
            onClick={() => setShowGoalForm(true)}
            className="py-1.5 self-start" style={{ fontSize: 12, paddingLeft: 12, paddingRight: 12, borderRadius: 8, color: theme.gray2 }}
          >
            <Ic name="edit" color={theme.gray2} size={14} r={3} raw /> Изменить цель ({goal} кг)
          </button>
        )}

        {/* График */}
        {entries && entries.length >= 2 && (
          <Card theme={theme}>
            <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: 8 }}>
              Прогресс
            </div>
            <MiniChart data={entries} goal={goal} theme={theme} />
          </Card>
        )}

        {/* Ввод */}
        <Card theme={theme}>
          <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: 8 }}>
            Записать вес
          </div>
          <div className="flex gap-2">
            <div className="flex items-center flex-1 px-4" style={{ background: theme.gray6, borderRadius: 12, paddingTop: 12, paddingBottom: 12 }}>
              <FormInput type="number" inputMode="decimal" value={weight} onChange={setWeight} theme={theme} />
              <span style={{ color: theme.gray2, fontSize: 14, marginLeft: 4 }}>кг</span>
            </div>
            <div onClick={() => setShowDatePicker(true)}
              className="cursor-pointer" style={{ borderRadius: 12, paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 14, flexShrink: 0, background: theme.gray6, color: date ? theme.text : theme.gray3, minWidth: 130 }}>
              {date || 'Дата'}
            </div>
          </div>
          <button
            onClick={handleSave} disabled={!weight}
            style={{ width: '100%', padding: 12, borderRadius: 12, fontWeight: 600, fontSize: 14, marginTop: 12, border: 'none', cursor: 'pointer', background: weight ? theme.green : theme.gray4, color: '#fff', opacity: weight ? 1 : 0.6 }}
          >
            <Ic name="check" color="#fff" size={16} r={4} raw /> Сохранить
          </button>
        </Card>

        {/* История */}
        {entries && entries.length > 0 && (() => {
          const reversed = [...entries].reverse().slice(0, 14);
          return (
            <div>
              <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em', paddingTop: 8, paddingBottom: 8 }}>
                Записи
              </div>
              <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
                {reversed.map((e, i) => {
                  const prev = reversed[i + 1];
                  const diff = prev ? (e.weight - prev.weight).toFixed(1) : null;
                  return (
                    <div key={e.id}>
                      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: i < reversed.length - 1 ? '0.5px solid ' + theme.gray5 : 'none' }}>
                        <span style={{ color: theme.gray2, fontSize: 13, width: 56 }}>
                          {e.date.slice(8, 10)}/{e.date.slice(5, 7)}
                        </span>
                        <span style={{ flex: 1, color: theme.text, fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {e.weight} кг
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: diff === null ? theme.gray2
                            : parseFloat(diff) < 0 ? theme.green
                            : parseFloat(diff) > 0 ? theme.red
                            : theme.gray2,
                          minWidth: 48, textAlign: 'right' }}>
                          {diff === null ? '—' : `${parseFloat(diff) > 0 ? '+' : ''}${diff} кг`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>
          );
        })()}
      </div>
      </PullToRefresh>

      <DatePicker open={showDatePicker} onClose={() => setShowDatePicker(false)} value={date} onChange={setDate} theme={theme} />
    </div>
  );
}
