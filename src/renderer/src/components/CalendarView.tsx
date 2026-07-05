import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { getWeekDays, todayKey, useAppStore } from '../store/useAppStore'
import { updateTask } from '../utils/taskHelpers'
import clsx from 'clsx'

const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export default function CalendarView(): JSX.Element {
  const { data, persist, setSelectedTaskId } = useAppStore()
  const [weekOffset, setWeekOffset] = useState(0)

  const weekDays = useMemo(() => {
    const base = new Date()
    base.setDate(base.getDate() + weekOffset * 7)
    return getWeekDays(base)
  }, [weekOffset])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, typeof data.tasks>()
    for (const day of weekDays) {
      map.set(
        day,
        data.tasks.filter((task) => task.status === 'todo' && task.dueDate === day)
      )
    }
    return map
  }, [data.tasks, weekDays])

  const moveTask = async (taskId: string, newDate: string): Promise<void> => {
    const current = useAppStore.getState().data
    await persist(updateTask(current, taskId, { dueDate: newDate }))
  }

  return (
    <section className="flex h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-surface-border px-6 py-4">
        <h2 className="text-xl font-semibold">Календарь — неделя</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((v) => v - 1)}
            className="rounded-lg border border-surface-border p-2 text-gray-300 hover:bg-surface-elevated"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className="rounded-lg border border-surface-border px-3 py-2 text-sm text-gray-300"
          >
            Сегодня
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((v) => v + 1)}
            className="rounded-lg border border-surface-border p-2 text-gray-300 hover:bg-surface-elevated"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-7 gap-2 overflow-hidden p-4">
        {weekDays.map((day, index) => {
          const tasks = tasksByDay.get(day) ?? []
          const isToday = day === todayKey()
          return (
            <div
              key={day}
              className={clsx(
                'flex min-h-0 flex-col rounded-xl border p-2',
                isToday ? 'border-accent bg-accent-muted/20' : 'border-surface-border bg-surface-elevated'
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const taskId = e.dataTransfer.getData('taskId')
                if (taskId) void moveTask(taskId, day)
              }}
            >
              <div className="mb-2 text-center">
                <p className="text-xs text-gray-500">{dayNames[index]}</p>
                <p className={clsx('text-sm font-medium', isToday && 'text-blue-300')}>
                  {new Date(`${day}T12:00:00`).getDate()}
                </p>
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                    onClick={() => setSelectedTaskId(task.id)}
                    className="w-full rounded border border-surface-border bg-surface px-2 py-1 text-left text-xs hover:border-accent"
                  >
                    {task.title}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}