import FormInput from '../../components/FormInput';
/**
 * M2.1: GlobalSearch — кросс-модульный поиск.
 * Ищет по: задачам, заметкам, расходам, подпискам, документам, событиям.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import Ic from '../../components/Icon';
// ALLOWED EXCEPTION: GlobalSearch iterates multiple tables dynamically by name
import db from '../../db/index';

const MODULES = [
  { id: 'tasks', label: '📋 Задачи', table: 'tasks', fields: ['title', 'description'] },
  { id: 'notes', label: '📝 Заметки', table: 'notes', fields: ['title', 'content'] },
  { id: 'expenses', label: '💸 Расходы', table: 'expenses', fields: ['description', 'category_path_snapshot'] },
  { id: 'subscriptions', label: '💳 Подписки', table: 'subscriptions', fields: ['name'] },
  { id: 'documents', label: '🪪 Документы', table: 'documents', fields: ['name', 'notes'] },
  { id: 'events', label: '📅 События', table: 'events', fields: ['title', 'location'] },
];

export default function GlobalSearch({ theme, onBack, onNavigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setSearching(true);
    const lower = q.toLowerCase();
    const all = [];

    for (const mod of MODULES) {
      try {
        const items = await db[mod.table].toArray();
        const matches = items.filter(item =>
          mod.fields.some(f => item[f] && String(item[f]).toLowerCase().includes(lower))
        ).slice(0, 5);

        matches.forEach(item => {
          const text = mod.fields.map(f => item[f]).filter(Boolean).join(' · ');
          all.push({
            module: mod.id,
            moduleLabel: mod.label,
            id: item.id,
            title: item.title || item.name || item.description || '—',
            subtitle: text.length > 80 ? text.slice(0, 80) + '…' : text,
            date: item.date || item.created_at || null,
          });
        });
      } catch { /* table may not exist */ }
    }

    setResults(all);
    setSearching(false);
  }, []);

  const handleInput = (val) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleTap = (r) => {
    const routes = {
      tasks: 'taskDetail',
      notes: 'note-editor',
      expenses: 'expense-form',
      subscriptions: 'subscription-form',
      documents: 'document-form',
      events: 'event-form',
    };
    onNavigate?.(routes[r.module] || r.module, r.id);
  };

  const grouped = {};
  results.forEach(r => {
    if (!grouped[r.moduleLabel]) grouped[r.moduleLabel] = [];
    grouped[r.moduleLabel].push(r);
  });

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Поиск" onBack={onBack} theme={theme} />

      <div className="px-4 pb-24">
        {/* Search input */}
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4" style={{ background: theme.card }}>
          <Ic name="target" color={theme.gray2} size={18} r={5} raw />
          <FormInput value={query} onChange={handleInput} placeholder="Поиск по всем модулям..." theme={theme} />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }}
              className="text-xs" style={{ color: theme.gray2 }}>✕</button>
          )}
        </div>

        {/* Results */}
        {searching && (
          <div className="text-center text-sm py-8" style={{ color: theme.gray2 }}>Ищу...</div>
        )}

        {!searching && query.length >= 2 && results.length === 0 && (
          <div className="text-center py-8">
            <div className="mb-2"><Ic name="target" color={theme.gray2} size={36} r={10} /></div>
            <div className="text-sm" style={{ color: theme.gray2 }}>Ничего не найдено</div>
          </div>
        )}

        {Object.entries(grouped).map(([label, items]) => (
          <div key={label} className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wide mb-2 px-1" style={{ color: theme.gray1 }}>
              {label} ({items.length})
            </div>
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
              {items.map((r, i) => (
                <div key={r.id || i}>
                  {i > 0 && <div className="mx-4" style={{ borderTop: `0.5px solid ${theme.gray5}` }} />}
                  <div
                    className="px-4 py-3 active:opacity-70 cursor-pointer"
                    onClick={() => handleTap(r)}
                  >
                    <div className="text-sm font-medium truncate" style={{ color: theme.text }}>
                      {r.title}
                    </div>
                    {r.subtitle && r.subtitle !== r.title && (
                      <div className="text-xs truncate mt-0.5" style={{ color: theme.gray2 }}>
                        {r.subtitle}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        ))}

        {!query && (
          <EmptyState
            iconName="target" iconColor={theme.accent}
            title="Глобальный поиск"
            subtitle="Ищет по задачам, заметкам, расходам, подпискам, документам и событиям"
            tip="Введите от 2 символов. Поиск работает по всем модулям одновременно."
            theme={theme}
          />
        )}
      </div>
    </div>
  );
}
