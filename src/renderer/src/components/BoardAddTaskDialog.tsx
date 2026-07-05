import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Task } from '../../../shared/schema'
import { useAppStore } from '../store/useAppStore'
import clsx from 'clsx'

interface BoardAddTaskDialogProps {
  onClose: () => void
  onSelect: (task: Task) => void
  existingTaskIds: Set<string>
}

export default function BoardAddTaskDialog({
  onClose,
  onSelect,
  existingTaskIds
}: BoardAddTaskDialogProps): JSX.Element {
  const { data } = useAppStore()
  const [query, setQuery] = useState('')

  const tasks = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.tasks
      .filter((task) => task.parentId === null)
      .filter((task) => !existingTaskIds.has(task.id))
      .filter((task) => !q || task.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  }, [data.tasks, existingTaskIds, query])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-surface-border bg-surface-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <h3 className="font-semibold">Добавить задачу на доску</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-surface-border">
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-surface-border px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface px-3 py-2">
            <Search size={16} className="text-gray-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск задачи..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {tasks.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-500">
              {query ? 'Задачи не найдены' : 'Все задачи уже на доске или список пуст'}
            </p>
          ) : (
            tasks.map((task) => {
              const project = task.projectId
                ? data.projects.find((p) => p.id === task.projectId)
                : null
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onSelect(task)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-surface-border/60"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: project?.color ?? '#6b7280' }}
                  />
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  <span
                    className={clsx(
                      'shrink-0 text-xs',
                      task.status === 'done' ? 'text-green-400' : 'text-gray-500'
                    )}
                  >
                    {task.status === 'done' ? 'Выполнено' : 'Активна'}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}