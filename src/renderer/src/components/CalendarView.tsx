import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { Task } from '../../../shared/schema'
import {
  DAY_NAMES,
  formatDayLabel,
  formatMonthYear,
  getMonthGrid,
  getWeekDays,
  todayKey
} from '../utils/calendarUtils'
import { createRootTask, updateTask } from '../utils/taskHelpers'
import { useAppStore } from '../store/useAppStore'
import clsx from 'clsx'

type CalendarMode = 'week' | 'month'
const MAX_VISIBLE_TASKS = 3

function getProjectColor(data: ReturnType<typeof useAppStore.getState>['data'], projectId: string | null): string {
  if (!projectId) return '#6b7280'
  return data.projects.find((p) => p.id === projectId)?.color ?? '#3b82f6'
}

function TaskChip({
  task,
  data,
  onSelect,
  compact = false
}: {
  task: Task
  data: ReturnType<typeof useAppStore.getState>['data']
  onSelect: (id: string) => void
  compact?: boolean
}): JSX.Element {
  const today = todayKey()
  const isOverdue = task.dueDate && task.dueDate < today
  const color = getProjectColor(data, task.projectId)

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('taskId', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => onSelect(task.id)}
      className={clsx(
        'w-full truncate rounded border-l-2 text-left transition hover:brightness-110',
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
        isOverdue ? 'border-red-500 bg-red-950/40 text-red-200' : 'bg-surface-elevated text-gray-200'
      )}
      style={{ borderLeftColor: isOverdue ? undefined : color }}
      title={task.title}
    >
      {task.priority === 'important' && <span className="mr-0.5 text-red-400">!</span>}
      {task.title}
    </button>
  )
}

export default function CalendarView(): JSX.Element {
  const { data, persist, setSelectedTaskId } = useAppStore()
  const [mode, setMode] = useState<CalendarMode>('month')
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const today = todayKey()

  const { year, month } = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + monthOffset)
    return { year: d.getFullYear(), month: d.getMonth() }
  }, [monthOffset])

  const weekDays = useMemo(() => {
    const base = new Date()
    base.setDate(base.getDate() + weekOffset * 7)
    return getWeekDays(base)
  }, [weekOffset])

  const monthCells = useMemo(() => getMonthGrid(year, month), [year, month])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of data.tasks) {
      if (task.status !== 'todo' || !task.dueDate) continue
      const list = map.get(task.dueDate) ?? []
      list.push(task)
      map.set(task.dueDate, list)
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return map
  }, [data.tasks])

  const overdueTasks = useMemo(
    () => data.tasks.filter((t) => t.status === 'todo' && t.dueDate && t.dueDate < today),
    [data.tasks, today]
  )

  const selectedTasks = tasksByDate.get(selectedDate) ?? []

  const moveTask = async (taskId: string, newDate: string): Promise<void> => {
    const current = useAppStore.getState().data
    await persist(updateTask(current, taskId, { dueDate: newDate }))
    setSelectedDate(newDate)
  }

  const addTaskOnDay = async (): Promise<void> => {
    const title = newTaskTitle.trim()
    if (!title) return
    const current = useAppStore.getState().data
    await persist(createRootTask(current, { title, projectId: null, dueDate: selectedDate }))
    setNewTaskTitle('')
  }

  const renderDayDropZone = (date: string, children: ReactNode, className?: string): JSX.Element => (
    <div
      className={className}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const taskId = e.dataTransfer.getData('taskId')
        if (taskId) void moveTask(taskId, date)
      }}
      onClick={() => setSelectedDate(date)}
    >
      {children}
    </div>
  )

  return (
    <section className="flex h-full flex-1 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold">Календарь</h2>
            <p className="text-sm text-gray-400">
              {mode === 'month' ? formatMonthYear(year, month) : 'Недельный вид'}
              {overdueTasks.length > 0 && (
                <span className="ml-2 text-red-400">· {overdueTasks.length} просрочено</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-surface-border">
              <button
                type="button"
                onClick={() => setMode('week')}
                className={clsx('px-3 py-1.5 text-sm', mode === 'week' && 'bg-accent-muted text-blue-300')}
              >
                Неделя
              </button>
              <button
                type="button"
                onClick={() => setMode('month')}
                className={clsx('px-3 py-1.5 text-sm', mode === 'month' && 'bg-accent-muted text-blue-300')}
              >
                Месяц
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setWeekOffset(0)
                setMonthOffset(0)
                setSelectedDate(today)
              }}
              className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-gray-300"
            >
              Сегодня
            </button>

            <button
              type="button"
              onClick={() => (mode === 'week' ? setWeekOffset((v) => v - 1) : setMonthOffset((v) => v - 1))}
              className="rounded-lg border border-surface-border p-2 text-gray-300"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => (mode === 'week' ? setWeekOffset((v) => v + 1) : setMonthOffset((v) => v + 1))}
              className="rounded-lg border border-surface-border p-2 text-gray-300"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </header>

        {mode === 'week' ? (
          <div className="grid flex-1 grid-cols-7 gap-2 overflow-hidden p-4">
            {weekDays.map((day, index) => {
              const tasks = tasksByDate.get(day) ?? []
              const isToday = day === today
              const isSelected = day === selectedDate
              return renderDayDropZone(
                day,
                <>
                  <div className="mb-2 text-center">
                    <p className="text-xs text-gray-500">{DAY_NAMES[index]}</p>
                    <p
                      className={clsx(
                        'mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium',
                        isToday && 'bg-accent text-white',
                        isSelected && !isToday && 'ring-2 ring-accent'
                      )}
                    >
                      {new Date(`${day}T12:00:00`).getDate()}
                    </p>
                    {tasks.length > 0 && (
                      <p className="mt-1 text-[10px] text-gray-500">{tasks.length} задач</p>
                    )}
                  </div>
                  <div className="flex-1 space-y-1 overflow-y-auto">
                    {tasks.map((task) => (
                      <TaskChip
                        key={task.id}
                        task={task}
                        data={data}
                        onSelect={setSelectedTaskId}
                      />
                    ))}
                  </div>
                </>,
                clsx(
                  'flex min-h-0 flex-col rounded-xl border p-2 transition',
                  isSelected ? 'border-accent bg-accent-muted/10' : 'border-surface-border bg-surface-elevated',
                  isToday && !isSelected && 'border-accent/50'
                )
              )
            })}
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden p-4">
            <div className="mb-1 grid grid-cols-7 gap-1">
              {DAY_NAMES.map((name) => (
                <div key={name} className="py-1 text-center text-xs font-medium text-gray-500">
                  {name}
                </div>
              ))}
            </div>
            <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-1">
              {monthCells.map((cell) => {
                const tasks = tasksByDate.get(cell.date) ?? []
                const visible = tasks.slice(0, MAX_VISIBLE_TASKS)
                const hidden = tasks.length - visible.length
                const isSelected = cell.date === selectedDate

                return renderDayDropZone(
                  cell.date,
                  <>
                    <div className="flex items-center justify-between">
                      <span
                        className={clsx(
                          'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                          cell.isToday && 'bg-accent font-bold text-white',
                          isSelected && !cell.isToday && 'ring-1 ring-accent',
                          !cell.isCurrentMonth && 'text-gray-600',
                          cell.isWeekend && cell.isCurrentMonth && 'text-amber-400/80'
                        )}
                      >
                        {cell.day}
                      </span>
                      {tasks.length > 0 && (
                        <span className="rounded-full bg-surface-border px-1.5 text-[10px] text-gray-400">
                          {tasks.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 space-y-0.5 overflow-hidden">
                      {visible.map((task) => (
                        <TaskChip
                          key={task.id}
                          task={task}
                          data={data}
                          onSelect={setSelectedTaskId}
                          compact
                        />
                      ))}
                      {hidden > 0 && (
                        <p className="px-1 text-[10px] text-gray-500">+{hidden} ещё</p>
                      )}
                    </div>
                  </>,
                  clsx(
                    'flex min-h-0 flex-col rounded-lg border p-1 transition',
                    cell.isCurrentMonth
                      ? isSelected
                        ? 'border-accent bg-accent-muted/15'
                        : 'border-surface-border/60 bg-surface-elevated/50 hover:border-surface-border'
                      : 'border-transparent bg-surface/30 opacity-50',
                    cell.isToday && !isSelected && 'border-accent/40'
                  )
                )
              })}
            </div>
          </div>
        )}
      </div>

      <aside className="flex w-80 shrink-0 flex-col border-l border-surface-border bg-surface-elevated">
        <div className="border-b border-surface-border px-4 py-3">
          <h3 className="font-medium capitalize">{formatDayLabel(selectedDate)}</h3>
          <p className="text-sm text-gray-400">
            {selectedTasks.length} {selectedTasks.length === 1 ? 'задача' : 'задач'}
          </p>
        </div>

        <div className="border-b border-surface-border p-3">
          <div className="flex gap-2">
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void addTaskOnDay()}
              placeholder="Задача на этот день..."
              className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => void addTaskOnDay()}
              className="rounded-lg bg-accent p-2 text-white hover:bg-blue-500"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {selectedTasks.length === 0 ? (
            <p className="text-center text-sm text-gray-500">Нет задач на этот день</p>
          ) : (
            selectedTasks.map((task) => (
              <TaskChip key={task.id} task={task} data={data} onSelect={setSelectedTaskId} />
            ))
          )}
        </div>

        {overdueTasks.length > 0 && (
          <div className="border-t border-surface-border p-3">
            <p className="mb-2 text-xs font-medium uppercase text-red-400">Просрочено</p>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {overdueTasks.slice(0, 5).map((task) => (
                <TaskChip key={task.id} task={task} data={data} onSelect={setSelectedTaskId} compact />
              ))}
              {overdueTasks.length > 5 && (
                <p className="text-xs text-gray-500">+{overdueTasks.length - 5} ещё</p>
              )}
            </div>
          </div>
        )}
      </aside>
    </section>
  )
}