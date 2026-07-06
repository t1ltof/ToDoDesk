import { useMemo } from 'react'
import type { Task } from '../../../shared/schema'
import { localDateKey, todayKey } from '../utils/calendarUtils'
import { useAppStore } from '../store/useAppStore'
import clsx from 'clsx'

function getTimelineDays(count = 30): string[] {
  const start = new Date()
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return localDateKey(date)
  })
}

function getProjectColor(
  data: ReturnType<typeof useAppStore.getState>['data'],
  projectId: string | null
): string {
  if (!projectId) return '#6b7280'
  return data.projects.find((project) => project.id === projectId)?.color ?? '#3b82f6'
}

export default function TimelineView(): JSX.Element {
  const { data, setSelectedTaskId } = useAppStore()
  const days = useMemo(() => getTimelineDays(30), [])
  const today = todayKey()

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const day of days) map.set(day, [])

    for (const task of data.tasks) {
      if (task.status !== 'todo' || !task.dueDate || task.archived) continue
      if (!map.has(task.dueDate)) continue
      map.get(task.dueDate)!.push(task)
    }

    for (const [, tasks] of map) {
      tasks.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        if (a.priority !== b.priority) return a.priority === 'important' ? -1 : 1
        return a.sortOrder - b.sortOrder
      })
    }

    return map
  }, [data.tasks, days])

  return (
    <section className="flex h-full flex-1 flex-col overflow-hidden p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Таймлайн</h2>
        <p className="text-sm text-gray-400">Следующие 30 дней — задачи со сроком</p>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-surface-border bg-surface-elevated">
        <div className="inline-flex min-w-full">
          {days.map((day) => {
            const tasks = tasksByDay.get(day) ?? []
            const isToday = day === today
            const isWeekend = [0, 6].includes(new Date(`${day}T12:00:00`).getDay())

            return (
              <div
                key={day}
                className={clsx(
                  'flex w-44 shrink-0 flex-col border-r border-surface-border/60',
                  isWeekend && 'bg-surface/40'
                )}
              >
                <div
                  className={clsx(
                    'sticky top-0 border-b border-surface-border px-3 py-2 text-center',
                    isToday && 'bg-accent-muted'
                  )}
                >
                  <p className="text-xs text-gray-500">
                    {new Date(`${day}T12:00:00`).toLocaleDateString('ru-RU', { weekday: 'short' })}
                  </p>
                  <p className={clsx('text-sm font-medium', isToday && 'text-blue-300')}>
                    {new Date(`${day}T12:00:00`).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short'
                    })}
                  </p>
                </div>

                <div className="space-y-2 p-2">
                  {tasks.length === 0 ? (
                    <p className="px-1 py-4 text-center text-[10px] text-gray-600">—</p>
                  ) : (
                    tasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => setSelectedTaskId(task.id)}
                        className="w-full rounded-lg border border-surface-border bg-surface px-2 py-2 text-left text-xs transition hover:border-accent"
                        style={{ borderLeftWidth: 3, borderLeftColor: getProjectColor(data, task.projectId) }}
                      >
                        <span className="line-clamp-3">{task.title}</span>
                        {task.dueDate && task.dueDate < today && (
                          <span className="mt-1 block text-[10px] text-red-400">Просрочено</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}