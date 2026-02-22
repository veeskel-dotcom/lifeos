/**
 * Derived Memories — автоматические паттерны из данных пользователя.
 * Запускается раз в неделю, анализирует 30 дней, сохраняет как source: 'derived'.
 */

import { collectDailyRecords } from './crossAnalysis';
import { addMemory } from './aiMemory';
import db from '../db/index';

export async function generateDerivedMemories() {
  const records = await collectDailyRecords(30);
  if (records.length < 7) return; // мало данных

  // Очистить старые derived-воспоминания
  const allMem = await db.ai_memory.toArray();
  const oldDerived = allMem.filter(m => m.source === 'derived');
  if (oldDerived.length > 0) {
    await db.ai_memory.bulkDelete(oldDerived.map(m => m.id));
  }

  const insights = [];

  // Сон
  const sleepDays = records.filter(r => r.sleep_hours > 0);
  if (sleepDays.length >= 5) {
    const avg = (sleepDays.reduce((s, r) => s + r.sleep_hours, 0) / sleepDays.length).toFixed(1);
    insights.push(['health', `Средний сон за месяц: ${avg}ч (из ${sleepDays.length} дней)`]);
  }

  // Тренировки
  const workoutDays = records.filter(r => r.workout);
  if (workoutDays.length > 0) {
    const perWeek = (workoutDays.length / 4.3).toFixed(1);
    insights.push(['lifestyle', `Тренируется ~${perWeek} раз/нед`]);
  }

  // Расходы
  const spendDays = records.filter(r => r.expenses > 0);
  if (spendDays.length >= 5) {
    const avg = Math.round(spendDays.reduce((s, r) => s + r.expenses, 0) / spendDays.length);
    insights.push(['finance', `Средние расходы: ~${avg}₸/день`]);
  }

  // Калории
  const calDays = records.filter(r => r.calories > 0);
  if (calDays.length >= 5) {
    const avg = Math.round(calDays.reduce((s, r) => s + r.calories, 0) / calDays.length);
    insights.push(['health', `Средние калории: ~${avg} ккал/день`]);
  }

  // Вес тренд
  const weightDays = records.filter(r => r.weight_kg > 0);
  if (weightDays.length >= 2) {
    const first = weightDays[0].weight_kg;
    const last = weightDays[weightDays.length - 1].weight_kg;
    const diff = (last - first).toFixed(1);
    insights.push(['health', `Вес за месяц: ${diff > 0 ? '+' : ''}${diff} кг (${first}→${last})`]);
  }

  // Вода
  const waterDays = records.filter(r => r.water_ml > 0);
  if (waterDays.length >= 5) {
    const avg = Math.round(waterDays.reduce((s, r) => s + r.water_ml, 0) / waterDays.length);
    insights.push(['health', `Средняя вода: ~${avg} мл/день`]);
  }

  // Настроение
  const moodDays = records.filter(r => r.mood > 0);
  if (moodDays.length >= 5) {
    const avg = (moodDays.reduce((s, r) => s + r.mood, 0) / moodDays.length).toFixed(1);
    insights.push(['lifestyle', `Среднее настроение: ${avg}/10`]);
  }

  // Сохранить
  for (const [cat, fact] of insights) {
    await addMemory(cat, fact, 'derived');
  }
}
