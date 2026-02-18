import { useState, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import { getLogs, clearLogs, exportLogs } from '../../lib/logger';

const CAT_ICONS = {
  error: '❌', nav: '🧭', tap: '👆', api: '🌐', db: '💾',
  lifecycle: '⚡', perf: '⏱', sw: '🔧',
};
const LEVEL_COLORS = {
  error: '#FF3B30', warn: '#FF9500', nav: '#007AFF',
  action: '#5856D6', perf: '#34C759', info: '#8E8E93',
};

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'error', label: 'Ошибки' },
  { id: 'nav', label: 'Навигация' },
  { id: 'api', label: 'API' },
  { id: 'lifecycle', label: 'Жизненный цикл' },
];

export default function ErrorLogScreen({ theme, onBack }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await getLogs(500);
    setLogs(data);
    setLoading(false);
  };

  const handleExport = async () => {
    const json = await exportLogs();
    const blob = new Blob([json], { type: 'application/json' });

    if (navigator.share) {
      try {
        const file = new File([blob], `lifeos-logs-${new Date().toISOString().slice(0,10)}.json`, { type: 'application/json' });
        await navigator.share({ files: [file], title: 'LifeOS Logs' });
        return;
      } catch {}
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lifeos-logs-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const handleClear = async () => {
    await clearLogs();
    setLogs([]);
  };

  const fmtTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      + '.' + String(d.getMilliseconds()).padStart(3, '0');
  };

  const fmtDate = (ts) => new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

  const filtered = filter === 'all' ? logs
    : filter === 'error' ? logs.filter(l => l.level === 'error' || l.level === 'warn')
    : logs.filter(l => l.cat === filter);

  const errCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Диагностика" onBack={onBack} theme={theme}
        rightContent={
          <div className="flex gap-3">
            <button onClick={handleExport} style={{ color: theme.accent, fontSize: 14, fontWeight: 500, minHeight: 44, minWidth: 44 }}>
              Отправить
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {/* Stats bar */}
        <div className="flex gap-2 mb-2" style={{ fontSize: 12 }}>
          <span style={{ color: LEVEL_COLORS.error }}>{errCount} ошибок</span>
          <span style={{ color: LEVEL_COLORS.warn }}>{warnCount} предупр.</span>
          <span style={{ color: theme.gray2 }}>{logs.length} всего</span>
          <span className="flex-1" />
          <button onClick={handleClear} style={{ color: '#FF3B30', fontSize: 12 }}>Очистить</button>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: 'none' }}>
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500,
                whiteSpace: 'nowrap',
                background: filter === f.id ? theme.accent : theme.card,
                color: filter === f.id ? '#fff' : theme.gray1,
                border: filter === f.id ? 'none' : `1px solid ${theme.gray4}`,
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-8" style={{ color: theme.gray2 }}>Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8" style={{ color: theme.gray2 }}>Записей нет</div>
        ) : (
          <div className="space-y-1">
            {filtered.map((entry, i) => {
              const showDate = i === 0 || fmtDate(entry.ts) !== fmtDate(filtered[i - 1]?.ts);
              return (
                <div key={entry.id || `b${i}`}>
                  {showDate && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: theme.gray2, padding: '8px 0 2px' }}>
                      {fmtDate(entry.ts)}
                    </div>
                  )}
                  <div style={{
                    padding: '6px 8px', borderRadius: 8,
                    background: entry.level === 'error' ? (theme.red || '#FF3B30') + '10' : 'transparent',
                  }}>
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontSize: 10 }}>{CAT_ICONS[entry.cat] || '📝'}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: LEVEL_COLORS[entry.level] || theme.gray2, textTransform: 'uppercase' }}>
                        {entry.cat || entry.level}
                      </span>
                      <span style={{ fontSize: 10, color: theme.gray3 }}>{fmtTime(entry.ts)}</span>
                      {entry.dt > 0 && <span style={{ fontSize: 9, color: theme.gray3 }}>+{(entry.dt / 1000).toFixed(1)}s</span>}
                      {entry.screen && entry.screen !== '?' && (
                        <span style={{ fontSize: 9, color: theme.gray3, background: theme.gray5, borderRadius: 4, padding: '0 4px' }}>
                          {entry.screen}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: theme.text, wordBreak: 'break-word', marginTop: 1 }}>
                      {entry.msg}
                    </div>
                    {entry.data && (
                      <details style={{ marginTop: 2 }}>
                        <summary style={{ fontSize: 10, color: theme.gray2, cursor: 'pointer' }}>данные</summary>
                        <pre style={{ fontSize: 9, color: theme.gray2, whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: 2, maxHeight: 200, overflow: 'auto' }}>
                          {entry.data}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
