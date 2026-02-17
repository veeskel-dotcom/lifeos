/**
 * K8: Совет дня — контекстный совет на основе данных.
 */
import { getSetting, setSetting } from '../db/helpers';

const TIPS = [
  // Finance
  { category: 'finance', icon: '💰', text: 'Запишите все расходы сегодня — это первый шаг к контролю' },
  { category: 'finance', icon: '📊', text: 'Проверьте бюджет — до конца месяца осталось мало дней' },
  { category: 'finance', icon: '💸', text: 'Мелкие расходы незаметно съедают 30% бюджета' },
  { category: 'finance', icon: '🎯', text: 'Установите финансовую цель — так проще копить' },
  // Nutrition
  { category: 'nutrition', icon: '🥤', text: 'Не забывайте пить воду — цель 2 литра в день' },
  { category: 'nutrition', icon: '🥗', text: 'Добавьте овощи к каждому приёму пищи' },
  { category: 'nutrition', icon: '🍳', text: 'Завтрак с белком дает энергию до обеда' },
  { category: 'nutrition', icon: '⚡', text: 'Запишите обед сразу — потом сложнее вспомнить' },
  // Sport
  { category: 'sport', icon: '🏋️', text: 'Даже 20 минут движения лучше, чем ничего' },
  { category: 'sport', icon: '💪', text: 'Прогрессивная нагрузка: каждую неделю чуть больше' },
  { category: 'sport', icon: '🧘', text: 'День отдыха тоже часть тренировочного плана' },
  { category: 'sport', icon: '📈', text: 'Проверьте свой прогресс — замеры лучше весов' },
  // Tasks
  { category: 'tasks', icon: '✅', text: 'Начните день с самой сложной задачи' },
  { category: 'tasks', icon: '📋', text: 'Разбейте большую задачу на подзадачи по 25 минут' },
  { category: 'tasks', icon: '🎯', text: 'Планируйте максимум 3 главных дела в день' },
  { category: 'tasks', icon: '📥', text: 'Разберите Inbox — переместите задачи в проекты' },
  // Sleep
  { category: 'sleep', icon: '😴', text: 'Ложитесь в одно время — это важнее продолжительности' },
  { category: 'sleep', icon: '📵', text: 'Экраны за час до сна ухудшают засыпание' },
  // General
  { category: 'general', icon: '🔄', text: 'Привычки формируются за 66 дней — не сдавайтесь' },
  { category: 'general', icon: '📱', text: 'Настройте виджеты дашборда — уберите лишнее' },
  { category: 'general', icon: '🎉', text: 'Маленькие победы тоже считаются. Отметьте прогресс!' },
  { category: 'general', icon: '🧠', text: 'Спросите AI-ассистента — он знает все ваши данные' },
];

/**
 * Получить совет дня (меняется раз в день).
 */
export async function getDailyTip() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const cached = await getSetting('daily_tip_date');

    if (cached === today) {
      const tipIdx = parseInt(await getSetting('daily_tip_idx') || '0', 10);
      return TIPS[tipIdx % TIPS.length];
    }

    // Новый день — новый совет
    const idx = Math.floor(Math.random() * TIPS.length);
    await setSetting('daily_tip_date', today);
    await setSetting('daily_tip_idx', String(idx));
    return TIPS[idx];
  } catch {
    return TIPS[0];
  }
}
