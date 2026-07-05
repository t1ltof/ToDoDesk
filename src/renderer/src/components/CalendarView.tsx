import { Check, ChevronLeft, ChevronRight, Plus, Target, Trash2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { Task, TimeOfDay } from '../../../shared/schema'
import {
  DAY_NAMES,
  formatDayLabel,
  formatMonthYear,
  getMonthGrid,
  getWeekDays,
  getWeekKey,
  todayKey
} from '../utils/calendarUtils'
import { createRootTask, updateTask } from '../utils/taskHelpers'
import { addWeeklyGoal, deleteWeeklyGoal, toggleWeeklyGoal } from '../utils/weeklyGoalsHelpers'
import { useAppStore } from '../store/useAppStore'
import clsx from 'clsx'

type CalendarMode = 'day' | 'week' | 'month'
const MAX_VISIBLE_TASKS = 3

const TIME_OF_DAY_SECTIONS: { key: TimeOfDay; label: string; hint: string }[] = [
  { key: 'morning', label: 'Утро', hint: 'до 12:00' },
  { key: 'day', label: 'День', hint: '12:00–18:00' },
  { key: 'evening', label: 'Вечер', hint: 'после 18:00' }
]

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
  const [dayOffset, setDayOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newGoalText, setNewGoalText] = useState('')

  const today = todayKey()

  const displayDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + dayOffset)
    return d.toISOString().slice(0, 10)
  }, [dayOffset])

  const currentWeekKey = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + (mode === 'day' ? dayOffset : weekOffset * 7))
    return getWeekKey(d)
  }, [mode, dayOffset, weekOffset])

  const weekGoals = useMemo(
    () => data.weeklyGoals.filter((g) => g.weekKey === currentWeekKey),
    [data.weeklyGoals, currentWeekKey]
  )

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
  const dayViewDate = mode === 'day' ? displayDate : selectedDate
  const dayViewTasks = tasksByDate.get(dayViewDate) ?? []

  const tasksByTimeOfDay = useMemo(() => {
    const sections: Record<TimeOfDay, Task[]> = {
      morning: [],
      day: [],
      evening: []
    }
    for (const task of dayViewTasks) {
      const slot = task.timeOfDay ?? 'day'
      sections[slot].push(task)
    }
    return sections
  }, [dayViewTasks])

  const moveTask = async (taskId: string, newDate: string): Promise<void> => {
    const current = useAppStore.getState().data
    await persist(updateTask(current, taskId, { dueDate: newDate }))
    setSelectedDate(newDate)
    if (mode === 'day') {
      const diff = Math.round(
        (new Date(`${newDate}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) /
          86_400_000
      )
      setDayOffset(diff)
    }
  }

  const moveTaskToTimeOfDay = async (taskId: string, timeOfDay: TimeOfDay): Promise<void> => {
    const current = useAppStore.getState().data
    await persist(updateTask(current, taskId, { timeOfDay, dueDate: dayViewDate }))
  }

  const addTaskOnDay = async (): Promise<void> => {
    const title = newTaskTitle.trim()
    if (!title) return
    const current = useAppStore.getState().data
    const date = mode === 'day' ? dayViewDate : selectedDate
    await persist(createRootTask(current, { title, projectId: null, dueDate: date }))
    setNewTaskTitle('')
  }

  const addGoal = async (): Promise<void> => {
    const text = newGoalText.trim()
    if (!text) return
    await persist(addWeeklyGoal(data, currentWeekKey, text))
    setNewGoalText('')
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

  const renderTimeSection = (section: (typeof TIME_OF_DAY_SECTIONS)[number]): JSX.Element => {
    const tasks = tasksByTimeOfDay[section.key]
    return (
      <div
        key={section.key}
        className="flex min-h-0 flex-1 flex-col rounded-xl border border-surface-border bg-surface-elevated p-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const taskId = e.dataTransfer.getData('taskId')
          if (taskId) void moveTaskToTimeOfDay(taskId, section.key)
        }}
      >
        <div className="mb-2 flex items-baseline justify-between">
          <h4 className="font-medium text-gray-200">{section.label}</h4>
          <span className="text-xs text-gray-500">{section.hint}</span>
        </div>
        <div className="flex-1 space-y-1.5 overflow-y-auto">
          {tasks.length === 0 ? (
            <p className="text-center text-xs text-gray-600">Перетащите задачу сюда</p>
          ) : (
            tasks.map((task) => (
              <TaskChip key={task.id} task={task} data={data} onSelect={setSelectedTaskId} />
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <section className="flex h-full flex-1 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-surface-border bg-surface-elevated/50 px-6 py-3">
          <div className="mb-2 flex items-center gap-2">
            <Target size={16} className="text-amber-400" />
            <h3 className="text-sm font-medium">Цели недели</h3>
            <span className="text-xs text-gray-500">
              {weekGoals.filter((g) => g.completed).length} / {weekGoals.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {weekGoals.map((goal) => (
              <div
                key={goal.id}
                className={clsx(
                  'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm',
                  goal.completed
                    ? 'border-green-800/50 bg-green-950/30 text-green-300 line-through'
                    : 'border-surface-border bg-surface'
                )}
              >
                <button
                  type="button"
                  onClick={() => void persist(toggleWeeklyGoal(data, goal.id))}
                  className={clsx(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                    goal.completed ? 'border-green-600 bg-green-700 text-white' : 'border-gray-600'
                  )}
                >
                  {goal.completed && <Check size={12} />}
                </button>
                <span className="max-w-[200px] truncate">{goal.text}</span>
                <button
                  type="button"
                  onClick={() => void persist(deleteWeeklyGoal(data, goal.id))}
                  className="text-gray-500 hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <div className="flex gap-1">
              <input
                value={newGoalText}
                onChange={(e) => setNewGoalText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addGoal()}
                placeholder="Новая цель..."
                className="w-40 rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => void addGoal()}
                className="rounded-lg bg-amber-700 px-2 py-1.5 text-white hover:bg-amber-600"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold">Календарь</h2>
            <p className="text-sm text-gray-400">
              {mode === 'month'
                ? formatMonthYear(year, month)
                : mode === 'week'
                  ? 'Недельный вид'
                  : formatDayLabel(displayDate)}
              {overdueTasks.length > 0 && (
                <span className="ml-2 text-red-400">· {overdueTasks.length} просрочено</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-surface-border">
              <button
                type="button"
                onClick={() => setMode('day')}
                className={clsx('px-3 py-1.5 text-sm', mode === 'day' && 'bg-accent-muted text-blue-300')}
              >
                День
              </button>
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
                setDayOffset(0)
                setSelectedDate(today)
              }}
              className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-gray-300"
            >
              Сегодня
            </button>

            <button
              type="button"
              onClick={() =>
                mode === 'day'
                  ? setDayOffset((v) => v - 1)
                  : mode === 'week'
                    ? setWeekOffset((v) => v - 1)
                    : setMonthOffset((v) => v - 1)
              }
              className="rounded-lg border border-surface-border p-2 text-gray-300"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() =>
                mode === 'day'
                  ? setDayOffset((v) => v + 1)
                  : mode === 'week'
                    ? setWeekOffset((v) => v + 1)
                    : setMonthOffset((v) => v + 1)
              }
              className="rounded-lg border border-surface-border p-2 text-gray-300"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </header>

        {mode === 'day' ? (
          <div className="grid flex-1 grid-cols-3 gap-3 overflow-hidden p-4">
            {TIME_OF_DAY_SECTIONS.map(renderTimeSection)}
          </div>
        ) : mode === 'week' ? (
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
          <h3 className="font-medium capitalize">
            {formatDayLabel(mode === 'day' ? dayViewDate : selectedDate)}
          </h3>
          <p className="text-sm text-gray-400">
            {(mode === 'day' ? dayViewTasks : selectedTasks).length}{' '}
            {(mode === 'day' ? dayViewTasks : selectedTasks).length === 1 ? 'задача' : 'задач'}
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
          {(mode === 'day' ? dayViewTasks : selectedTasks).length === 0 ? (
            <p className="text-center text-sm text-gray-500">Нет задач на этот день</p>
          ) : (
            (mode === 'day' ? dayViewTasks : selectedTasks).map((task) => (
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