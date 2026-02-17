import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, ResponsiveContainer } from 'recharts';
import Card from '../../components/Card';
import ChipBar from '../../components/ChipBar';
import EmptyState from '../../components/EmptyState';
import { getTasks, addTask, toggleTask, deleteTask, updateTask, groupTasks, getProductivityStats } from '../../services/tasks';
import { getActiveProjects } from '../../services/projects';
import VoiceAddButton from '../../components/VoiceAddButton';
import RowMetaLine from '../../components/RowMetaLine';
import CalendarView from './CalendarView';
import TutorialTip from '../../components/TutorialTip';
import SkeletonCard from '../../components/SkeletonCard';

const PRIORITY_COLORS = {
  urgent: '#FF3B30',
  important: '#FF9500',
  normal: '#007AFF',
  low: '#AEAEB2',
};

export default function TasksList({ theme, onNavigate, initialView, onToast }) {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [view, setView] = useState(initialView || 'list');
  const [filter, setFilter] = useState('all');
  const [prodStats, setProdStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assignSheet, setAssignSheet] = useState(null); // taskId for quick-assign

  const load = async () => {
    const all = await getTasks();
    setTasks(all);
    // B2.4: productivity stats
    try {
      const stats = await getProductivityStats();
      setProdStats(stats);
    } catch { setProdStats(null); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { getActiveProjects().then(setProjects).catch(() => {}); }, []);

  /* M4.6: bounce animation state */
  const [bounceId, setBounceId] = useState(null);

  const handleToggle = async (id, e) => {
    e.stopPropagation();
    setBounceId(id);
    setTimeout(() => setBounceId(null), 400);
    await toggleTask(id);
    load();
  };

  /* B1.4: Quick-assign project */
  const handleAssignProject = async (taskId, projectId) => {
    await updateTask(taskId, { project_id: projectId });
    setAssignSheet(null);
    load();
  };

  /* M3.2: Undo delete */
  const handleDelete = async (id) => {
    const task = tasks.find(t => t.id === id);
    await deleteTask(id);
    load();
    if (task && onToast) {
      onToast({
        text: `🗑 «${task.title}» удалена`,
        action: {
          label: 'Отмена',
          onClick: async () => {
            const { id: _, ...rest } = task;
            await addTask(rest);
            load();
          },
        },
      });
    }
  };

  const groups = (() => {
    const d = new Date().toISOString().split('T')[0];
    const filtered = tasks.filter(t => {
      switch (filter) {
        case 'inbox': return t.status !== 'done' && !t.project_id;
        case 'projects': return t.status !== 'done' && !!t.project_id;
        case 'today': return t.status !== 'done' && t.deadline === d;
        case 'upcoming': return t.status !== 'done' && t.deadline && t.deadline > d;
        case 'someday': return t.status !== 'done' && !t.deadline;
        case 'done': return t.status === 'done';
        default: return true;
      }
    });
    if (filter === 'done') {
      const sorted = [...filtered].sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
      return sorted.length ? [{ label: 'Выполнено', items: sorted, type: 'done' }] : [];
    }
    if (filter === 'projects') {
      // Group by project
      const byProject = {};
      for (const t of filtered) {
        const pid = t.project_id;
        if (!byProject[pid]) {
          const p = projects.find(pr => pr.id === pid);
          byProject[pid] = { label: p ? `${p.icon || '📁'} ${p.name}` : 'Проект', items: [], type: `project-${pid}` };
        }
        byProject[pid].items.push(t);
      }
      return Object.values(byProject);
    }
    return groupTasks(filtered);
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-2 pb-1">
        <h1 className="font-bold" style={{ color: theme.text, fontSize: 28 }}>Задачи</h1>
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${theme.gray4}` }}>
          {[['list', '☰'], ['calendar', '📅'], ['kanban', '▦']].map(([v, icon]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-2.5 py-1 text-xs font-medium"
              style={{
                background: view === v ? theme.accent : 'transparent',
                color: view === v ? '#fff' : theme.gray1,
              }}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Smart filters */}
      <div className="px-4 pb-2">
        <ChipBar
          chips={[
            { id: 'all', label: 'Все' },
            { id: 'inbox', label: '📥 Inbox' },
            { id: 'projects', label: '📁 Проекты' },
            { id: 'today', label: 'Сегодня' },
            { id: 'upcoming', label: 'Предстоящие' },
            { id: 'someday', label: 'Когда-нибудь' },
            { id: 'done', label: 'Выполнено' },
          ]}
          active={filter}
          onChange={setFilter}
          theme={theme}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 pb-24">

        <TutorialTip id="tasks_intro" theme={theme} icon="✅">
          Фильтры вверху сортируют задачи. Свайпните задачу влево для удаления. Нажмите + для новой задачи.
        </TutorialTip>

        {loading ? (
          <div className="space-y-3">
            <SkeletonCard theme={theme} />
            <SkeletonCard variant="compact" theme={theme} />
            <SkeletonCard variant="compact" theme={theme} />
            <SkeletonCard variant="compact" theme={theme} />
          </div>
        ) : (
        <>
        {/* B2.4: Productivity card */}
        {prodStats && (prodStats.thisWeek > 0 || prodStats.streak > 0) && view === 'list' && (
          <Card theme={theme} style={{ marginBottom: 16 }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: theme.gray1 }}>
              📊 Продуктивность
            </div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-center flex-1">
                <div className="text-lg font-bold tabular-nums" style={{ color: theme.text }}>
                  {prodStats.thisWeek}
                </div>
                <div className="text-[10px]" style={{ color: theme.gray2 }}>за неделю</div>
              </div>
              <div className="text-center flex-1">
                <div className="text-lg font-bold tabular-nums" style={{ color: theme.text }}>
                  {prodStats.thisMonth}
                </div>
                <div className="text-[10px]" style={{ color: theme.gray2 }}>за месяц</div>
              </div>
              <div className="text-center flex-1">
                <div className="text-lg font-bold tabular-nums" style={{ color: theme.orange }}>
                  🔥 {prodStats.streak}
                </div>
                <div className="text-[10px]" style={{ color: theme.gray2 }}>Streak</div>
              </div>
              <div className="text-center flex-1">
                <div className="text-lg font-bold tabular-nums" style={{ color: theme.gray1 }}>
                  {prodStats.total}
                </div>
                <div className="text-[10px]" style={{ color: theme.gray2 }}>всего</div>
              </div>
            </div>
            {prodStats.byDay && prodStats.byDay.length > 0 && (
              <ResponsiveContainer width="100%" height={60}>
                <BarChart data={prodStats.byDay}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: theme.gray2 }} axisLine={false} tickLine={false} />
                  <Bar dataKey="count" fill={theme.accent} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        )}

        {view === 'calendar' ? (
          <CalendarView
            tasks={tasks}
            theme={theme}
            onTap={(id) => onNavigate('taskDetail', { taskId: id })}
            onToggle={async (id) => { await toggleTask(id); load(); }}
          />
        ) : view === 'kanban' ? (
          <KanbanView tasks={tasks} theme={theme} onToggle={handleToggle} onTap={(id) => onNavigate('taskDetail', { taskId: id })} onRefresh={load} />
        ) : (
          <>
            {groups.map(group => (
              <div key={group.type} className="mb-4">
                <div className="flex items-center gap-2 px-1 py-2">
                  <span className="text-xs font-semibold uppercase" style={{ color: theme.gray1 }}>
                    {group.label}
                  </span>
                  <span className="text-xs" style={{ color: theme.gray2 }}>({group.items.length})</span>
                  {group.type === 'overdue' && <span>🔴</span>}
                </div>
                <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
                  {group.items.map((task, i) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      theme={theme}
                      isLast={i === group.items.length - 1}
                      onToggle={(e) => handleToggle(task.id, e)}
                      onTap={() => onNavigate('taskDetail', { taskId: task.id })}
                      onDelete={() => handleDelete(task.id)}
                      isBouncing={bounceId === task.id}
                      onAssign={filter === 'inbox' && projects.length > 0 ? (id) => setAssignSheet(id) : undefined}
                    />
                  ))}
                </Card>
              </div>
            ))}

            {tasks.length === 0 && (
              <EmptyState
                icon="📋"
                title="Нет задач"
                subtitle="Создайте первую задачу"
                tip="Попробуйте режим Канбан для управления проектами"
                actionLabel="+ Задача"
                onAction={() => onNavigate('taskForm')}
                theme={theme}
              />
            )}
          </>
        )}

        {/* B1.4: Manage projects link */}
        {filter === 'projects' && (
          <button onClick={() => onNavigate('projects')}
            className="w-full py-3 rounded-xl text-sm font-medium mt-2"
            style={{ background: theme.accent + '12', color: theme.accent, border: `1px dashed ${theme.accent}40`, cursor: 'pointer' }}>
            ⚙️ Управление проектами
          </button>
        )}

        {/* Add button */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onNavigate('taskForm')}
            className="flex-1 py-3.5 rounded-xl text-white text-base font-semibold"
            style={{ background: theme.accent }}
          >
            ＋ Новая задача
          </button>
          <VoiceAddButton
            theme={theme}
            hint="Скажите задачу"
            onResult={async (text) => {
              if (text.trim()) {
                await addTask({ title: text.trim() });
                load();
              }
            }}
          />
        </div>
        </>
        )}
      </div>

      {/* B1.4: Project assign sheet */}
      {assignSheet && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setAssignSheet(null)}>
          <div className="w-full rounded-t-2xl p-4 pb-8" style={{ background: theme.card }}
            onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold mb-3" style={{ color: theme.text }}>В какой проект?</div>
            <div className="space-y-1">
              {projects.map(p => (
                <button key={p.id} onClick={() => handleAssignProject(assignSheet, p.id)}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm"
                  style={{ background: theme.gray6, color: theme.text, border: 'none', cursor: 'pointer' }}>
                  {p.icon || '📁'} {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Task Row with swipe-to-delete ──
const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function formatRecurrence(rec) {
  if (!rec) return '';
  switch (rec.type) {
    case 'daily': return 'Каждый день';
    case 'weekly': return 'Каждую неделю';
    case 'monthly': return 'Каждый месяц';
    case 'weekdays': return (rec.days || []).map(d => WEEKDAYS_SHORT[d - 1]).join(', ');
    default: return '';
  }
}

function TaskRow({ task, theme, isLast, onToggle, onTap, onDelete, isBouncing, onAssign }) {
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const swiping = useRef(false);

  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; swiping.current = false; };
  const onTouchMove = (e) => {
    const dx = e.touches[0].clientX - startX.current;
    if (dx < -10) { swiping.current = true; setSwipeX(Math.max(dx, -80)); }
    else setSwipeX(0);
  };
  const onTouchEnd = () => {
    if (swipeX < -60) onDelete();
    setSwipeX(0);
  };

  const isDone = task.status === 'done';
  const subtasksDone = (task.subtasks || []).filter(s => s.done).length;
  const subtasksTotal = (task.subtasks || []).length;

  const isOverdue = !isDone && task.deadline && task.deadline < new Date().toISOString().split('T')[0];

  return (
    <div className="relative overflow-hidden" style={{ borderBottom: !isLast ? `0.5px solid ${theme.gray5}` : 'none' }}>
      <div className="absolute inset-y-0 right-0 flex items-center px-5" style={{ background: theme.red }}>
        <span className="text-white text-sm font-semibold">Удалить</span>
      </div>
      <div
        className="flex items-center gap-3 px-4 py-3 relative"
        style={{
          background: isOverdue ? (theme.red || '#FF3B30') + '06' : theme.card,
          transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? 'transform 0.2s' : 'none',
        }}
        onClick={() => !swiping.current && onTap()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: PRIORITY_COLORS[task.priority] }} />
        <button
          onClick={onToggle}
          className="flex items-center justify-center shrink-0"
          style={{
            width: 22, height: 22, borderRadius: 11,
            border: isDone ? 'none' : `2.5px solid ${PRIORITY_COLORS[task.priority] || '#007AFF'}`,
            background: isDone ? theme.green : 'transparent',
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s',
            transform: isBouncing ? 'scale(1.4)' : 'scale(1)',
          }}
        >
          {isDone && <span className="text-white text-xs">✓</span>}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {task.priority === 'urgent' && !isDone && <span className="text-xs">⚠️</span>}
            {task.recurrence && <span className="text-xs" style={{ color: theme.accent }}>🔄</span>}
            <span
              className="font-medium truncate"
              style={{ color: isDone ? theme.gray2 : theme.text, textDecoration: isDone ? 'line-through' : 'none', fontSize: 15 }}
            >
              {task.title}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <RowMetaLine theme={theme} items={[
              task.deadline && {
                icon: task.deadline < new Date().toISOString().split('T')[0] && !isDone ? '⚠️' : '📅',
                label: `${task.deadline_time || ''} ${formatDeadline(task.deadline)}`.trim(),
                color: task.deadline < new Date().toISOString().split('T')[0] && !isDone ? theme.red : undefined,
              },
              task.recurrence && { icon: '🔄', label: formatRecurrence(task.recurrence) },
              ...(task.tags || []).map(tag => ({ icon: '🏷', label: tag })),
              subtasksTotal > 0 && { label: `${subtasksDone}/${subtasksTotal}`, icon: subtasksDone === subtasksTotal ? '✅' : '○' },
              task.project && { label: task.project, icon: '📁' },
            ].filter(Boolean)} />
          </div>
          {/* B2.3: subtask progress bar */}
          {subtasksTotal > 0 && !isDone && (
            <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: theme.gray5, maxWidth: 120 }}>
              <div className="h-full rounded-full" style={{
                width: `${(subtasksDone / subtasksTotal) * 100}%`,
                background: subtasksDone === subtasksTotal ? theme.green : theme.accent,
                transition: 'width 0.3s',
              }} />
            </div>
          )}
        </div>
        {onAssign && (
          <button onClick={(e) => { e.stopPropagation(); onAssign(task.id); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0"
            style={{ background: theme.accent + '10', border: 'none', cursor: 'pointer' }}>📁</button>
        )}
        {isOverdue && (
          <span className="text-xs font-bold shrink-0" style={{ color: theme.red }}>!!</span>
        )}
        <span style={{ color: theme.gray3, fontSize: 14 }}>›</span>
      </div>
    </div>
  );
}

// ── Kanban View ──
function KanbanView({ tasks, theme, onTap, onRefresh }) {
  const columns = [
    { status: 'todo', label: 'К выполнению', color: theme.accent },
    { status: 'in_progress', label: 'В работе', color: theme.orange },
    { status: 'done', label: 'Готово', color: theme.green },
  ];

  const changeStatus = async (id, newStatus) => {
    const { updateTask } = await import('../../services/tasks');
    await updateTask(id, {
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    });
    onRefresh();
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-4" style={{ minHeight: 300 }}>
      {columns.map(col => {
        const items = tasks.filter(t => t.status === col.status);
        return (
          <div key={col.status} className="flex-1 min-w-[130px]">
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
              <span className="text-xs font-semibold" style={{ color: theme.gray1 }}>{col.label}</span>
              <span className="text-xs" style={{ color: theme.gray2 }}>{items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map(task => (
                <Card key={task.id} theme={theme} style={{ padding: 10 }} onClick={() => onTap(task.id)}>
                  <div className="text-xs font-medium" style={{ color: theme.text }}>{task.title}</div>
                  {task.deadline && (
                    <div className="text-[10px] mt-1" style={{ color: theme.gray2 }}>{formatDeadline(task.deadline)}</div>
                  )}
                  <div className="flex gap-1 mt-2">
                    {columns.filter(c => c.status !== col.status).map(c => (
                      <button
                        key={c.status}
                        onClick={(e) => { e.stopPropagation(); changeStatus(task.id, c.status); }}
                        className="text-[10px] px-2 py-0.5 rounded"
                        style={{ background: c.color + '20', color: c.color }}
                      >
                        {c.status === 'done' ? '✓' : c.status === 'in_progress' ? '▶' : '←'}
                      </button>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDeadline(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  if (diff === -1) return 'Вчера';
  if (diff < -1) return `${Math.abs(diff)} дн. назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
