/**
 * B1.2: ProjectsScreen — управление проектами.
 */
import { useState, useEffect, useCallback } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import ConfirmSheet from '../../components/ConfirmSheet';
import ProgressBar from '../../components/ProgressBar';
import {
  getProjects,
  addProject,
  updateProject,
  archiveProject,
  deleteProject,
  getProjectWithTasks,
} from '../../services/projects';

const PROJECT_COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#FF2D55', '#5856D6', '#00C7BE'];
const PROJECT_ICONS = ['📁', '🎯', '💼', '🏠', '📚', '💡', '🚀', '🎨', '🔧', '❤️'];

export default function ProjectsScreen({ theme, onBack, onOpenTask }) {
  const [projects, setProjects] = useState(undefined);
  const [expanded, setExpanded] = useState(null);
  const [expandedTasks, setExpandedTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(PROJECT_COLORS[0]);
  const [formIcon, setFormIcon] = useState(PROJECT_ICONS[0]);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    const all = await getProjects();
    const withCounts = await Promise.all(
      all.map(async (p) => {
        const full = await getProjectWithTasks(p.id);
        const tasks = full?.tasks || [];
        const done = tasks.filter((t) => t.status === 'done').length;
        return { ...p, taskCount: tasks.length, doneCount: done };
      })
    );
    setProjects(withCounts);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleExpand = async (id) => {
    if (expanded === id) {
      setExpanded(null);
      setExpandedTasks([]);
      return;
    }
    setExpanded(id);
    const full = await getProjectWithTasks(id);
    setExpandedTasks(full?.tasks || []);
  };

  /* Form */
  const openCreate = () => {
    setEditId(null);
    setFormName('');
    setFormColor(PROJECT_COLORS[0]);
    setFormIcon(PROJECT_ICONS[0]);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditId(p.id);
    setFormName(p.name);
    setFormColor(p.color || PROJECT_COLORS[0]);
    setFormIcon(p.icon || PROJECT_ICONS[0]);
    setShowForm(true);
  };

  const handleSaveForm = async () => {
    if (!formName.trim()) return;
    if (editId) {
      await updateProject(editId, { name: formName.trim(), color: formColor, icon: formIcon });
    } else {
      await addProject({ name: formName.trim(), color: formColor, icon: formIcon });
    }
    setShowForm(false);
    await load();
  };

  const handleArchive = (p) => {
    setConfirm({
      title: `Архивировать «${p.name}»?`,
      message: 'Проект будет скрыт, задачи сохранятся.',
      label: 'Архивировать',
      action: async () => { await archiveProject(p.id); await load(); },
    });
  };

  const handleDelete = (p) => {
    setConfirm({
      title: `Удалить «${p.name}»?`,
      message: `Задачи (${p.taskCount}) будут откреплены от проекта. Это нельзя отменить.`,
      label: 'Удалить',
      action: async () => { await deleteProject(p.id); await load(); },
    });
  };

  const active = (projects || []).filter((p) => p.status !== 'archived');
  const archived = (projects || []).filter((p) => p.status === 'archived');

  return (
    <div className="flex flex-col h-full">
      <NavHeader
        title="Проекты"
        onBack={onBack}
        right={
          <button onClick={openCreate}
            style={{ color: theme.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            ＋
          </button>
        }
        theme={theme}
      />

      <div className="flex-1 overflow-auto px-4 pb-24">
        {projects === undefined ? (
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: theme.gray5 }} />
            ))}
          </div>
        ) : active.length === 0 && archived.length === 0 ? (
          <EmptyState
            icon="📁"
            title="Нет проектов"
            subtitle="Группируйте задачи по проектам"
            actionLabel="＋ Создать проект"
            onAction={openCreate}
            theme={theme}
          />
        ) : (
          <>
            {active.map((p) => (
              <div key={p.id} className="mb-3">
                <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
                  {/* Project header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderLeft: `4px solid ${p.color || theme.accent}`, cursor: 'pointer' }}
                    onClick={() => handleExpand(p.id)}
                  >
                    <span className="text-xl">{p.icon || '📁'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: theme.text }}>
                        {p.name}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: theme.gray2 }}>
                        {p.taskCount} задач{p.taskCount === 1 ? 'а' : p.taskCount < 5 ? 'и' : ''} · {p.doneCount} выполнено
                      </div>
                      {p.taskCount > 0 && (
                        <div className="mt-1.5">
                          <ProgressBar value={p.doneCount} max={p.taskCount} theme={theme} />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-xs"
                        style={{ background: theme.gray6, border: 'none', cursor: 'pointer' }}>✏️</button>
                      <button onClick={(e) => { e.stopPropagation(); handleArchive(p); }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-xs"
                        style={{ background: theme.gray6, border: 'none', cursor: 'pointer' }}>📦</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-xs"
                        style={{ background: theme.red + '10', border: 'none', cursor: 'pointer' }}>🗑</button>
                    </div>
                    <span className="text-xs" style={{ color: theme.gray3 }}>
                      {expanded === p.id ? '▼' : '›'}
                    </span>
                  </div>

                  {/* Expanded task list */}
                  {expanded === p.id && (
                    <div style={{ borderTop: `0.5px solid ${theme.gray5}` }}>
                      {expandedTasks.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-center" style={{ color: theme.gray2 }}>
                          Нет задач в проекте
                        </div>
                      ) : expandedTasks.map((t, i) => {
                        const isDone = t.status === 'done';
                        return (
                          <div key={t.id}
                            className="flex items-center gap-3 px-4 py-2.5"
                            style={{
                              borderTop: i > 0 ? `0.5px solid ${theme.gray5}` : 'none',
                              cursor: 'pointer',
                            }}
                            onClick={() => onOpenTask?.(t.id)}
                          >
                            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                              style={{
                                border: isDone ? 'none' : `1.5px solid ${theme.gray3}`,
                                background: isDone ? theme.green : 'transparent',
                              }}>
                              {isDone && <span className="text-white text-[9px]">✓</span>}
                            </div>
                            <span className="flex-1 text-sm truncate"
                              style={{
                                color: isDone ? theme.gray2 : theme.text,
                                textDecoration: isDone ? 'line-through' : 'none',
                              }}>
                              {t.title}
                            </span>
                            {t.deadline && (
                              <span className="text-[10px]" style={{ color: theme.gray2 }}>
                                📅 {t.deadline}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>
            ))}

            {/* Archived section */}
            {archived.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wide mb-2 px-1" style={{ color: theme.gray2 }}>
                  Архив ({archived.length})
                </div>
                {archived.map((p) => (
                  <Card key={p.id} theme={theme} style={{ marginBottom: 8, opacity: 0.6 }}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{p.icon}</span>
                      <span className="flex-1 text-sm" style={{ color: theme.gray2 }}>{p.name}</span>
                      <button onClick={() => handleDelete(p)}
                        className="text-[10px] px-2 py-1 rounded"
                        style={{ color: theme.red, background: 'none', border: 'none', cursor: 'pointer' }}>
                        Удалить
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Create button at bottom */}
            <button onClick={openCreate}
              className="w-full py-3 rounded-xl text-sm font-medium mt-2"
              style={{ background: theme.accent + '12', color: theme.accent, border: `1px dashed ${theme.accent}40`, cursor: 'pointer' }}>
              ＋ Новый проект
            </button>
          </>
        )}
      </div>

      {/* Inline form sheet */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowForm(false)}>
          <div className="w-full rounded-t-2xl p-5 pb-8" style={{ background: theme.card }}
            onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold mb-4" style={{ color: theme.text }}>
              {editId ? 'Редактировать проект' : 'Новый проект'}
            </div>

            {/* Name */}
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Название проекта"
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4"
              style={{ background: theme.gray6, color: theme.text, border: 'none' }}
            />

            {/* Color picker */}
            <div className="text-xs font-semibold mb-2" style={{ color: theme.gray1 }}>Цвет</div>
            <div className="flex gap-2 mb-4">
              {PROJECT_COLORS.map((c) => (
                <button key={c} onClick={() => setFormColor(c)}
                  className="w-8 h-8 rounded-full"
                  style={{
                    background: c,
                    border: formColor === c ? '3px solid ' + theme.text : '2px solid transparent',
                    cursor: 'pointer',
                    boxShadow: formColor === c ? `0 0 0 2px ${theme.card}` : 'none',
                  }}
                />
              ))}
            </div>

            {/* Icon picker */}
            <div className="text-xs font-semibold mb-2" style={{ color: theme.gray1 }}>Иконка</div>
            <div className="flex gap-2 mb-5 flex-wrap">
              {PROJECT_ICONS.map((ic) => (
                <button key={ic} onClick={() => setFormIcon(ic)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                  style={{
                    background: formIcon === ic ? theme.accent + '15' : theme.gray6,
                    border: formIcon === ic ? `1.5px solid ${theme.accent}` : '1px solid transparent',
                    cursor: 'pointer',
                  }}>
                  {ic}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ background: theme.gray6, color: theme.text, border: 'none', cursor: 'pointer' }}>
                Отмена
              </button>
              <button onClick={handleSaveForm}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: formName.trim() ? theme.accent : theme.gray5,
                  color: formName.trim() ? '#fff' : theme.gray3,
                  border: 'none',
                  cursor: formName.trim() ? 'pointer' : 'default',
                }}>
                {editId ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm sheet */}
      <ConfirmSheet
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.label}
        onConfirm={async () => { await confirm?.action(); }}
        theme={theme}
      />
    </div>
  );
}
