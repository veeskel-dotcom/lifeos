import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import NavHeader from '../../../components/NavHeader';
import Card from '../../../components/Card';
import { addNote, updateNote, getAllTags } from '../../../services/notes';
import IOSKeyboardSpacer from '../../../components/IOSKeyboardSpacer';
import FormInput from '../../../components/FormInput';
import Ic from '../../../components/Icon';

/* ── I1: Simple Markdown → HTML renderer ── */
function renderMarkdown(md) {
  if (!md) return '';
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:1rem;font-weight:700;margin:0.6em 0 0.3em">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:1.1rem;font-weight:700;margin:0.6em 0 0.3em">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:1.25rem;font-weight:700;margin:0.6em 0 0.3em">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(128,128,128,0.15);padding:1px 4px;border-radius:3px;font-size:0.85em">$1</code>')
    .replace(/^\- (.+)$/gm, '<li style="margin-left:1.2em;list-style:disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:1.2em;list-style:decimal">$1</li>')
    .replace(/^(?:---|___|\*\*\*)$/gm, '<hr style="border:none;border-top:1px solid rgba(128,128,128,0.2);margin:0.8em 0">')
    .replace(/\[(.+?)\]\((.+?)\)/g, (_, text, url) => {
      const safe = /^(https?:|mailto:|tel:|#|\/)/i.test(url) ? url : '#';
      return `<a href="${safe}" style="color:#007AFF;text-decoration:underline">${text}</a>`;
    })
    .replace(/\n/g, '<br>');
}

const MOOD_EMOJIS = ['😫', '😢', '😔', '😕', '😐', '🙂', '😊', '😄', '🤩', '🔥'];

export default function NoteEditor({ theme, onBack, onSave, existing }) {
  const [type, setType] = useState(existing?.type || 'note');
  const [title, setTitle] = useState(existing?.title || '');
  const [content, setContent] = useState(existing?.content || '');
  const [tags, setTags] = useState(existing?.tags || []);
  const [mood, setMood] = useState(existing?.mood || 7);
  const [newTag, setNewTag] = useState('');
  const [allTags, setAllTags] = useState([]);
  const [saveStatus, setSaveStatus] = useState(null);
  const [preview, setPreview] = useState(false); // 'saving' | 'saved' | null
  const contentRef = useRef(null);
  const savedIdRef = useRef(existing?.id || null);
  const timerRef = useRef(null);
  const dataRef = useRef({});

  useEffect(() => {
    getAllTags().then(setAllTags);
  }, []);

  // Keep dataRef current for unmount save
  useEffect(() => {
    dataRef.current = { type, title, content, tags, mood };
  }, [type, title, content, tags, mood]);

  // Debounced autosave — 1.5s after last edit
  useEffect(() => {
    if (!title && !content) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const data = {
        type, title: title.trim(), content,
        tags, mood: type === 'diary' ? mood : null,
      };
      try {
        setSaveStatus('saving');
        if (savedIdRef.current) {
          await updateNote(savedIdRef.current, data);
        } else {
          const id = await addNote(data);
          savedIdRef.current = id;
        }
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 1500);
      } catch { /* silent */ }
    }, 1500);
    return () => clearTimeout(timerRef.current);
  }, [type, title, content, tags, mood]);

  // Save on unmount (best-effort, uses ref for fresh data)
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      const d = dataRef.current;
      if ((d.content || d.title) && savedIdRef.current) {
        updateNote(savedIdRef.current, {
          type: d.type, title: (d.title || '').trim(), content: d.content,
          tags: d.tags, mood: d.type === 'diary' ? d.mood : null,
        }).catch(() => {});
      }
    };
  }, []);

  const addTag = useCallback((tag) => {
    const t = tag.trim().toLowerCase().replace(/^#/, '');
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setNewTag('');
  }, [tags]);

  const removeTag = (tag) => setTags(prev => prev.filter(t => t !== tag));

  const handleSave = async () => {
    clearTimeout(timerRef.current);
    const data = {
      type, title: title.trim(), content,
      tags, mood: type === 'diary' ? mood : null,
    };
    if (savedIdRef.current) {
      await updateNote(savedIdRef.current, data);
    } else {
      const id = await addNote(data);
      savedIdRef.current = id;
    }
    onSave?.();
  };

  const suggested = allTags.filter(t => !tags.includes(t)).slice(0, 4);

  return (
    <div className="flex flex-col gap-3 px-4 pt-2 pb-28">
      <NavHeader
        title={existing ? 'Редактировать' : 'Новая заметка'}
        onBack={onBack}
        theme={theme}
        rightAction={{ label: 'Готово', onClick: handleSave }}
      />

      {saveStatus && (
        <div className="text-xs text-center py-0.5" style={{ color: theme.gray2 }}>
          {saveStatus === 'saving' ? <><Ic name="download" color={theme.gray2} size={12} r={3} raw /> Сохраняю...</> : '✓ Сохранено'}
        </div>
      )}

      {/* Тип */}
      <div className="flex gap-2">
        {[{ v: 'note', l: 'Заметка', icon: 'note' }, { v: 'diary', l: 'Дневник', icon: 'edit' }].map(t => (
          <button
            key={t.v}
            onClick={() => setType(t.v)}
            className="flex-1 py-2 rounded-xl text-sm text-center font-medium"
            style={{
              background: type === t.v ? theme.accent : theme.gray6,
              color: type === t.v ? '#fff' : theme.text,
            }}
          >
            <span className="inline-flex items-center gap-1"><Ic name={t.icon} color={type === t.v ? '#fff' : theme.gray1} size={14} r={3} raw /> {t.l}</span>
          </button>
        ))}
      </div>

      {/* Mood для дневника */}
      {type === 'diary' && (
        <Card theme={theme}>
          <p className="text-xs font-semibold mb-2" style={{ color: theme.gray1 }}>НАСТРОЕНИЕ</p>
          <div className="flex items-center gap-1">
            {MOOD_EMOJIS.map((e, i) => (
              <button
                key={i}
                onClick={() => setMood(i + 1)}
                className="flex-1 text-center text-lg py-1 rounded-lg transition-transform"
                style={{
                  opacity: mood === i + 1 ? 1 : 0.3,
                  transform: mood === i + 1 ? 'scale(1.3)' : 'scale(1)',
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <p className="text-center text-xs mt-1 tabular-nums" style={{ color: theme.gray1 }}>
            {mood}/10
          </p>
        </Card>
      )}

      {/* Date + stats — proto S3 */}
      <div style={{ padding: '0 4px 10px', fontSize: 12, color: theme.gray2 }}>
        {new Date().toLocaleDateString('ru-RU', { weekday: 'long' })}, {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        {content ? ` · ${content.trim().split(/\s+/).filter(Boolean).length} слов` : ''}
      </div>

      {/* Заголовок — proto 24/700 */}
      <input value={title} onChange={e => setTitle(e.target.value)}
        placeholder="Заголовок"
        style={{ fontSize: 24, fontWeight: 700, color: theme.text, background: 'transparent', border: 'none', outline: 'none', width: '100%', padding: 0 }} />

      {/* I1: Markdown edit/preview toggle */}
      <div className="flex items-center justify-between px-1 -mb-1">
        <div className="flex gap-2">
          {['edit', 'preview'].map(m => (
            <button key={m} onClick={() => setPreview(m === 'preview')}
              className="text-xs font-medium px-2 py-0.5 rounded-md"
              style={{
                background: (m === 'preview') === preview ? theme.accent : 'transparent',
                color: (m === 'preview') === preview ? '#fff' : theme.gray2,
              }}>
              {m === 'edit' ? <><Ic name="edit" color={(m === 'preview') === preview ? '#fff' : theme.gray2} size={12} r={3} raw /> Редактор</> : 'Превью'}
            </button>
          ))}
        </div>
        {content && (
          <span className="text-[10px] tabular-nums" style={{ color: theme.gray3 }}>
            {content.length} зн · {content.trim().split(/\s+/).filter(Boolean).length} сл
          </span>
        )}
      </div>

      {preview ? (
        <div
          className="min-h-48 text-sm leading-relaxed px-1"
          style={{ color: theme.text }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      ) : (
        <textarea
          ref={contentRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Текст (поддерживается Markdown)..."
          className="min-h-48 bg-transparent outline-none leading-relaxed px-1 resize-none"
          style={{ color: theme.text, fontSize: 15 }}
          autoFocus={!existing}
        />
      )}

      {/* Теги */}
      <Card theme={theme}>
        <p className="text-xs font-semibold mb-2" style={{ color: theme.gray1 }}>ТЕГИ</p>
        <div className="flex gap-1.5 flex-wrap mb-2">
          {tags.map(t => (
            <button
              key={t}
              onClick={() => removeTag(t)}
              className="cursor-pointer"
              style={{ padding: '4px 10px', borderRadius: 10, fontSize: 12, fontWeight: 500, background: theme.accent + '12', color: theme.accent }}
            >
              #{t} ×
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(newTag); } }}
            placeholder="Добавить тег..."
            className="flex-1 text-sm bg-transparent outline-none"
            style={{ color: theme.text }}
          />
          {newTag && (
            <button onClick={() => addTag(newTag)} className="text-sm font-semibold" style={{ color: theme.accent }}>
              ＋
            </button>
          )}
        </div>
        {/* Предложения */}
        {suggested.length > 0 && (
          <div className="flex gap-1.5 mt-2">
            {suggested.map(t => (
              <button
                key={t}
                onClick={() => addTag(t)}
                className="px-2 py-0.5 rounded-full text-[10px]"
                style={{ background: theme.gray6, color: theme.gray2 }}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </Card>
      {/* Proto S3: bottom toolbar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '10px 16px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 20px))',
        background: theme.card,
        borderTop: `0.5px solid ${theme.gray5}`,
        display: 'flex', gap: 18, justifyContent: 'center',
      }}>
        {['𝐁', '𝐼', '𝐔', 'S̶', 'H1', '📎', '🖼', '📋'].map(b => (
          <span key={b} className="cursor-pointer"
            style={{ fontSize: 16, color: theme.gray1, fontWeight: 500 }}
            onClick={() => {
              if (!contentRef.current) return;
              const map = { '𝐁': '**', '𝐼': '*', '𝐔': '__', 'S̶': '~~', 'H1': '## ' };
              if (map[b]) {
                const w = map[b];
                const s = contentRef.current.selectionStart;
                const e = contentRef.current.selectionEnd;
                const sel = content.substring(s, e);
                const pre = b === 'H1' ? `${w}${sel}` : `${w}${sel}${w}`;
                setContent(content.substring(0, s) + pre + content.substring(e));
              }
            }}>{b}</span>
        ))}
      </div>
      <IOSKeyboardSpacer />
    </div>
  );
}
