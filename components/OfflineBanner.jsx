/**
 * OfflineBanner — «Нет подключения к интернету».
 * Показывается вверху когда navigator.onLine === false.
 * Автоматически скрывается при восстановлении сети.
 */
import { useState, useEffect } from 'react';
import { onOnlineStatusChange, isOnline } from '../lib/offlineDetector';

export default function OfflineBanner({ theme }) {
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const unsub = onOnlineStatusChange((status) => setOnline(status));
    return unsub;
  }, []);

  if (online) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-center gap-2 py-2 text-sm font-medium"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        background: theme?.orange || '#FF9500',
        color: '#FFFFFF',
      }}
    >
      <span>📡</span>
      <span>Нет подключения к интернету</span>
    </div>
  );
}
