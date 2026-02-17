import { useState, useEffect, useCallback } from 'react';
import Card from '../../../components/Card';
import NavHeader from '../../../components/NavHeader';
import EmptyState from '../../../components/EmptyState';
import ProgressBar from '../../../components/ProgressBar';
import { getDocuments } from '../../../services/documents';
import SkeletonCard from '../../../components/SkeletonCard';

const DOC_TAGS = ['Все', '📷 Чеки', '🏠 ЖКХ', '📄 Документы', '📊 Инвестиции'];

const TYPE_META = {
  photo: { emoji: '📷', label: 'Фото', color: '#FF9500' },
  pdf: { emoji: '📄', label: 'PDF', color: '#007AFF' },
  excel: { emoji: '📊', label: 'Excel', color: '#34C759' },
  scan: { emoji: '📷', label: 'Скан', color: '#FF9500' },
  other: { emoji: '📋', label: 'Файл', color: '#AF52DE' },
};

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1048576).toFixed(1)} МБ`;
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const now = new Date();
  const diff = now - dt;
  if (diff < 86400000) return 'Сегодня';
  if (diff < 172800000) return 'Вчера';
  return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function DocumentsList({ theme, onBack, onAdd, onEdit }) {
  const [docs, setDocs] = useState(undefined);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState(0);

  const load = useCallback(async () => {
    const all = await getDocuments();
    setDocs(all || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (docs === undefined) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
        <NavHeader title="Документы" onBack={onBack} right={<span style={{ fontSize: 22, color: theme.accent, cursor: 'pointer' }} onClick={onAdd}>＋</span>} theme={theme} />
        <div className="px-4 pt-2"><SkeletonCard theme={theme} /><SkeletonCard variant="compact" theme={theme} /></div>
      </div>
    );
  }

  // Filter
  const tagMap = { 1: 'receipt', 2: 'utility', 3: 'document', 4: 'invest' };
  const filtered = docs.filter(d => {
    if (search && !d.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (tagFilter > 0 && d.category !== tagMap[tagFilter]) return false;
    return true;
  });

  // Storage
  const totalBytes = docs.reduce((s, d) => s + (d.size || 0), 0);
  const maxBytes = 50 * 1048576;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Документы"
        right={<span style={{ fontSize: 22, color: theme.accent, cursor: 'pointer' }} onClick={onAdd}>＋</span>}
        onBack={onBack} theme={theme} />

      <div className="flex-1 overflow-auto">
        {/* Search */}
        <div style={{ padding: '0 16px 8px' }}>
          <div className="flex items-center" style={{ background: theme.gray5, borderRadius: 10, padding: '10px 12px', gap: 8 }}>
            <svg width={16} height={16} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <g fill="none" stroke={theme.gray3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </g>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск файлов" style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: theme.text, flex: 1 }} />
          </div>
        </div>

        {/* Tag chips */}
        <div className="flex overflow-x-auto" style={{ gap: 6, padding: '0 16px 10px' }}>
          {DOC_TAGS.map((t, i) => (
            <div key={t} onClick={() => setTagFilter(i)} className="cursor-pointer shrink-0" style={{
              padding: '6px 12px', borderRadius: 14, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
              background: i === tagFilter ? theme.accent : theme.gray5,
              color: i === tagFilter ? '#fff' : theme.gray2,
            }}>{t}</div>
          ))}
        </div>

        {/* File list */}
        {filtered.length === 0 ? (
          <EmptyState icon="📄" title="Нет документов" subtitle="Добавьте паспорт или чек"
            actionLabel="＋ Документ" onAction={onAdd} theme={theme} />
        ) : (
          <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
            {filtered.map((d, i) => {
              const meta = TYPE_META[d.file_type] || TYPE_META.other;
              return (
                <div key={d.id || i} onClick={() => onEdit?.(d)} className="flex items-center cursor-pointer"
                  style={{ gap: 10, padding: '12px 14px', borderBottom: i < filtered.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                  <div className="flex items-center justify-center shrink-0"
                    style={{ width: 40, height: 40, borderRadius: 10, background: meta.color + '12', fontSize: 18 }}>
                    {meta.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate" style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{d.name}</div>
                    <div className="truncate" style={{ fontSize: 12, color: theme.gray2 }}>
                      {meta.emoji} {meta.label}{d.size ? ` · ${fmtSize(d.size)}` : ''}{d.created_at ? ` · ${fmtDate(d.created_at)}` : ''}
                    </div>
                  </div>
                  <span style={{ color: theme.gray3 }}>→</span>
                </div>
              );
            })}
          </Card>
        )}

        {/* Storage info */}
        <div style={{ padding: '0 16px', marginBottom: 16 }}>
          <div style={{ background: theme.card, borderRadius: 14, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="flex justify-between" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: theme.gray1 }}>Использовано</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{fmtSize(totalBytes)}</span>
            </div>
            <ProgressBar value={totalBytes} max={maxBytes} color={theme.accent} height={4} theme={theme} />
            <div style={{ fontSize: 11, color: theme.gray2, marginTop: 4 }}>
              {docs.length} файлов · {fmtSize(totalBytes)} из ~50 МБ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
