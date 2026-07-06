import { CheckCircle2, Pin, Play } from 'lucide-react'
import { useMemo } from 'react'
import type { Task } from '../../../shared/schema'
import { completeTask } from '../utils/recurrence'
import { todayKey } from '../utils/calendarUtils'
import { useAppStore } from '../store/useAppStore'
import clsx from 'clsx'

function scoreTask(task: Task, today: string): number {
  let score = 0
  if (task.pinned) score += 1000
  if (task.dueDate && task.dueDate < today) score += 500
  if (task.dueDate === today) score += 300
  if (task.priority === 'important') score += 100
  if (task.dueDate) score += Math.max(0, 50 - Math.abs(new Date(`${task.dueDate}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000)
  return score
}

function pickNextTask(tasks: Task[]): Task | null {
  const today = todayKey()
  const candidates = tasks
    .filter((task) => task.status === 'todo' && !task.archived && task.parentId === null)
    .sort((a, b) => scoreTask(b, today) - scoreTask(a, today))

  return candidates[0] ?? null
}

export default function NextTaskView(): JSX.Element {
  const { data, persist, setSelectedTaskId, setActiveView } = useAppStore()
  const nextTask = useMemo(() => pickNextTask(data.tasks), [data.tasks])
  const today = todayKey()

  const handleDone = async (): Promise<void> => {
    if (!nextTask) return
    const current = useAppStore.getState().data
    await persist(completeTask(current, nextTask.id))
  }

  const handleStart = (): void => {
    if (!nextTask) return
    setSelectedTaskId(nextTask.id)
    setActiveView('focus')
  }

  return (
    <section className="flex h-full flex-1 flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <h2 className="mb-2 text-center text-xl font-semibold">Следующая задача</h2>
        <p className="mb-8 text-center text-sm text-gray-400">
          Приоритет: закреплённые → просроченные → на сегодня → важные
        </p>

        {nextTask ? (
          <div className="rounded-2xl border border-surface-border bg-surface-elevated p-8 shadow-lg">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {nextTask.pinned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/40 px-2.5 py-1 text-xs text-amber-300">
                  <Pin size={12} /> Закреплена
                </span>
              )}
              {nextTask.priority === 'important' && (
                <span className="rounded-full bg-red-950/40 px-2.5 py-1 text-xs text-red-300">Важная</span>
              )}
              {nextTask.dueDate && nextTask.dueDate < today && (
                <span className="rounded-full bg-red-950/40 px-2.5 py-1 text-xs text-red-300">Просрочено</span>
              )}
              {nextTask.dueDate === today && (
                <span className="rounded-full bg-blue-950/40 px-2.5 py-1 text-xs text-blue-300">Сегодня</span>
              )}
            </div>

            <h3 className="text-3xl font-semibold leading-tight">{nextTask.title}</h3>

            {nextTask.description && (
              <p className="mt-4 text-sm leading-relaxed text-gray-400 line-clamp-4">
                {nextTask.description}
              </p>
            )}

            {nextTask.dueDate && (
              <p className="mt-4 text-sm text-gray-500">
                Срок: {new Date(`${nextTask.dueDate}T12:00:00`).toLocaleDateString('ru-RU')}
              </p>
            )}

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={handleStart}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3 text-sm font-medium text-white hover:bg-blue-500"
              >
                <Play size={18} /> Начать
              </button>
              <button
                type="button"
                onClick={() => void handleDone()}
                className="inline-flex items-center gap-2 rounded-xl border border-green-700/50 bg-green-950/30 px-8 py-3 text-sm font-medium text-green-300 hover:bg-green-950/50"
              >
                <CheckCircle2 size={18} /> Готово
              </button>
              <button
                type="button"
                onClick={() => setSelectedTaskId(nextTask.id)}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-xl border border-surface-border px-6 py-3 text-sm text-gray-300 hover:bg-surface'
                )}
              >
                Подробнее
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-surface-border px-8 py-16 text-center text-gray-500">
            Нет активных задач — отличная работа!
          </div>
        )}
      </div>
    </section>
  )
}