import { useState, useEffect } from 'react';
import { useToast } from '../../components/ToastProvider';
import { getSetting, setSetting } from '../../db/helpers';
import NavHeader from '../../components/NavHeader';
import ScreenWrapper from '../../components/ScreenWrapper';

export default function SyncSettings({ theme, onBack }) {
  const showToast = useToast();
  const [syncing, setSyncing] = useState(false);
  const [syncPhase, setSyncPhase] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [lastRecords, setLastRecords] = useState(null);
  const [serverStatus, setServerStatus] = useState(null);
  const [serverInfo, setServerInfo] = useState(null);
  const [autoSync, setAutoSync] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    getSetting('last_server_sync').then(v => setLastSync(v));
    getSetting('last_server_sync_records').then(v => setLastRecords(v));
    getSetting('auto_server_sync').then(v => setAutoSync(!!v));
    checkServer();
    loadPendingCount();
    const interval = setInterval(loadPendingCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadPendingCount = async () => {
    try {
      const { getPendingCount } = await import('../../db/changeTracker');
      setPendingCount(await getPendingCount());
    } catch {}
  };

  const checkServer = async () => {
    setServerStatus('loading');
    try {
      const { getSyncStatus } = await import('../../services/serverSync');
      const status = await getSyncStatus();
      if (status) {
        setServerStatus('ok');
        setServerInfo(status);
      } else {
        setServerStatus('error');
      }
    } catch {
      setServerStatus('error');
    }
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncPhase('Подготовка данных...');
    try {
      const { pushToServer } = await import('../../services/serverSync');
      setSyncPhase('Отправка на сервер...');
      const result = await pushToServer();
      if (result.ok) {
        const records = result.records || result.records_count || 0;
        const sizeKb = result.size_kb || 0;
        showToast(`Синхронизировано: ${records} записей${sizeKb ? ` (${sizeKb} КБ)` : ''}`);
        setLastSync(new Date().toISOString());
        setLastRecords(records);
        checkServer();
        loadPendingCount();
      } else {
        showToast(result.error || 'Ошибка синхронизации');
      }
    } catch (e) {
      showToast(e.message || 'Ошибка');
    } finally {
      setSyncing(false);
      setSyncPhase('');
    }
  };

  const toggleAutoSync = async (enabled) => {
    setAutoSync(enabled);
    await setSetting('auto_server_sync', enabled);
    if (enabled) {
      const { startDeltaSync } = await import('../../services/sync');
      startDeltaSync();
      const { enableTracking } = await import('../../db/changeTracker');
      enableTracking();
      showToast('Авто-синхронизация включена');
    } else {
      const { stopDeltaSync } = await import('../../services/sync');
      stopDeltaSync();
      showToast('Авто-синхронизация выключена');
    }
  };

  const formatRelative = (iso) => {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'только что';
    if (mins < 60) return `${mins} мин назад`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}ч назад`;
    const days = Math.floor(hours / 24);
    return `${days}д назад`;
  };

  return (
    <ScreenWrapper theme={theme}>
      <NavHeader title="Синхронизация" onBack={onBack} theme={theme} />

      <div className="px-4 space-y-4 pb-28">
        {/* Статус сервера */}
        <div className="rounded-2xl p-4" style={{ background: theme.card, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#5856D6' + '18' }}>
              <span className="text-lg">☁️</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold" style={{ color: theme.text }}>Сервер</div>
              <div className="text-xs" style={{ color: theme.gray2 }}>
                {serverStatus === 'loading' ? 'Проверка...'
                  : serverStatus === 'ok' ? '🟢 Подключён'
                  : serverStatus === 'error' ? '🔴 Недоступен'
                  : 'Не проверен'}
              </div>
            </div>
            <button onClick={checkServer}
              className="text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ background: theme.gray6, color: theme.accent }}>
              Проверить
            </button>
          </div>

          {serverInfo?.has_data && (
            <div className="text-xs space-y-1" style={{ color: theme.gray2, paddingLeft: 52 }}>
              <div>Записей на сервере: <b style={{ color: theme.text }}>{serverInfo.records_count || '—'}</b></div>
              {serverInfo.last_sync && (
                <div>Последний пуш: <b style={{ color: theme.text }}>{formatRelative(serverInfo.last_sync)}</b></div>
              )}
            </div>
          )}
        </div>

        {/* Авто-синхронизация */}
        <div className="rounded-2xl p-4" style={{ background: theme.card, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold" style={{ color: theme.text }}>Авто-синхронизация</div>
              <div className="text-xs mt-0.5" style={{ color: theme.gray2 }}>
                Дельта каждые 5 мин, полная раз в 24ч
              </div>
            </div>
            <button
              onClick={() => toggleAutoSync(!autoSync)}
              className="relative w-12 h-7 rounded-full transition-colors"
              style={{ background: autoSync ? '#5856D6' : theme.gray5 }}
            >
              <div
                className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform"
                style={{ transform: autoSync ? 'translateX(22px)' : 'translateX(2px)' }}
              />
            </button>
          </div>
          {pendingCount > 0 && (
            <div className="text-xs mt-2" style={{ color: theme.gray2 }}>
              {pendingCount} изменени{pendingCount === 1 ? 'е' : pendingCount < 5 ? 'я' : 'й'} ожида{pendingCount === 1 ? 'ет' : 'ют'} отправки
            </div>
          )}
        </div>

        {/* Кнопка полной синхронизации */}
        <button
          onClick={handleSync}
          disabled={syncing || serverStatus === 'error'}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-opacity"
          style={{
            background: syncing ? theme.gray4 : '#5856D6',
            color: '#fff',
            opacity: serverStatus === 'error' ? 0.4 : 1,
          }}
        >
          {syncing ? syncPhase : '↑ Полная синхронизация'}
        </button>

        {serverStatus === 'error' && (
          <p className="text-xs text-center" style={{ color: theme.red }}>
            Настройте LIFEOS_SYNC_URL и LIFEOS_SYNC_TOKEN в Vercel Dashboard
          </p>
        )}

        {/* Последняя синхронизация */}
        {lastSync && (
          <div className="rounded-2xl p-4" style={{ background: theme.card, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: theme.gray2 }}>
              Последняя синхронизация
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span style={{ color: theme.gray1 }}>Время</span>
                <span style={{ color: theme.text }}>{formatRelative(lastSync)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: theme.gray1 }}>Дата</span>
                <span style={{ color: theme.text }}>
                  {new Date(lastSync).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {lastRecords && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: theme.gray1 }}>Записей</span>
                  <span style={{ color: theme.text }}>{Number(lastRecords).toLocaleString('ru-RU')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Инфо */}
        <div className="rounded-2xl p-4" style={{ background: theme.card, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: theme.gray2 }}>
            Как это работает
          </div>
          <div className="text-xs space-y-1.5" style={{ color: theme.gray1, lineHeight: '1.5' }}>
            <p>📱 Данные с телефона отправляются на ваш VPS</p>
            <p>🔄 Авто-режим: дельта каждые 5 мин, полная раз в сутки</p>
            <p>💻 На компьютере откройте дашборд: /dashboard/</p>
            <p>🔒 AI-данные и логи не синхронизируются</p>
          </div>
        </div>
      </div>
    </ScreenWrapper>
  );
}
