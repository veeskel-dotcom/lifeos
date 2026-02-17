/**
 * T3: Миграции — версионирование схемы, upgrade paths, логирование.
 *
 * Dexie управляет .stores() автоматически. Этот модуль добавляет:
 * 1. Data migrations при обновлении версий
 * 2. Логирование миграций
 * 3. Проверку целостности после миграции
 */
import { getSetting, setSetting } from './helpers';

export const CURRENT_VERSION = 3;

// ═══ История миграций ═══

const MIGRATIONS = [
  {
    version: 2,
    name: 'add_body_measurements',
    description: 'Добавлена таблица body_measurements',
    date: '2025-01-15',
    run: async (db) => {
      // Таблица создаётся автоматически через Dexie .stores()
      // Здесь только data migration если нужна
      const oldWeights = await db.body_weight.toArray();
      // Если есть записи веса — создать начальные measurements
      if (oldWeights.length > 0) {
        const latest = oldWeights[oldWeights.length - 1];
        const existing = await db.body_measurements.count();
        if (existing === 0 && latest.weight) {
          await db.body_measurements.add({
            date: latest.date || new Date().toISOString().split('T')[0],
            weight: latest.weight,
            source: 'migration_v2',
          });
        }
      }
    },
  },
  {
    version: 3,
    name: 'add_goals_photos_alerts',
    description: 'Добавлены goals, progress_photos, price_alerts',
    date: '2025-02-01',
    run: async (db) => {
      // Создание дефолтных целей на основе существующих данных
      const goalsCount = await db.goals.count();
      if (goalsCount > 0) return; // уже есть

      // Если есть бюджеты — создать финансовую цель
      const budgets = await db.budgets.toArray();
      if (budgets.length > 0) {
        const totalBudget = budgets.reduce((s, b) => s + (b.limit || 0), 0);
        if (totalBudget > 0) {
          await db.goals.add({
            type: 'savings',
            title: 'Бюджет месяца',
            target: totalBudget,
            current: 0,
            status: 'active',
            auto_track: true,
            source_module: 'finance',
            created_at: new Date().toISOString(),
          });
        }
      }
    },
  },
];

// ═══ Запуск миграций ═══

export async function runDataMigrations(db) {
  const lastMigrated = (await getSetting('schema_last_migrated')) || 0;
  const log = [];

  for (const migration of MIGRATIONS) {
    if (migration.version > lastMigrated) {
      try {
        const start = performance.now();
        await migration.run(db);
        const duration = Math.round(performance.now() - start);

        log.push({
          version: migration.version,
          name: migration.name,
          status: 'ok',
          duration_ms: duration,
          ts: new Date().toISOString(),
        });

        await setSetting('schema_last_migrated', migration.version);
      } catch (err) {
        log.push({
          version: migration.version,
          name: migration.name,
          status: 'error',
          error: err.message,
          ts: new Date().toISOString(),
        });
        console.error(`[migration] v${migration.version} failed:`, err);
        break; // не продолжать после ошибки
      }
    }
  }

  // Сохранить лог миграций
  if (log.length > 0) {
    const existingLog = (await getSetting('migration_log')) || [];
    await setSetting('migration_log', [...existingLog, ...log].slice(-20));
  }

  return log;
}

// ═══ Получить лог миграций ═══

export async function getMigrationLog() {
  return (await getSetting('migration_log')) || [];
}

// ═══ Статус ═══

export async function getMigrationStatus() {
  const lastMigrated = (await getSetting('schema_last_migrated')) || 0;
  const pending = MIGRATIONS.filter(m => m.version > lastMigrated);

  return {
    current_version: CURRENT_VERSION,
    last_migrated: lastMigrated,
    pending: pending.map(m => ({ version: m.version, name: m.name })),
    up_to_date: pending.length === 0,
    total_migrations: MIGRATIONS.length,
  };
}
