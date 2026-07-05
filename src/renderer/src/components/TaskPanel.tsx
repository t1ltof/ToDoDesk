import { Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ViewId } from '../../../shared/schema'
import { clearCompletedTasks, createRootTask, reorderTasks } from '../utils/taskHelpers'
import { filterTasksForView, useAppStore } from '../store/useAppStore'
import ProjectDialog from './ProjectDialog'
import TaskDetail from './TaskDetail'
import TaskItem from './TaskItem'

const viewTitles: Record<string, string> = {
  today: 'Сегодня',
  inbox: 'Входящие',
  all: 'Все задачи',
  completed: 'Выполненные задачи'
}

function getViewTitle(view: ViewId, projectName?: string): string {
  if (view.startsWith('project:')) return projectName ?? 'Проект'
  return viewTitles[view] ?? 'Задачи'
}

const DRAG_VIEWS: ViewId[] = ['all', 'inbox', 'today', 'completed']

export default function TaskPanel(): JSX.Element {
  const { data, activeView, searchQuery, setSearchQuery, persist, selectedTaskId } = useAppStore()
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const projectName = activeView.startsWith('project:')
    ? data.projects.find((p) => p.id === activeView.replace('project:', ''))?.name
    : undefined

  const tasks = useMemo(
    () => filterTasksForView(data, activeView, searchQuery),
    [data, activeView, searchQuery]
  )

  const isCompletedView = activeView === 'completed'
  const canDrag = DRAG_VIEWS.includes(activeView) || activeView.startsWith('project:')

  const addTask = async (): Promise<void> => {
    const title = newTaskTitle.trim()
    if (!title || isCompletedView) return

    const projectId = activeView.startsWith('project:')
      ? activeView.replace('project:', '')
      : null

    const dueDate = activeView === 'today' ? new Date().toISOString().slice(0, 10) : null
    const next = createRootTask(data, { title, projectId, dueDate })
    await persist(next)
    setNewTaskTitle('')
  }

  const handleClearCompleted = async (): Promise<void> => {
    const count = data.tasks.filter((task) => task.status === 'done').length
    if (count === 0) return
    if (!confirm(`Удалить ${count} выполненных задач навсегда?`)) return
    await persist(clearCompletedTasks(data))
  }

  const handleDrop = async (targetId: string): Promise<void> => {
    if (!draggingId || draggingId === targetId) return

    const ids = tasks.map((task) => task.id)
    const fromIndex = ids.indexOf(draggingId)
    const toIndex = ids.indexOf(targetId)
    if (fromIndex < 0 || toIndex < 0) return

    const reordered = [...ids]
    reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, draggingId)

    await persist(reorderTasks(data, reordered))
    setDraggingId(null)
  }

  return (
    <section className="flex h-full flex-1 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold">{getViewTitle(activeView, projectName)}</h2>
            <p className="text-sm text-gray-400">{tasks.length} задач</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск..."
                className="rounded-lg border border-surface-border bg-surface-elevated py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
              />
            </div>
            {isCompletedView ? (
              <button
                type="button"
                onClick={() => void handleClearCompleted()}
                className="inline-flex items-center gap-1 rounded-lg border border-red-800/50 px-3 py-2 text-sm text-red-300 hover:bg-red-950/30"
              >
                <Trash2 size={16} />
                Очистить
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowProjectDialog(true)}
                className="rounded-lg border border-surface-border px-3 py-2 text-sm text-gray-300 hover:bg-surface-elevated"
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
                onChange={(event) => setNewTaskTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void addTask()
                }}
                placeholder="Новая задача..."
                className="flex-1 rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => void addTask()}
                className="inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                <Plus size={16} />
                Добавить
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-surface-border px-6 py-12 text-center text-gray-400">
              {isCompletedView
                ? 'Выполненных задач пока нет.'
                : 'Задач пока нет. Добавьте первую задачу выше.'}
            </div>
          ) : (
            tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                view={activeView}
                draggable={canDrag}
                onDragStart={setDraggingId}
                onDrop={(targetId) => void handleDrop(targetId)}
              />
            ))
          )}
        </div>
      </div>

      {selectedTaskId && <TaskDetail />}

      {showProjectDialog && <ProjectDialog onClose={() => setShowProjectDialog(false)} />}
    </section>
  )
}