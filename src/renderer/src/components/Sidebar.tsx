import { CalendarDays, Download, FolderKanban, Inbox, ListTodo, Tag, Upload } from 'lucide-react'
import { useState } from 'react'
import type { ImportPreview } from '../../../shared/import'
import type { ViewId } from '../../../shared/schema'
import { sortProjects, useAppStore } from '../store/useAppStore'
import ImportDialog from './ImportDialog'
import clsx from 'clsx'

const mainViews: Array<{ id: ViewId; label: string; icon: typeof Inbox }> = [
  { id: 'today', label: 'Сегодня', icon: CalendarDays },
  { id: 'inbox', label: 'Входящие', icon: Inbox },
  { id: 'all', label: 'Все задачи', icon: ListTodo }
]

export default function Sidebar(): JSX.Element {
  const { data, activeView, setActiveView } = useAppStore()
  const projects = sortProjects(data.projects)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)

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
              {label}
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
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setActiveView(viewId)}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
                    activeView === viewId
                      ? 'bg-accent-muted text-blue-300'
                      : 'text-gray-300 hover:bg-surface-border/60'
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <FolderKanban size={16} />
                  <span className="truncate">{project.name}</span>
                </button>
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
    </>
  )
}