import db from '../db/index';

const SEED_EXERCISES = [
  // Ноги
  { name: 'Присед со штангой', muscle_group: 'legs', equipment: 'barbell', is_compound: true, instructions: 'Стойка на ширине плеч, штанга на трапециях. Присед до параллели, колени по направлению стоп.', is_custom: false },
  { name: 'Жим ногами', muscle_group: 'legs', equipment: 'machine', is_compound: true, instructions: 'Стопы на ширине плеч. Опускать платформу до угла 90° в коленях.', is_custom: false },
  { name: 'Выпады с гантелями', muscle_group: 'legs', equipment: 'dumbbell', is_compound: true, instructions: 'Шаг вперёд, колено задней ноги почти касается пола.', is_custom: false },
  { name: 'Разгибания ног', muscle_group: 'legs', equipment: 'machine', is_compound: false, instructions: 'Сидя в тренажёре, разгибать ноги до полного выпрямления.', is_custom: false },
  { name: 'Сгибания ног', muscle_group: 'legs', equipment: 'machine', is_compound: false, instructions: 'Лёжа в тренажёре, сгибать ноги к ягодицам.', is_custom: false },
  { name: 'Икры в тренажёре', muscle_group: 'legs', equipment: 'machine', is_compound: false, instructions: 'Подъём на носки с полной амплитудой.', is_custom: false },
  // Грудь
  { name: 'Жим лёжа', muscle_group: 'chest', equipment: 'barbell', is_compound: true, instructions: 'Хват чуть шире плеч. Опускать штангу к нижней части груди.', is_custom: false },
  { name: 'Жим гантелей лёжа', muscle_group: 'chest', equipment: 'dumbbell', is_compound: true, instructions: 'Гантели на уровне груди, жать вверх с лёгким сведением.', is_custom: false },
  { name: 'Жим на наклонной', muscle_group: 'chest', equipment: 'barbell', is_compound: true, instructions: 'Скамья 30-45°. Хват средний, опускать к верху груди.', is_custom: false },
  { name: 'Разводка гантелей', muscle_group: 'chest', equipment: 'dumbbell', is_compound: false, instructions: 'Руки слегка согнуты, разводить до ощущения растяжения.', is_custom: false },
  { name: 'Отжимания на брусьях', muscle_group: 'chest', equipment: 'bodyweight', is_compound: true, instructions: 'Наклон вперёд для акцента на грудь. Опускаться до угла 90°.', is_custom: false },
  // Спина
  { name: 'Становая тяга', muscle_group: 'back', equipment: 'barbell', is_compound: true, instructions: 'Хват на ширине плеч, спина прямая. Тянуть за счёт ног и спины.', is_custom: false },
  { name: 'Подтягивания', muscle_group: 'back', equipment: 'bodyweight', is_compound: true, instructions: 'Хват чуть шире плеч. Подтягиваться до подбородка выше перекладины.', is_custom: false },
  { name: 'Тяга штанги в наклоне', muscle_group: 'back', equipment: 'barbell', is_compound: true, instructions: 'Наклон ~45°, тянуть штангу к нижней части живота.', is_custom: false },
  { name: 'Тяга верхнего блока', muscle_group: 'back', equipment: 'cable', is_compound: true, instructions: 'Тянуть рукоять к верхней части груди, сводя лопатки.', is_custom: false },
  { name: 'Тяга нижнего блока', muscle_group: 'back', equipment: 'cable', is_compound: true, instructions: 'Сидя, тянуть рукоять к животу, спина прямая.', is_custom: false },
  { name: 'Гиперэкстензия', muscle_group: 'back', equipment: 'bodyweight', is_compound: false, instructions: 'Разгибание спины в тренажёре. Не переразгибаться.', is_custom: false },
  // Плечи
  { name: 'Жим стоя', muscle_group: 'shoulders', equipment: 'barbell', is_compound: true, instructions: 'Штанга на уровне ключиц, жать вверх до полного выпрямления.', is_custom: false },
  { name: 'Жим гантелей сидя', muscle_group: 'shoulders', equipment: 'dumbbell', is_compound: true, instructions: 'Сидя с опорой, жать гантели от плеч вверх.', is_custom: false },
  { name: 'Махи гантелями в стороны', muscle_group: 'shoulders', equipment: 'dumbbell', is_compound: false, instructions: 'Слегка согнутые руки, поднимать до уровня плеч.', is_custom: false },
  { name: 'Тяга штанги к подбородку', muscle_group: 'shoulders', equipment: 'barbell', is_compound: true, instructions: 'Узкий хват, тянуть вдоль тела до уровня ключиц.', is_custom: false },
  // Руки
  { name: 'Подъём штанги на бицепс', muscle_group: 'arms', equipment: 'barbell', is_compound: false, instructions: 'Стоя, локти прижаты. Сгибать руки до полного сокращения.', is_custom: false },
  { name: 'Подъём гантелей на бицепс', muscle_group: 'arms', equipment: 'dumbbell', is_compound: false, instructions: 'Поочерёдно или вместе, с супинацией.', is_custom: false },
  { name: 'Французский жим', muscle_group: 'arms', equipment: 'barbell', is_compound: false, instructions: 'Лёжа, опускать штангу ко лбу, разгибать за счёт трицепса.', is_custom: false },
  { name: 'Разгибания на блоке', muscle_group: 'arms', equipment: 'cable', is_compound: false, instructions: 'Стоя у блока, разгибать руки вниз, локти прижаты.', is_custom: false },
  { name: 'Молотки', muscle_group: 'arms', equipment: 'dumbbell', is_compound: false, instructions: 'Нейтральный хват, сгибания без супинации.', is_custom: false },
  // Кор
  { name: 'Планка', muscle_group: 'core', equipment: 'bodyweight', is_compound: false, instructions: 'Упор на локти и носки, тело прямое. Держать на время.', is_custom: false },
  { name: 'Скручивания', muscle_group: 'core', equipment: 'bodyweight', is_compound: false, instructions: 'Лёжа на спине, поднимать лопатки, не тянуть шею.', is_custom: false },
  { name: 'Подъём ног в висе', muscle_group: 'core', equipment: 'bodyweight', is_compound: false, instructions: 'В висе на перекладине, поднимать прямые ноги до 90°.', is_custom: false },
  { name: 'Русский твист', muscle_group: 'core', equipment: 'bodyweight', is_compound: false, instructions: 'Сидя с отклонённым корпусом, вращать торс с весом.', is_custom: false },
];

export async function seedExercises() {
  try {
    const count = await db.exercises.count();
    if (count === 0) {
      await db.exercises.bulkAdd(SEED_EXERCISES);
    }

  } catch (e) {
    console.error('[exercises.seedExercises]', e);
    throw e;
  }
}

export async function getExercises({ muscleGroup, equipment, search } = {}) {
  try {
    let collection = db.exercises.toCollection();
    if (muscleGroup) {
      collection = db.exercises.where('muscle_group').equals(muscleGroup);
    }
    let results = await collection.toArray();
    if (equipment) {
      results = results.filter(e => e.equipment === equipment);
    }
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(e => e.name.toLowerCase().includes(q));
    }
    return results.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  } catch (e) {
    console.error('[exercises.getExercises]', e);
    return [];
  }
}

export async function getExercise(id) {
  try {
    return db.exercises.get(id);

  } catch (e) {
    console.error('[exercises.getExercise]', e);
    return null;
  }
}

export async function addCustomExercise(data) {
  try {
    return db.exercises.add({ ...data, is_custom: true });

  } catch (e) {
    console.error('[exercises.addCustomExercise]', e);
    throw e;
  }
}

export const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Грудь', icon: '🫁' },
  { id: 'back', label: 'Спина', icon: '🔙' },
  { id: 'legs', label: 'Ноги', icon: '🦵' },
  { id: 'shoulders', label: 'Плечи', icon: '🤷' },
  { id: 'arms', label: 'Руки', icon: '💪' },
  { id: 'core', label: 'Кор', icon: '🎯' },
];

export const EQUIPMENT_TYPES = [
  { id: 'barbell', label: 'Штанга' },
  { id: 'dumbbell', label: 'Гантели' },
  { id: 'machine', label: 'Тренажёр' },
  { id: 'cable', label: 'Блок' },
  { id: 'bodyweight', label: 'Своё тело' },
];
