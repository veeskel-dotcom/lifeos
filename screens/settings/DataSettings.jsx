import { useToast } from '../../components/ToastProvider';
/**
 * DataSettings — Экран настроек данных.
 * Секции: Экспорт, Демо-данные, Очистка, Хранилище.
 */
import { useState } from 'react';
import { loadDemoData } from '../../db/demoSeed';
// ALLOWED EXCEPTION: DataSettings iterates db.tables for backup/export/stats
import db from '../../db/index';
import { fullHealthCheck, autoRepair, getStorageBreakdown, requestPersistentStorage, getQuotaWarnings } from '../../services/storageHealth';
import NavHeader from '../../components/NavHeader';
import ConfirmSheet from '../../components/ConfirmSheet';
import ScreenWrapper from '../../components/ScreenWrapper';

export default function DataSettings({ theme, onBack }) {
  const showToast = useToast();
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoResult, setDemoResult] = useState(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [showDemoConfirm, setShowDemoConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleLoadDemo = async () => {
    setShowDemoConfirm(false);
    setDemoLoading(true);
    setDemoResult(null);
    try {
      const stats = await loadDemoData();
      setDemoResult(`✅ Загружено: ${stats.expenses} расходов, ${stats.foodLogs} приёмов пищи, ${stats.workouts} тренировок`);
    } catch (e) {
      console.error('Demo seed error:', e);
      setDemoResult(`❌ Ошибка: ${e.message}`);
    } finally {
      setDemoLoading(false);
    }
  };

  const handleClearAll = async () => {
    setShowClearConfirm(false);
    try {
      for (const table of db.tables) {
        await table.clear();
      }
      setClearConfirm(false);
      setDemoResult('🗑 Все данные удалены');
    } catch (e) {
      setDemoResult(`❌ Ошибка: ${e.message}`);
    }
  };

  return (
    <ScreenWrapper theme={theme}>
      <NavHeader title="Данные" onBack={onBack} theme={theme} />

      <div className="px-4 space-y-4 pb-28">
        {/* ─── Экспорт ─── */}
        <SectionCard theme={theme}>
          <SectionTitle theme={theme}>📦 Экспорт и бэкап</SectionTitle>
          <p className="text-xs mb-3" style={{ color: theme.gray2 }}>Экспортировать все данные в JSON-файл</p>
          <button
            onClick={async () => {
              try {
                const data = {};
                for (const table of db.tables) { data[table.name] = await table.toArray(); }
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `lifeos-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) { showToast('⚠️ Ошибка экспорта: ' + e.message); }
            }}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: theme.gray5, color: theme.text, border: 'none', cursor: 'pointer' }}>
            📥 Экспорт JSON
          </button>
          {typeof navigator?.share === 'function' && (
            <button
              onClick={async () => {
                try {
                  const data = {};
                  for (const table of db.tables) { data[table.name] = await table.toArray(); }
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const file = new File([blob], `lifeos-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
                  await navigator.share({ files: [file], title: 'LifeOS Backup' });
                } catch (e) { if (e.name !== 'AbortError') showToast('⚠️ Ошибка: ' + e.message); }
              }}
              className="w-full py-3 rounded-xl text-sm font-medium mt-2"
              style={{ background: theme.accent + '15', color: theme.accent, border: 'none', cursor: 'pointer' }}>
              📤 Поделиться файлом
            </button>
          )}
        </SectionCard>

        {/* ─── Демо-данные ─── */}
        <SectionCard theme={theme}>
          <SectionTitle theme={theme}>🎭 Демо-данные</SectionTitle>
          <p className="text-xs mb-3" style={{ color: theme.gray2 }}>30 дней фейковых данных для тестирования</p>
          <button onClick={() => setShowDemoConfirm(true)} disabled={demoLoading}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity"
            style={{ background: theme.accent + '20', color: theme.accent, border: 'none',
              cursor: demoLoading ? 'wait' : 'pointer', opacity: demoLoading ? 0.6 : 1 }}>
            {demoLoading ? '⏳ Загрузка...' : '🎭 Загрузить демо-данные'}
          </button>
          {demoResult && <p className="text-xs mt-2" style={{ color: theme.gray1 }}>{demoResult}</p>}
        </SectionCard>

        {/* ─── Очистка ─── */}
        <SectionCard theme={theme}>
          <SectionTitle theme={theme}>🗑 Очистка данных</SectionTitle>
          <p className="text-xs mb-3" style={{ color: theme.gray2 }}>Удалить все данные из приложения. Действие необратимо.</p>
          <button onClick={() => setShowClearConfirm(true)}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: theme.red + '15', color: theme.red, border: 'none', cursor: 'pointer' }}>
            🗑 Очистить все данные
          </button>
        </SectionCard>

        {/* ─── Хранилище ─── */}
        <StorageInfo theme={theme} />
      </div>
      <ConfirmSheet
        open={!!showDemoConfirm}
        onClose={() => setShowDemoConfirm(false)}
        title="Загрузить демо-данные?"
        message="Текущие данные будут перезаписаны. Это нельзя отменить."
        confirmLabel="Загрузить"
        onConfirm={handleLoadDemo}
        destructive={false}
        theme={theme}
      />
      <ConfirmSheet
        open={!!showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="⚠️ Удалить ВСЕ данные?"
        message="Все таблицы будут очищены. Расходы, задачи, тренировки, настройки — всё будет удалено безвозвратно."
        confirmLabel="Удалить всё"
        onConfirm={handleClearAll}
        theme={theme}
      />
    </ScreenWrapper>
  );
}

/* ─── Shared ─── */
function SectionCard({ theme, children }) {
  return <div className="rounded-2xl p-4" style={{ background: theme.card }}>{children}</div>;
}

function SectionTitle({ theme, children }) {
  return <div className="text-sm font-semibold mb-2" style={{ color: theme.text }}>{children}</div>;
}

/* ─── T3+T7+T8: Хранилище ─── */
function StorageInfo({ theme }) {
  const [health, setHealth] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState(null);
  const [persistResult, setPersistResult] = useState(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    setRepairResult(null);
    try {
      const h = await fullHealthCheck();
      setHealth(h);
      const bd = await getStorageBreakdown();
      setBreakdown(bd);
    } catch {
      setHealth({ overall: 'error' });
    }
    setChecking(false);
  };

  const handleRepair = async () => {
    if (!health?.integrity?.issues) return;
    setRepairing(true);
    try {
      const fixable = health.integrity.issues.filter(i => i.fixable);
      const results = await autoRepair(fixable);
      const fixed = results.filter(r => r.fixed).length;
      setRepairResult(`✅ Исправлено: ${fixed} из ${fixable.length}`);
      // Перепроверить
      await check();
    } catch (e) {
      setRepairResult(`❌ Ошибка: ${e.message}`);
    }
    setRepairing(false);
  };

  const handleRequestPersist = async () => {
    const result = await requestPersistentStorage();
    if (result.already) setPersistResult('Уже защищено ✅');
    else if (result.granted) setPersistResult('Защита включена ✅');
    else if (!result.supported) setPersistResult('Не поддерживается браузером');
    else setPersistResult('Браузер отклонил запрос');
    // Обновить health
    setTimeout(check, 500);
  };

  const statusColor = health?.overall === 'healthy' ? theme.green
    : health?.overall === 'critical' ? theme.red : theme.orange;

  const info = health?.storage;

  return (
    <div className="rounded-2xl p-4" style={{ background: theme.card }}>
      <SectionTitle theme={theme}>💾 Хранилище</SectionTitle>

      {health ? (
        <div className="text-xs space-y-2" style={{ color: theme.gray1 }}>

          {/* Статус */}
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
            <span className="font-medium" style={{ color: statusColor }}>
              {health.overall === 'healthy' ? 'Всё в порядке'
                : health.overall === 'critical' ? 'Критические проблемы'
                : 'Есть предупреждения'}
            </span>
          </div>

          {/* T8: Предупреждения */}
          {health.quotaWarnings?.length > 0 && (
            <div className="space-y-1 mb-2">
              {health.quotaWarnings.map((w, i) => (
                <p key={i} className="text-[11px] font-medium"
                  style={{ color: w.level === 'critical' ? theme.red : theme.orange }}>
                  {w.level === 'critical' ? '🔴' : '🟡'} {w.message}
                </p>
              ))}
            </div>
          )}

          {/* T3: Версия */}
          <p>Версия схемы: {health.schema.current}
            {health.schema.match
              ? <span style={{ color: theme.green }}> ✅</span>
              : <span style={{ color: theme.red }}> ⚠️ (ожидается {health.schema.expected})</span>}
          </p>

          {/* T3: Миграции */}
          {health.migration && !health.migration.up_to_date && (
            <p style={{ color: theme.orange }}>
              ⏳ Ожидает миграций: {health.migration.pending.map(m => m.name).join(', ')}
            </p>
          )}

          {/* T8: Квота */}
          {info && !info.error && (
            <>
              <p>Использовано: {info.usage_mb} МБ из {info.quota_mb} МБ ({info.percent}%)</p>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: theme.gray5 }}>
                <div className="h-full rounded-full" style={{
                  width: `${Math.min(info.percent, 100)}%`,
                  background: info.percent > 80 ? theme.red : info.percent > 50 ? theme.orange : theme.green,
                }} />
              </div>

              {/* Persistent storage */}
              <div className="flex items-center justify-between">
                <span>Persistent: {info.persistent ? '✅ Защищено' : '⚠️ Не защищено'}</span>
                {!info.persistent && (
                  <button onClick={handleRequestPersist}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-lg"
                    style={{ background: theme.accent + '15', color: theme.accent, border: 'none', cursor: 'pointer' }}>
                    Защитить
                  </button>
                )}
              </div>
              {persistResult && <p className="text-[10px]" style={{ color: theme.gray2 }}>{persistResult}</p>}

              <p>IndexedDB: {info.indexeddb_ok ? '✅ Работает' : '❌ Ошибка'}</p>
            </>
          )}

          {/* T8: Breakdown */}
          {breakdown && breakdown.top3?.length > 0 && (
            <div className="pt-2 mt-2" style={{ borderTop: `0.5px solid ${theme.gray5}` }}>
              <p className="font-medium mb-1">Использование по таблицам ({breakdown.total_mb} МБ):</p>
              {breakdown.top3.map((t, i) => (
                <div key={t.name} className="flex items-center gap-2 mb-1">
                  <span className="w-16 truncate">{t.name}</span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: theme.gray5 }}>
                    <div className="h-full rounded-full" style={{
                      width: `${t.pct}%`,
                      background: i === 0 ? theme.accent : i === 1 ? theme.teal : theme.gray3,
                    }} />
                  </div>
                  <span className="text-[10px] w-12 text-right">{t.kb} КБ</span>
                </div>
              ))}
            </div>
          )}

          {/* T7: Целостность */}
          {health.integrity && (
            <div className="pt-2 mt-2" style={{ borderTop: `0.5px solid ${theme.gray5}` }}>
              <p className="font-medium mb-1">Целостность данных:</p>
              <p>Критических: {health.integrity.critical}{health.integrity.critical === 0 ? ' ✅' : ' ❌'}</p>
              <p>Осиротевших: {health.integrity.orphans}</p>
              <p>Предупреждений: {health.integrity.warnings}</p>

              {/* Подробности */}
              {health.integrity.issues.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer" style={{ color: theme.accent }}>Подробности ({health.integrity.total_issues})</summary>
                  <div className="mt-1 space-y-0.5 text-[10px]">
                    {health.integrity.issues.map((issue, i) => (
                      <p key={i} style={{
                        color: issue.type === 'error' || issue.type === 'corrupt' ? theme.red
                          : issue.type === 'orphan' ? theme.orange
                          : issue.type === 'cleanup' ? theme.teal
                          : theme.gray2
                      }}>
                        [{issue.type}] {issue.table ? `${issue.table}: ` : ''}{issue.detail}
                        {issue.fixable && ' 🔧'}
                      </p>
                    ))}
                  </div>
                </details>
              )}

              {/* T7: Авторемонт */}
              {health.integrity.fixable > 0 && (
                <button onClick={handleRepair} disabled={repairing}
                  className="mt-2 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                  style={{ background: theme.accent + '15', color: theme.accent, border: 'none', cursor: 'pointer' }}>
                  {repairing ? '⏳ Исправляю...' : `🔧 Исправить (${health.integrity.fixable})`}
                </button>
              )}
              {repairResult && <p className="text-[11px] mt-1" style={{ color: theme.green }}>{repairResult}</p>}
            </div>
          )}

          {/* Перепроверка */}
          <button onClick={check} disabled={checking}
            className="text-xs font-medium mt-2"
            style={{ color: theme.accent, background: 'none', border: 'none', cursor: 'pointer' }}>
            {checking ? '⏳ Проверяю...' : '🔄 Перепроверить'}
          </button>
        </div>
      ) : (
        <button onClick={check} disabled={checking}
          className="text-sm font-medium"
          style={{ color: theme.accent, background: 'none', border: 'none', cursor: 'pointer' }}>
          {checking ? '⏳ Проверяю...' : 'Проверить здоровье'}
        </button>
      )}
    </div>
  );
}
