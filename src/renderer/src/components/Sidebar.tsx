import {
  CalendarDays,
  CheckCircle2,
  Download,
  FolderKanban,
  Inbox,
  ListTodo,
  Pencil,
  Tag,
  Upload
} from 'lucide-react'
import { useState } from 'react'
import type { ImportPreview } from '../../../shared/import'
import type { Project, ViewId } from '../../../shared/schema'
import { countCompletedTasks, sortProjects, useAppStore } from '../store/useAppStore'
import ImportDialog from './ImportDialog'
import ProjectDialog from './ProjectDialog'
import clsx from 'clsx'

const mainViews: Array<{ id: ViewId; label: string; icon: typeof Inbox }> = [
  { id: 'today', label: 'Сегодня', icon: CalendarDays },
  { id: 'inbox', label: 'Входящие', icon: Inbox },
  { id: 'all', label: 'Все задачи', icon: ListTodo },
  { id: 'completed', label: 'Выполненные', icon: CheckCircle2 }
]

export default function Sidebar(): JSX.Element {
  const { data, activeView, setActiveView } = useAppStore()
  const projects = sortProjects(data.projects)
  const completedCount = countCompletedTasks(data)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const handleExport = async (): Promise<void> => {
    await window.tododesk.exportData()
  }

  const handleImportClick = async (): Promise<void> => {
    const preview = await window.tododesk.pickImportFile()
    if (preview) setImportPreview(preview)
  }

  return (
    <>
      <aside className="flex h-full w-64 flex-col border-r border-surface-border bg-surface-elevated">
        <div className="border-b border-surface-border px-5 py-4">
          <h1 className="text-lg font-semibold tracking-tight">ToDoDesk</h1>
          <p className="text-xs text-gray-400">Планировщик задач</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {mainViews.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveView(id)}
              className={clsx(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
                activeView === id
                  ? 'bg-accent-muted text-blue-300'
                  : 'text-gray-300 hover:bg-surface-border/60'
              )}
            >
              <Icon size={16} />
              <span className="flex-1 text-left">{label}</span>
              {id === 'completed' && completedCount > 0 && (
                <span className="rounded-full bg-surface-border px-2 py-0.5 text-xs text-gray-400">
                  {completedCount}
                </span>
              )}
            </button>
          ))}

          <div className="px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-gray-500">
            Проекты
          </div>

          {projects.length === 0 ? (
            <p className="px-3 text-xs text-gray-500">Пока нет проектов</p>
          ) : (
            projects.map((project) => {
              const viewId: ViewId = `project:${project.id}`
              return (
                <div key={project.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveView(viewId)}
                    className={clsx(
                      'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
                      activeView === viewId
                        ? 'bg-accent-muted text-blue-300'
                        : 'text-gray-300 hover:bg-surface-border/60'
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <FolderKanban size={16} />
                    <span className="truncate">{project.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProject(project)}
                    className="rounded p-1.5 text-gray-500 opacity-0 transition hover:bg-surface-border/60 hover:text-gray-300 group-hover:opacity-100"
                    title="Редактировать проект"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              )
            })
          )}

          {data.tags.length > 0 && (
            <>
              <div className="px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-gray-500">
                Теги
              </div>
              {data.tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400"
                >
                  <Tag size={12} />
                  #{tag.name}
                </div>
              ))}
            </>
          )}
        </nav>

        <div className="space-y-1 border-t border-surface-border p-3">
          <button
            type="button"
            onClick={() => void handleExport()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-surface-border/60"
          >
            <Download size={16} />
            Экспорт
          </button>
          <button
            type="button"
            onClick={() => void handleImportClick()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-surface-border/60"
          >
            <Upload size={16} />
            Импорт
          </button>
        </div>
      </aside>

      {importPreview && (
        <ImportDialog preview={importPreview} onClose={() => setImportPreview(null)} />
      )}

      {editingProject && (
        <ProjectDialog project={editingProject} onClose={() => setEditingProject(null)} />
      )}
    </>
  )
}