import db from './index';

export async function exportAll() {
  const data = {};
  for (const table of db.tables) {
    data[table.name] = await table.toArray();
  }
  data._meta = {
    version: db.verno,
    exported_at: new Date().toISOString(),
    app_version: '1.0.0',
    records_count: Object.values(data).reduce(
      (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0
    ),
  };
  return JSON.stringify(data);
}

export async function importAll(jsonString) {
  let data;
  try { data = JSON.parse(jsonString); } catch { throw new Error('Невалидный JSON'); }
  if (!data._meta?.version) throw new Error('Файл не является бэкапом LifeOS');
  if (data._meta.version > db.verno) throw new Error(`Бэкап v${data._meta.version}, нужно обновить LifeOS`);

  const knownTables = db.tables.map(t => t.name);
  const preview = {
    date: data._meta.exported_at,
    records: data._meta.records_count,
    tables: knownTables.filter(t => data[t]?.length > 0).length,
  };

  return {
    preview,
    execute: async () => {
      // Auto-backup before import
      const currentBackup = await exportAll();
      const blob = new Blob([currentBackup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lifeos-auto-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Import
      await db.transaction('rw', db.tables, async () => {
        for (const table of db.tables) {
          if (data[table.name] && Array.isArray(data[table.name])) {
            await table.clear();
            await table.bulkAdd(data[table.name]);
          }
        }
      });
    },
  };
}

export async function getStorageEstimate() {
  if (navigator.storage?.estimate) {
    const { usage, quota } = await navigator.storage.estimate();
    return {
      used_mb: (usage / 1024 / 1024).toFixed(1),
      quota_mb: (quota / 1024 / 1024).toFixed(0),
      percent: quota > 0 ? ((usage / quota) * 100).toFixed(1) : '0.0',
    };
  }
  return null;
}

export async function downloadBackup() {
  const json = await exportAll();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lifeos-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  await db.settings.put({ key: 'last_backup', value: new Date().toISOString() });
}
