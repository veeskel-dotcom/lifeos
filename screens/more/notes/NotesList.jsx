import FormInput from '../../../components/FormInput';
import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../../../components/Card';
import NavHeader from '../../../components/NavHeader';
import EmptyState from '../../../components/EmptyState';
import VoiceAddButton from '../../../components/VoiceAddButton';
import ChipBar from '../../../components/ChipBar';
import SelectSheet from '../../../components/SelectSheet';
import { getNotes, addNote, getAllTags, togglePin, toggleHidden } from '../../../services/notes';
import { getSetting, setSetting } from '../../../db/helpers';
import { getMoodTrend, logMood, getTodayMood, MOOD_LEVELS } from '../../../services/mood';
import SkeletonCard from '../../../components/SkeletonCard';
import ScreenWrapper from '../../../components/ScreenWrapper';
import Ic from '../../../components/Icon';

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const TAG_COLORS = [
  '#007AFF', '#34C759', '#FF9500', '#FF2D55', '#5856D6',
  '#AF52DE', '#FF3B30', '#5AC8FA', '#FFCC00', '#FF6482',
];

function getTagColor(tagName) {
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function formatNoteDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (diff < 172800000) return 'Вчера';
  if (d.getFullYear() === now.getFullYear()) return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function getPreview(content, maxLen = 100) {
  if (!content) return '';
  return content
    .replace(/#{1,6}\s/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
    .slice(0, maxLen);
}

function groupNotes(notes) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  const groups = [];
  const pinned = notes.filter(n => n.pinned);
  const unpinned = notes.filter(n => !n.pinned);

  if (pinned.length) groups.push({ label: '📌 Закреплённые', items: pinned });

  const todayNotes = unpinned.filter(n => (n.updated_at || n.created_at)?.startsWith(todayStr));
  if (todayNotes.length) groups.push({ label: 'Сегодня', items: todayNotes });

  const thisWeek = unpinned.filter(n => {
    const d = (n.updated_at || n.created_at)?.split('T')[0];
    return d && d >= weekAgoStr && d < todayStr;
  });
  if (thisWeek.length) groups.push({ label: 'На этой неделе', items: thisWeek });

  const older = unpinned.filter(n => {
    const d = (n.updated_at || n.created_at)?.split('T')[0];
    return d && d < weekAgoStr;
  });
  if (older.length) groups.push({ label: 'Ранее', items: older });

  return groups;
}

const SORT_OPTIONS = [
  { id: 'default', label: 'По дате' },
  { id: 'alpha', label: 'А-Я' },
  { id: 'mood', label: '😊 Настроение' },
];

export default function NotesList({ theme, onBack, onAdd, onEdit }) {
  const [notes, setNotes] = useState(undefined);
  const [tags, setTags] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [pinPrompt, setPinPrompt] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // I9: mood state
  const [moodTrend, setMoodTrend] = useState([]);
  const [todayMood, setTodayMood] = useState(null);

  const load = useCallback(async () => {
    const type = filter === 'note' || filter === 'diary' ? filter : undefined;
    const tag = filter.startsWith('tag:') ? filter.slice(4) : undefined;
    const raw = await getNotes({ type, tag, search: search || undefined });
    setNotes(raw);
    setTags(await getAllTags());

    // I9: mood
    try {
      const trend = await getMoodTrend(30);
      setMoodTrend(trend);
      const tm = await getTodayMood();
      setTodayMood(tm);
    } catch { /* ignore */ }
  }, [filter, search]);

  useEffect(() => { load(); }, [load]);

  // I9: handle mood log
  const handleMoodSelect = async (value) => {
    await logMood(value, '');
    const tm = await getTodayMood();
    setTodayMood(tm);
    const trend = await getMoodTrend(30);
    setMoodTrend(trend);
  };

  // Сортировка
  const sortedNotes = (() => {
    if (!notes) return undefined;
    let list = [...notes];
    if (!showHidden) list = list.filter(n => !n.hidden);
    if (sortBy === 'alpha') list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'));
    else if (sortBy === 'mood') list.sort((a, b) => (b.mood || 0) - (a.mood || 0));
    return list;
  })();

  const grouped = sortedNotes ? groupNotes(sortedNotes) : [];

  const chips = [
    { id: 'all', label: 'Все' },
    { id: 'note', label: '📝 Заметки' },
    { id: 'diary', label: '📓 Дневник' },
    ...tags.slice(0, 5).map(t => ({ id: `tag:${t}`, label: `#${t}` })),
  ];

  // I9: avg mood
  const avgMood = moodTrend.length > 0
    ? Math.round(moodTrend.reduce((s, m) => s + m.value, 0) / moodTrend.length * 10) / 10
    : null;
  const avgMoodEmoji = avgMood
    ? (MOOD_LEVELS.find(m => m.value === Math.round(avgMood))?.emoji || '😐')
    : null;

  /* M4.1: Skeleton while loading */
  if (notes === undefined) {
    return (
      <ScreenWrapper theme={theme}>
        <NavHeader title="Заметки" onBack={onBack} theme={theme} />
        <div className="px-4 space-y-3 pt-2">
          <SkeletonCard theme={theme} />
          <SkeletonCard variant="compact" theme={theme} />
          <SkeletonCard variant="compact" theme={theme} />
        </div>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper theme={theme}>
      <NavHeader title="Заметки" onBack={onBack} theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {/* Search */}
        <div className="relative">
          <FormInput value={search} onChange={setSearch} placeholder="Поиск заметок..." theme={theme} />
          <span className="absolute left-3 top-2.5"><Ic name="target" color={theme.gray2} size={16} r={4} raw /></span>
        </div>

        {/* Filters + Sort */}
        <div className="flex items-center gap-2">
          <div className="flex-1 overflow-x-auto">
            <ChipBar chips={chips} active={filter} onChange={setFilter} theme={theme} />
          </div>
          <button
            onClick={() => setShowSortSheet(true)}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium active:opacity-70"
            style={{ background: theme.gray6, color: theme.text, border: 'none', cursor: 'pointer' }}
          >
            {SORT_OPTIONS.find(o => o.id === sortBy)?.label || 'Сортировка'} ▾
          </button>
          <SelectSheet
            open={showSortSheet}
            onClose={() => setShowSortSheet(false)}
            title="Сортировка"
            options={SORT_OPTIONS.map(o => ({ value: o.id, label: o.label }))}
            selected={sortBy}
            onSelect={setSortBy}
            theme={theme}
          />
        </div>

        {/* I9: Mood widget */}
        <Card theme={theme}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
              Как настроение?
            </span>
            {avgMood && (
              <span className="text-xs" style={{ color: theme.gray2 }}>
                Среднее: {avgMoodEmoji} {avgMood}
              </span>
            )}
          </div>
          <div className="flex justify-between">
            {MOOD_LEVELS.map(m => (
              <button
                key={m.value}
                onClick={() => handleMoodSelect(m.value)}
                className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all"
                style={{
                  background: todayMood?.value === m.value ? theme.accent + '20' : 'transparent',
                  transform: todayMood?.value === m.value ? 'scale(1.15)' : 'scale(1)',
                }}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[9px]" style={{ color: theme.gray2 }}>{m.label}</span>
              </button>
            ))}
          </div>

          {/* I9: mood trend chart */}
          {moodTrend.length >= 5 && (
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={moodTrend}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: theme.gray2 }}
                    axisLine={false}
                    tickLine={false}
                    interval={Math.floor(moodTrend.length / 5)}
                    tickFormatter={d => d.slice(8)}
                  />
                  <YAxis hide domain={[1, 5]} />
                  <Tooltip
                    contentStyle={{ background: theme.card, border: 'none', borderRadius: 8, fontSize: 11, color: theme.text }}
                    formatter={(v) => {
                      const m = MOOD_LEVELS.find(l => l.value === v);
                      return [m ? `${m.emoji} ${m.label}` : v, 'Настроение'];
                    }}
                  />
                  <Line type="monotone" dataKey="value" stroke={theme.accent} strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Notes list */}
        {sortedNotes === undefined ? (
          <div className="text-center py-8 text-sm" style={{ color: theme.gray2 }}>Загрузка...</div>
        ) : grouped.length === 0 ? (
          <EmptyState
            iconName="note" iconColor={theme.accent}
            title="Нет заметок"
            subtitle="Создайте первую заметку"
            tip="Дневник + настроение = анализ трендов 📊"
            actionLabel="＋ Заметка"
            onAction={onAdd}
            theme={theme}
          />
        ) : (
          grouped.map(group => (
            <div key={group.label}>
              <div className="text-xs font-semibold uppercase tracking-wide py-2 px-1" style={{ color: theme.gray1 }}>
                {group.label}
              </div>
              <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
                {group.items.map((note, i) => (
                  <div
                    key={note.id}
                    className="px-4 py-3 active:opacity-70 cursor-pointer"
                    style={{ borderBottom: i < group.items.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}
                    onClick={() => onEdit?.(note.id)}
                  >
                    <div className="flex items-center gap-2">
                      {note.mood && (
                        <span className="text-sm">{MOOD_LEVELS.find(m => m.value === note.mood)?.emoji}</span>
                      )}
                      <span className="truncate" style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>
                        {note.title || 'Без названия'}
                      </span>
                      {note.pinned && <Ic name="flag" color={theme.orange} size={14} r={3} raw />}
                      {note.hidden && <Ic name="lock" color={theme.gray2} size={14} r={3} raw />}
                    </div>
                    <div className="mt-0.5 truncate" style={{ fontSize: 13, color: theme.gray2 }}>
                      {getPreview(note.content)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span style={{ fontSize: 11, color: theme.gray3 }}>
                        {formatNoteDate(note.updated_at || note.created_at)}
                      </span>
                      {(note.tags || []).slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded"
                          style={{ fontSize: 11, fontWeight: 500, background: getTagColor(tag) + '18', color: getTagColor(tag) }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))
        )}

        {/* Show hidden toggle */}
        <button
          onClick={() => setShowHidden(!showHidden)}
          className="w-full text-center py-2 text-xs"
          style={{ color: theme.gray3 }}
        >
          {showHidden ? 'Скрыть скрытые' : 'Показать скрытые'}
        </button>

        {/* Add buttons */}
        <div className="flex gap-2 items-center">
          <button
            onClick={onAdd}
            className="flex-1 py-3.5 rounded-xl text-white text-base font-semibold"
            style={{ background: theme.accent }}
          >
            ＋ Заметка
          </button>
          <VoiceAddButton
            theme={theme}
            hint="Надиктуйте заметку"
            onResult={async (text) => {
              if (text.trim()) {
                await addNote({ title: '', content: text.trim(), type: 'note' });
                load();
              }
            }}
          />
        </div>
      </div>
    </ScreenWrapper>
  );
}
