/**
 * AI Trainer — генерация программ, прогрессия весов, рекомендации.
 */
import { callAI } from '../ai/client';
import { getExercises, getExercise } from './exercises';
import { getWorkoutHistory, getLastWorkoutForExercise } from './workouts';
import { getTemplates } from './templates';
import { getSetting, setSetting } from '../db/helpers';

// ═══ Шаг прогрессии по типу оборудования ═══
const WEIGHT_STEP = { barbell: 2.5, dumbbell: 2, machine: 2.5, cable: 2.5, bodyweight: 0 };

// ═══ Парсинг JSON из AI-ответа ═══
function parseAIJson(text) {
  // Strip markdown fences
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  // Extract first { ... } block
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI_NO_JSON');
  cleaned = cleaned.slice(start, end + 1);
  return JSON.parse(cleaned);
}

// ═══ Генерация программы через AI ═══
export async function generateProgram({ goal, split, daysPerWeek, experience, equipment }) {
  // 1. Собираем контекст
  const exercises = await getExercises();
  const history = await getWorkoutHistory({ limit: 10 });
  const templates = await getTemplates();

  const exerciseList = exercises.map(e => `[${e.id}] ${e.name} (${e.muscle_group}, ${e.equipment})`).join('\n');

  const historyBlock = history.length > 0
    ? history.slice(0, 5).map(w =>
      `${w.date}: ${w.name} (${w.exercises?.map(e => e.name).join(', ')})`
    ).join('\n')
    : 'Нет истории тренировок';

  const templateBlock = templates.length > 0
    ? templates.map(t => `${t.name}: ${t.exercises?.map(e => e.name).join(', ')}`).join('\n')
    : '';

  // 2. Формируем промпт
  const systemPrompt = `Ты — опытный тренер по силовым тренировкам. Создай программу тренировок.
Ответ ТОЛЬКО в формате JSON, без пояснений.`;

  const prompt = `Создай программу тренировок на 8 недель.

Параметры:
- Цель: ${goal}
- Сплит: ${split}
- Дней в неделю: ${daysPerWeek}
- Опыт: ${experience}
- Оборудование: ${equipment}

Доступные упражнения (ID и название):
${exerciseList}

${historyBlock !== 'Нет истории тренировок' ? `История последних тренировок:\n${historyBlock}` : ''}
${templateBlock ? `Текущие шаблоны:\n${templateBlock}` : ''}

Верни JSON строго в формате:
{
  "schedule": [
    {"name": "Название дня", "type": "push|pull|legs|upper|lower|full|rest", "exercises": 5, "duration": "~50 мин", "exerciseIds": [1, 5, 11], "rest": false},
    {"name": "Отдых", "type": "rest", "rest": true, "duration": "Восстановление"}
  ],
  "exercisePlan": {
    "0": [{"exerciseId": 1, "name": "Жим лёжа", "targetSets": 4, "targetReps": "6-8"}],
    "1": []
  },
  "phase": "Набор (неделя 1/8)",
  "aiHint": "Рекомендация на текущую неделю"
}

Правила:
- schedule ровно 7 дней (Пн-Вс), rest-дней = 7 - ${daysPerWeek}
- exercisePlan ключи 0-6 (индекс дня). Для rest-дней — пустой массив.
- Используй ТОЛЬКО ID из списка доступных упражнений
- ${daysPerWeek} тренировочных дня, остальные — отдых
- 4-6 упражнений на тренировочный день
- Для "${goal}": ${goal.includes('сила') ? 'тяжёлые веса, 3-6 повторений, 4-5 подходов' : goal.includes('масса') ? 'средние веса, 6-12 повторений, 3-4 подхода' : 'умеренные веса, 8-15 повторений, 3 подхода'}`;

  // 3. Вызов AI
  const result = await callAI({
    prompt,
    systemPrompt,
    model: 'analysis',
    maxTokens: 2000,
    temperature: 0.4,
  });

  // 4. Парсинг с защитой
  let parsed;
  try {
    parsed = parseAIJson(result.content);
  } catch (e) {
    console.error('[aiTrainer] JSON parse error:', e, result.content);
    throw new Error('AI_PARSE_ERROR');
  }

  // 5. Валидация
  if (!parsed.schedule || !Array.isArray(parsed.schedule) || parsed.schedule.length !== 7) {
    throw new Error('AI_INVALID_SCHEDULE');
  }
  if (!parsed.exercisePlan || typeof parsed.exercisePlan !== 'object') {
    throw new Error('AI_INVALID_PLAN');
  }

  // 6. Сохраняем
  const program = {
    goal,
    split,
    daysPerWeek: String(daysPerWeek),
    experience,
    equipment,
    phase: parsed.phase || `Набор (неделя 1/8)`,
    totalWeeks: 8,
    currentWeek: 1,
    schedule: parsed.schedule,
    exercisePlan: parsed.exercisePlan,
    aiHint: parsed.aiHint || null,
    updatedAt: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
    createdAt: new Date().toISOString(),
  };

  await setSetting('ai_program', program);
  return program;
}

// ═══ Сессия на сегодня (progressive overload) ═══
export async function getTodaySession(program) {
  if (!program?.exercisePlan) return [];

  const todayIdx = new Date().getDay(); // 0=Sun
  const dayKey = String(todayIdx === 0 ? 6 : todayIdx - 1); // 0=Mon

  const dayPlan = program.exercisePlan[dayKey];
  if (!dayPlan || dayPlan.length === 0) return null; // rest day

  const session = [];
  for (const item of dayPlan) {
    const exerciseId = typeof item.exerciseId === 'string' ? parseInt(item.exerciseId, 10) : item.exerciseId;
    const [lastData, exerciseInfo] = await Promise.all([
      getLastWorkoutForExercise(exerciseId),
      getExercise(exerciseId),
    ]);

    const entry = {
      name: item.name,
      exerciseId,
      targetSets: item.targetSets,
      targetReps: item.targetReps,
      last: null,
      target: null,
      hint: null,
      hintType: null, // 'up' | 'keep' | 'down'
    };

    if (lastData && lastData.sets?.length > 0) {
      const workingSets = lastData.sets.filter(s => !s.is_warmup);
      if (workingSets.length > 0) {
        const bestSet = workingSets[0]; // first working set
        entry.last = `${bestSet.weight} кг × ${bestSet.reps}`;

        const eq = exerciseInfo?.equipment || 'barbell';
        const step = WEIGHT_STEP[eq] || 2.5;

        // Check if all prescribed sets were completed
        const completedSets = workingSets.length;
        const targetSets = item.targetSets || 3;
        const allDone = completedSets >= targetSets;

        // Check if last workout was recent (< 14 days)
        // lastData doesn't have date, but we can infer from workout
        if (eq === 'bodyweight') {
          // Bodyweight: add reps (no weight shown)
          entry.target = `× ${bestSet.reps + 1} повторений`;
          entry.hint = '+1 повторение';
          entry.hintType = 'up';
        } else if (allDone) {
          // All sets done → increase weight
          const newWeight = bestSet.weight + step;
          entry.target = `${newWeight} кг × ${bestSet.reps}`;
          entry.hint = `+${step} кг`;
          entry.hintType = 'up';
        } else {
          // Not all sets → keep weight, add reps
          entry.target = `${bestSet.weight} кг × ${bestSet.reps + 1}`;
          entry.hint = 'Закрепи подход';
          entry.hintType = 'keep';
        }
      }
    }

    if (!entry.target) {
      entry.target = item.targetReps;
      entry.hint = null;
    }

    session.push(entry);
  }

  return session;
}

// ═══ Прогрессия для HintsView ═══
export async function getProgressInsights() {
  const history = await getWorkoutHistory({ limit: 20 });
  if (history.length === 0) return [];

  // Собираем данные по всем упражнениям
  const exerciseData = {};
  for (const w of history) {
    if (w.type !== 'gym' || !w.exercises) continue;
    for (const ex of w.exercises) {
      const workingSets = (ex.sets || []).filter(s => !s.is_warmup);
      if (workingSets.length === 0) continue;
      const maxWeight = Math.max(...workingSets.map(s => s.weight || 0));
      if (maxWeight <= 0) continue;

      if (!exerciseData[ex.exercise_id]) {
        exerciseData[ex.exercise_id] = { name: ex.name, weights: [] };
      }
      exerciseData[ex.exercise_id].weights.push(maxWeight);
    }
  }

  // Фильтруем: только упражнения с 2+ записями
  const insights = [];
  for (const [id, data] of Object.entries(exerciseData)) {
    if (data.weights.length < 2) continue;

    // Последние 5 значений (от старого к новому)
    const recent = data.weights.slice(0, 5).reverse();
    const current = recent[recent.length - 1];
    const prev = recent[recent.length - 2];

    let direction = 'flat';
    let hint = 'Стабильный вес';

    if (current > prev) {
      direction = 'up';
      const eq = (await getExercise(parseInt(id)))?.equipment || 'barbell';
      const step = WEIGHT_STEP[eq] || 2.5;
      hint = `Готов к ${current + step} кг`;
    } else if (current < prev) {
      direction = 'down';
      hint = 'Восстановление: закрепи текущий вес';
    }

    insights.push({
      name: data.name,
      exerciseId: parseInt(id),
      currentWeight: current,
      weights: recent,
      direction,
      hint,
    });
  }

  // Сортируем: compound (обычно тяжелее) первыми
  return insights.sort((a, b) => b.currentWeight - a.currentWeight).slice(0, 8);
}

// ═══ Загрузить сохранённую программу ═══
export async function getSavedProgram() {
  return getSetting('ai_program');
}
