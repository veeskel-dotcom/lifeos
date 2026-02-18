/**
 * widgetRegistry.js — Registry всех виджетов дашборда.
 * Определяет доступные виджеты, их размеры, цвета и порядок по умолчанию.
 */

export const WIDGET_COLORS = {
  budget:     (t) => t.accent,
  tasks:      (t) => t.green,
  nutrition:  (t) => t.orange,
  water:      (t) => t.teal || '#5AC8FA',
  sport:      (t) => t.red,
  weight:     (t) => t.purple,
  payments:   (t) => t.gray1,
  portfolio:  (t) => t.green,
  sleep:      (t) => t.purple,
  routines:   (t) => t.orange,
  goals:      (t) => t.yellow,
  documents:  (t) => t.gray1,
  anomalies:  (t) => t.red,
};

export const WIDGETS = [
  { id: 'budget',     name: 'Бюджет',     iconName: 'wallet',  module: 'finance',       sizes: ['wide'],          defaultSize: 'wide',  defaultOrder: 0  },
  { id: 'tasks',      name: 'Задачи',      iconName: 'task',    module: 'tasks',         sizes: ['small', 'wide'], defaultSize: 'small', defaultOrder: 1  },
  { id: 'nutrition',  name: 'Питание',     iconName: 'leaf',    module: 'nutrition',     sizes: ['small', 'wide'], defaultSize: 'small', defaultOrder: 2  },
  { id: 'water',      name: 'Вода',        iconName: 'drop',    module: 'nutrition',     sizes: ['small'],         defaultSize: 'small', defaultOrder: 3  },
  { id: 'sport',      name: 'Спорт',       iconName: 'gym',     module: 'sport',         sizes: ['small', 'wide'], defaultSize: 'small', defaultOrder: 4  },
  { id: 'weight',     name: 'Вес',         iconName: 'weight',  module: 'sport',         sizes: ['small', 'wide'], defaultSize: 'wide',  defaultOrder: 5  },
  { id: 'payments',   name: 'Платежи',     iconName: 'bell',    module: 'subscriptions', sizes: ['wide'],          defaultSize: 'wide',  defaultOrder: 6  },
  { id: 'portfolio',  name: 'Портфель',    iconName: 'trend',   module: 'invest',        sizes: ['small', 'wide'], defaultSize: 'wide',  defaultOrder: 7  },
  { id: 'sleep',      name: 'Сон',         iconName: 'moon',    module: null,            sizes: ['small', 'wide'], defaultSize: 'small', defaultOrder: 8  },
  { id: 'routines',   name: 'Привычки',    iconName: 'repeat',  module: null,            sizes: ['small', 'wide'], defaultSize: 'small', defaultOrder: 9  },
  { id: 'goals',      name: 'Цели',        iconName: 'target',  module: null,            sizes: ['small', 'wide'], defaultSize: 'small', defaultOrder: 10 },
  { id: 'documents',  name: 'Документы',   iconName: 'note',    module: 'documents',     sizes: ['small'],         defaultSize: 'small', defaultOrder: 11 },
  { id: 'anomalies',  name: 'Аномалии',    iconName: 'bell',    module: null,            sizes: ['small', 'wide'], defaultSize: 'small', defaultOrder: 12 },
];

/**
 * Генерирует дефолтный конфиг из WIDGETS.
 */
export function generateDefaultConfig() {
  return WIDGETS.map(w => ({
    id: w.id,
    visible: true,
    size: w.defaultSize,
    order: w.defaultOrder,
  }));
}

/**
 * Мержит сохранённый конфиг с актуальным реестром.
 * Если появились новые виджеты — добавляет их в конец.
 */
export function mergeConfig(saved) {
  if (!saved || !Array.isArray(saved)) return generateDefaultConfig();

  const validIds = new Set(WIDGETS.map(w => w.id));
  const filtered = saved.filter(s => validIds.has(s.id));
  const existing = new Set(filtered.map(s => s.id));
  const merged = [...filtered];

  for (const w of WIDGETS) {
    if (!existing.has(w.id)) {
      merged.push({
        id: w.id,
        visible: true,
        size: w.defaultSize,
        order: merged.length,
      });
    }
  }

  return merged;
}
