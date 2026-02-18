import { useState, useCallback } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import Ic from '../../components/Icon';

const STEPS = [
  { q: 'Рост и вес?', field: 'body', placeholder: '180 см, 78 кг' },
  { q: 'Возраст?', field: 'age', placeholder: '32 года' },
  { q: 'Активность?', field: 'activity', placeholder: '3 тренировки в неделю, офис' },
  { q: 'Цель?', field: 'goal', placeholder: 'Похудеть, цель 75 кг' },
];

function BotBubble({ children, theme }) {
  return (
    <div className="flex gap-2 mb-3">
      <Ic name="bot" color={theme.purple} size={28} r={8} />
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-5"
        style={{ background: theme.card, boxShadow: theme.shadow, color: theme.text }}>
        {children}
      </div>
    </div>
  );
}

function UserBubble({ text, theme }) {
  return (
    <div className="flex justify-end mb-3">
      <div className="max-w-[75%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm text-white"
        style={{ background: theme.accent }}>
        {text}
      </div>
    </div>
  );
}

export default function AICalories({ onClose, onApply, theme }) {
  const [answers, setAnswers] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    const step = STEPS[currentStep];
    if (!step) return;

    const newAnswers = { ...answers, [step.field]: input.trim() };
    setAnswers(newAnswers);
    setInput('');

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Calculate result (simplified Mifflin-St Jeor)
      const heightMatch = newAnswers.body?.match(/(\d+)\s*см/);
      const weightMatch = newAnswers.body?.match(/(\d+[\.,]?\d*)\s*кг/);
      const ageMatch = newAnswers.age?.match(/(\d+)/);
      const h = heightMatch ? parseFloat(heightMatch[1]) : 175;
      const w = weightMatch ? parseFloat(weightMatch[1].replace(',', '.')) : 78;
      const age = ageMatch ? parseInt(ageMatch[1]) : 30;

      const bmr = Math.round(10 * w + 6.25 * h - 5 * age + 5);
      const activityMul = newAnswers.activity?.includes('3') ? 1.55 : newAnswers.activity?.includes('5') ? 1.725 : 1.375;
      const tdee = Math.round(bmr * activityMul);
      const isLoss = newAnswers.goal?.match(/похуд|сброс|сниз/i);
      const target = isLoss ? Math.round(tdee * 0.8) : Math.round(tdee * 1.1);

      setResult({
        bmr, tdee, target,
        protein: Math.round(w * 1.6),
        fat: Math.round(target * 0.3 / 9),
        carbs: Math.round((target - w * 1.6 * 4 - target * 0.3) / 4),
        deficit: isLoss ? tdee - target : null,
        goalWeight: newAnswers.goal?.match(/(\d+)\s*кг/)?.[1],
      });
    }
  }, [input, currentStep, answers]);

  const handleApply = useCallback(async () => {
    if (!result) return;
    const db = (await import('../../db')).default;
    await db.settings.put({ key: 'daily_calories', value: result.target });
    await db.settings.put({ key: 'daily_protein', value: result.protein });
    onApply?.();
    onClose?.();
  }, [result, onApply, onClose]);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Настройка питания" onBack={onClose} theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Intro */}
        <BotBubble theme={theme}>
          Привет! Давай рассчитаю твою дневную норму калорий. Мне нужно знать несколько вещей:
        </BotBubble>

        {/* Answered steps */}
        {STEPS.slice(0, currentStep + (result ? 1 : 0)).map((step, i) => (
          <div key={step.field}>
            <BotBubble theme={theme}>{step.q}</BotBubble>
            {answers[step.field] && <UserBubble text={answers[step.field]} theme={theme} />}
          </div>
        ))}

        {/* Current question (not yet answered) */}
        {!result && currentStep < STEPS.length && !answers[STEPS[currentStep].field] && (
          <BotBubble theme={theme}>{STEPS[currentStep].q}</BotBubble>
        )}

        {/* Result */}
        {result && (
          <>
            <BotBubble theme={theme}>
              <div className="font-semibold mb-2">Готово! Вот твой план:</div>
              <div className="rounded-xl p-3 mb-2" style={{ background: theme.purple + '08' }}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm" style={{ color: theme.gray1 }}>Базовый обмен (BMR)</span>
                  <span className="text-sm font-semibold">{result.bmr} ккал</span>
                </div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm" style={{ color: theme.gray1 }}>С учётом активности</span>
                  <span className="text-sm font-semibold">{result.tdee} ккал</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t" style={{ borderColor: theme.purple + '20' }}>
                  <span className="text-sm font-semibold" style={{ color: theme.purple }}>
                    {result.deficit ? 'Для похудения (−20%)' : 'Для набора (+10%)'}
                  </span>
                  <span className="text-base font-bold" style={{ color: theme.purple }}>{result.target} ккал</span>
                </div>
              </div>
              <div className="space-y-1">
                {[
                  { label: 'Белки', val: `${result.protein}г`, pct: Math.round(result.protein * 4 / result.target * 100) },
                  { label: 'Жиры', val: `${result.fat}г`, pct: Math.round(result.fat * 9 / result.target * 100) },
                  { label: 'Углеводы', val: `${result.carbs}г`, pct: Math.round(result.carbs * 4 / result.target * 100) },
                ].map(m => (
                  <div key={m.label} className="flex justify-between text-sm">
                    <span style={{ color: theme.gray1 }}>{m.label}</span>
                    <span className="font-semibold">{m.val} ({m.pct}%)</span>
                  </div>
                ))}
              </div>
              {result.deficit && result.goalWeight && (
                <div className="text-xs mt-2" style={{ color: theme.gray2 }}>
                  При −{result.deficit} ккал/день достигнешь {result.goalWeight} кг за ~{Math.round(result.deficit > 0 ? 7700 / result.deficit * 3.5 : 90)} дней
                </div>
              )}
            </BotBubble>

            <div className="flex gap-2 mt-2 pl-9">
              <button className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
                style={{ background: theme.green }} onClick={handleApply}>
                Принять план
              </button>
              <button className="py-3 px-4 rounded-xl text-sm"
                style={{ background: theme.gray5, color: theme.gray1 }}
                onClick={() => { setResult(null); setAnswers({}); setCurrentStep(0); }}>
                Изменить
              </button>
            </div>
          </>
        )}
      </div>

      {/* Input bar */}
      {!result && (
        <div className="sticky bottom-0 px-4 py-3 border-t" style={{ background: theme.bg, borderColor: theme.gray5 }}>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={STEPS[currentStep]?.placeholder || 'Ваш ответ...'}
              className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
              style={{ background: theme.card, color: theme.text }}
              autoFocus
            />
            <button className="px-4 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: input.trim() ? theme.accent : theme.gray3 }}
              onClick={handleSend} disabled={!input.trim()}>
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
