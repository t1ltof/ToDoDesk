import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Columns3,
  Download,
  FileSpreadsheet,
  FolderKanban,
  GanttChart,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Pencil,
  Rocket,
  Settings,
  StickyNote,
  Tag,
  Target,
  Timer,
  Upload,
  Zap
} from 'lucide-react'
import { useState } from 'react'
import type { ImportPreview } from '../../../shared/import'
import type { Project, ViewId } from '../../../shared/schema'
import { countCompletedTasks, sortProjects, useAppStore } from '../store/useAppStore'
import ImportDialog from './ImportDialog'
import ProjectDialog from './ProjectDialog'
import TagManageDialog from './TagManageDialog'
import clsx from 'clsx'

const mainViews: Array<{ id: ViewId; label: string; icon: typeof Inbox }> = [
  { id: 'today', label: 'Сегодня', icon: CalendarDays },
  { id: 'inbox', label: 'Входящие', icon: Inbox },
  { id: 'all', label: 'Все задачи', icon: ListTodo },
  { id: 'completed', label: 'Выполненные', icon: CheckCircle2 },
  { id: 'calendar', label: 'Календарь', icon: CalendarDays },
  { id: 'board', label: 'Доска', icon: LayoutDashboard },
  { id: 'notes', label: 'Заметки', icon: StickyNote },
  { id: 'focus', label: 'Фокус', icon: Timer },
  { id: 'timeline', label: 'Таймлайн', icon: GanttChart },
  { id: 'sprint', label: 'Спринты', icon: Rocket },
  { id: 'next', label: 'Следующая задача', icon: Zap },
  { id: 'weekly-review', label: 'Еженедельный обзор', icon: Target },
  { id: 'stats', label: 'Статистика', icon: BarChart3 }
]

interface SidebarProps {
  onOpenSettings: () => void
}

export default function Sidebar({ onOpenSettings }: SidebarProps): JSX.Element {
  const { data, activeView, setActiveView, setSelectedTaskId } = useAppStore()
  const projects = sortProjects(data.projects)
  const completedCount = countCompletedTasks(data)
  const compact = data.settings.sidebarCompact
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editingTagId, setEditingTagId] = useState<string | null>(null)

  const editingTag = editingTagId ? data.tags.find((t) => t.id === editingTagId) : null

  const recentTasks = data.settings.recentTaskIds
    .map((id) => data.tasks.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .slice(0, 10)

  const navButtonClass = (active: boolean): string =>
    clsx(
      'flex w-full items-center rounded-lg text-sm transition',
      compact ? 'justify-center px-2 py-2.5' : 'gap-2 px-3 py-2',
      active ? 'bg-accent-muted text-blue-300' : 'text-gray-300 hover:bg-surface-border/60'
    )

  return (
    <>
      <aside
        className={clsx(
          'flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-surface-border bg-surface-elevated',
          compact ? 'w-16' : 'w-64'
        )}
      >
        <div className={clsx('shrink-0 border-b border-surface-border', compact ? 'px-2 py-3 text-center' : 'px-5 py-4')}>
          <h1 className={clsx('font-semibold tracking-tight', compact ? 'text-sm' : 'text-lg')}>
            {compact ? 'TD' : 'ToDoDesk'}
          </h1>
          {!compact && <p className="text-xs text-gray-400">Планировщик задач</p>}
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3">
          {mainViews.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              title={compact ? label : undefined}
              onClick={() => setActiveView(id)}
              className={navButtonClass(activeView === id)}
            >
              <Icon size={16} />
              {!compact && <span className="flex-1 text-left">{label}</span>}
              {!compact && id === 'completed' && completedCount > 0 && (
                <span className="rounded-full bg-surface-border px-2 py-0.5 text-xs">{completedCount}</span>
              )}
            </button>
          ))}

          {recentTasks.length > 0 && !compact && (
            <>
              <div className="px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-gray-500">
                Недавние
              </div>
              {recentTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedTaskId(task.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-gray-400 transition hover:bg-surface-border/60 hover:text-gray-200"
                  title={task.title}
                >
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                </button>
              ))}
            </>
          )}

          {!compact && (
            <div className="px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-gray-500">
              Проекты
            </div>
          )}

          {projects.length === 0 ? (
            !compact && <p className="px-3 text-xs text-gray-500">Пока нет проектов</p>
          ) : (
            projects.map((project) => {
              const listView: ViewId = `project:${project.id}`
              const kanbanView: ViewId = `kanban:${project.id}`
              const isActive = activeView === listView || activeView === kanbanView
              return (
                <div key={project.id} className={clsx('group flex items-center', compact ? 'gap-0' : 'gap-1')}>
                  <button
                    type="button"
                    title={compact ? project.name : undefined}
                    onClick={() => setActiveView(listView)}
                    className={clsx(
                      'flex min-w-0 flex-1 items-center rounded-lg text-sm transition',
                      compact ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2',
                      isActive ? 'bg-accent-muted text-blue-300' : 'text-gray-300 hover:bg-surface-border/60'
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    {!compact && (
                      <>
                        <FolderKanban size={16} />
                        {project.icon && <span className="shrink-0 text-sm">{project.icon}</span>}
                        <span className="truncate">{project.name}</span>
                      </>
                    )}
                  </button>
                  {!compact && (
                    <>
                      <button
                        type="button"
                        title="Kanban"
                        onClick={() => setActiveView(kanbanView)}
                        className="rounded p-1.5 text-gray-500 opacity-0 hover:text-blue-300 group-hover:opacity-100"
                      >
                        <Columns3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingProject(project)}
                        className="rounded p-1.5 text-gray-500 opacity-0 hover:text-gray-300 group-hover:opacity-100"
                      >
                        <Pencil size={14} />
                      </button>
                    </>
                  )}
                </div>
              )
            })
          )}

          {data.tags.length > 0 && (
            <>
              {!compact && (
                <div className="px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Теги
                </div>
              )}
              {data.tags.map((tag) => (
                <div key={tag.id} className={clsx('group flex items-center', compact ? '' : 'gap-1')}>
                  <button
                    type="button"
                    title={compact ? `#${tag.name}` : undefined}
                    onClick={() => setActiveView(`tag:${tag.id}`)}
                    className={clsx(
                      'flex flex-1 items-center rounded-lg text-xs transition',
                      compact ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-1.5',
                      activeView === `tag:${tag.id}`
                        ? 'bg-accent-muted text-blue-300'
                        : 'text-gray-400 hover:bg-surface-border/60'
                    )}
                  >
                    <Tag size={12} />
                    {!compact && `#${tag.name}`}
                  </button>
                  {!compact && (
                    <button
                      type="button"
                      onClick={() => setEditingTagId(tag.id)}
                      className="rounded p-1 text-gray-600 opacity-0 hover:text-gray-300 group-hover:opacity-100"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </nav>

        {!compact && (
          <div className="shrink-0 border-t border-surface-border px-3 py-2">
            <p className="text-[10px] leading-relaxed text-gray-500">
              Ctrl+N — быстрое добавление · Ctrl+F — поиск · Ctrl+1–7 — виды · Ctrl+Z — отмена
            </p>
          </div>
        )}

        <div className="shrink-0 space-y-1 border-t border-surface-border p-3">
          <button
            type="button"
            title={compact ? 'Настройки' : undefined}
            onClick={onOpenSettings}
            className={navButtonClass(false)}
          >
            <Settings size={16} />
            {!compact && ' Настройки'}
          </button>
          <button
            type="button"
            title={compact ? 'Экспорт' : undefined}
            onClick={() => void window.tododesk.exportData()}
            className={navButtonClass(false)}
          >
            <Download size={16} />
            {!compact && ' Экспорт'}
          </button>
          <button
            type="button"
            title={compact ? 'Экспорт CSV' : undefined}
            onClick={() => void window.tododesk.exportCsv()}
            className={navButtonClass(false)}
          >
            <FileSpreadsheet size={16} />
            {!compact && ' Экспорт CSV'}
          </button>
          <button
            type="button"
            title={compact ? 'Импорт' : undefined}
            onClick={async () => {
              const preview = await window.tododesk.pickImportFile()
              if (preview) setImportPreview(preview)
            }}
            className={navButtonClass(false)}
          >
            <Upload size={16} />
            {!compact && ' Импорт'}
          </button>
        </div>
      </aside>

      {importPreview && <ImportDialog preview={importPreview} onClose={() => setImportPreview(null)} />}
      {editingProject && <ProjectDialog project={editingProject} onClose={() => setEditingProject(null)} />}
      {editingTag && <TagManageDialog tag={editingTag} onClose={() => setEditingTagId(null)} />}
    </>
  )
}