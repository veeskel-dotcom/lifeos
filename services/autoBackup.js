/**
 * M5.5: Автоматический бэкап — JSON snapshot в IndexedDB.
 * Хранит последние 3 бэкапа. Запускается раз в 24ч.
 */
import db from '../db/index';
import { getSetting, setSetting } from '../db/helpers';

const BACKUP_KEY = 'auto_backups';
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24ч
const MAX_BACKUPS = 3;

/**
 * Создать snapshot всех таблиц.
 */
async function createSnapshot() {
  const data = {};
  for (const table of db.tables) {
    try {
      data[table.name] = await table.toArray();
    } catch {
      data[table.name] = [];
    }
  }
  return data;
}

/**
 * Сохранить бэкап.
 */
export async function saveBackup() {
  try {
    const snapshot = await createSnapshot();
    const backupsRaw = await getSetting(BACKUP_KEY);
    let backups = [];
    try { backups = JSON.parse(backupsRaw) || []; } catch {}

    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      size: JSON.stringify(snapshot).length,
    };

    // Сохраняем данные отдельным ключом (чтобы не раздувать settings)
    await setSetting(`backup_data_${entry.id}`, JSON.stringify(snapshot));

    backups.unshift(entry);

    // Удаляем старые бэкапы
    while (backups.length > MAX_BACKUPS) {
      const old = backups.pop();
      await setSetting(`backup_data_${old.id}`, null);
    }

    await setSetting(BACKUP_KEY, JSON.stringify(backups));
    await setSetting('last_backup', new Date().toISOString());

    console.log('[autoBackup] saved', entry.date, `${(entry.size / 1024).toFixed(0)}KB`);
    return entry;
  } catch (e) {
    console.error('[autoBackup] save failed', e);
    return null;
  }
}

/**
 * Получить список бэкапов.
 */
export async function getBackups() {
  try {
    const raw = await getSetting(BACKUP_KEY);
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

/**
 * Восстановить из бэкапа.
 */
export async function restoreBackup(backupId) {
  try {
    const raw = await getSetting(`backup_data_${backupId}`);
    if (!raw) throw new Error('Бэкап не найден');

    const data = JSON.parse(raw);

    for (const table of db.tables) {
      if (data[table.name]) {
        await table.clear();
        await table.bulkAdd(data[table.name]);
      }
    }

    return true;
  } catch (e) {
    console.error('[autoBackup] restore failed', e);
    throw e;
  }
}

/**
 * Проверить и запустить автобэкап если прошло > 24ч.
 */
export async function checkAndBackup() {
  try {
    const last = await getSetting('last_backup');
    if (last) {
      const elapsed = Date.now() - new Date(last).getTime();
      if (elapsed < BACKUP_INTERVAL) return null;
    }
    return saveBackup();
  } catch (e) {
    console.error('[autoBackup] check failed', e);
    return null;
  }
}

/**
 * Скачать бэкап как файл.
 */
export async function downloadBackup(backupId) {
  const raw = await getSetting(`backup_data_${backupId}`);
  if (!raw) throw new Error('Бэкап не найден');

  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lifeos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
