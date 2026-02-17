import db from '../db/index';
import { getSetting, setSetting } from '../db/helpers';

const MILESTONES = [
  { table: 'expenses', counts: [10, 50, 100, 500, 1000], emoji: '💸', noun: 'расход', nounFew: 'расхода', nounMany: 'расходов' },
  { table: 'workouts', counts: [5, 10, 25, 50, 100], emoji: '💪', noun: 'тренировка', nounFew: 'тренировки', nounMany: 'тренировок', filter: w => w.status === 'done' },
  { table: 'food_log', counts: [10, 50, 100, 500], emoji: '🍎', noun: 'приём пищи', nounFew: 'приёма пищи', nounMany: 'приёмов пищи' },
  { table: 'tasks', counts: [10, 50, 100, 500], emoji: '✅', noun: 'задача', nounFew: 'задачи', nounMany: 'задач', filter: t => t.status === 'done' },
  { table: 'notes', counts: [10, 50, 100], emoji: '📝', noun: 'заметка', nounFew: 'заметки', nounMany: 'заметок' },
];

function pluralize(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export async function checkMilestones() {
  try {
    const seen = JSON.parse((await getSetting('seen_milestones')) || '[]');
    const newMilestones = [];

    for (const m of MILESTONES) {
      let count;
      if (m.filter) {
        const all = await db[m.table].toArray();
        count = all.filter(m.filter).length;
      } else {
        count = await db[m.table].count();
      }

      for (const target of m.counts) {
        const key = `${m.table}_${target}`;
        if (count >= target && !seen.includes(key)) {
          newMilestones.push({
            key,
            emoji: m.emoji,
            message: `🎉 ${target} ${pluralize(target, m.noun, m.nounFew, m.nounMany)}!`,
            count: target,
          });
        }
      }
    }

    if (newMilestones.length > 0) {
      const updatedSeen = [...seen, ...newMilestones.map(m => m.key)];
      await setSetting('seen_milestones', JSON.stringify(updatedSeen));
    }

    return newMilestones;
  } catch {
    return [];
  }
}
