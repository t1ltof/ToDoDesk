import { Columns3, List, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ViewId } from '../../../shared/schema'
import { clearCompletedTasks, createRootTask, reorderTasks } from '../utils/taskHelpers'
import { filterTasksForView, useAppStore } from '../store/useAppStore'
import ProjectDialog from './ProjectDialog'
import TaskItem from './TaskItem'
import clsx from 'clsx'

const viewTitles: Record<string, string> = {
  today: 'Сегодня',
  inbox: 'Входящие',
  all: 'Все задачи',
  completed: 'Выполненные задачи'
}

function getViewTitle(view: ViewId, data: ReturnType<typeof useAppStore.getState>['data']): string {
  if (view.startsWith('project:')) {
    return data.projects.find((p) => p.id === view.replace('project:', ''))?.name ?? 'Проект'
  }
  if (view.startsWith('tag:')) {
    const tag = data.tags.find((t) => t.id === view.replace('tag:', ''))
    return tag ? `#${tag.name}` : 'Тег'
  }
  return viewTitles[view] ?? 'Задачи'
}

export default function TaskPanel(): JSX.Element {
  const { data, activeView, searchQuery, setSearchQuery, persist, setActiveView } = useAppStore()
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const tasks = useMemo(
    () => filterTasksForView(data, activeView, searchQuery),
    [data, activeView, searchQuery]
  )

  const isCompletedView = activeView === 'completed'
  const isProject = activeView.startsWith('project:')
  const canDrag = !isCompletedView

  const addTask = async (): Promise<void> => {
    const title = newTaskTitle.trim()
    if (!title || isCompletedView) return

    const projectId = activeView.startsWith('project:')
      ? activeView.replace('project:', '')
      : activeView.startsWith('tag:')
        ? null
        : null

    const dueDate = activeView === 'today' ? new Date().toISOString().slice(0, 10) : null
    await persist(createRootTask(data, { title, projectId, dueDate }))
    setNewTaskTitle('')
  }

  const handleClearCompleted = async (): Promise<void> => {
    const count = data.tasks.filter((t) => t.status === 'done').length
    if (!count || !confirm(`Удалить ${count} выполненных задач?`)) return
    await persist(clearCompletedTasks(data))
  }

  const handleDrop = async (targetId: string): Promise<void> => {
    if (!draggingId || draggingId === targetId) return
    const ids = tasks.map((t) => t.id)
    const from = ids.indexOf(draggingId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    const reordered = [...ids]
    reordered.splice(from, 1)
    reordered.splice(to, 0, draggingId)
    await persist(reorderTasks(data, reordered))
    setDraggingId(null)
  }

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-surface-border px-6 py-4">
        <div>
          <h2 className="text-xl font-semibold">{getViewTitle(activeView, data)}</h2>
          <p className="text-sm text-gray-400">{tasks.length} задач</p>
        </div>
        <div className="flex items-center gap-2">
          {isProject && (
            <div className="flex rounded-lg border border-surface-border">
              <button
                type="button"
                onClick={() => setActiveView(activeView)}
                className={clsx('p-2', activeView.startsWith('project:') && 'bg-accent-muted text-blue-300')}
              >
                <List size={16} />
              </button>
              <button
                type="button"
                onClick={() => setActiveView(`kanban:${activeView.replace('project:', '')}`)}
                className="p-2 text-gray-400 hover:text-gray-200"
              >
                <Columns3 size={16} />
              </button>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск..."
              className="rounded-lg border border-surface-border bg-surface-elevated py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          {isCompletedView ? (
            <button
              type="button"
              onClick={() => void handleClearCompleted()}
              className="inline-flex items-center gap-1 rounded-lg border border-red-800/50 px-3 py-2 text-sm text-red-300"
            >
              <Trash2 size={16} /> Очистить
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowProjectDialog(true)}
              className="rounded-lg border border-surface-border px-3 py-2 text-sm text-gray-300"
            >
              + Проект
            </button>
          )}
        </div>
      </header>

      {!isCompletedView && (
        <div className="border-b border-surface-border px-6 py-3">
          <div className="flex gap-2">
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void addTask()}
              placeholder="Новая задача..."
              className="flex-1 rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => void addTask()}
              className="inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              <Plus size={16} /> Добавить
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border px-6 py-12 text-center text-gray-400">
            {isCompletedView ? 'Выполненных задач нет' : 'Задач нет — добавьте первую'}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              view={activeView}
              draggable={canDrag}
              onDragStart={setDraggingId}
              onDrop={(id) => void handleDrop(id)}
            />
          ))
        )}
      </div>

      {showProjectDialog && <ProjectDialog onClose={() => setShowProjectDialog(false)} />}
    </section>
  )
}