import { Archive, Calendar, CheckCircle2, Target, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { getWeekDays, getWeekKey, todayKey } from '../utils/calendarUtils'
import { addWeeklyGoal } from '../utils/weeklyGoalsHelpers'
import { deleteTaskTree, updateTask } from '../utils/taskHelpers'
import { useAppStore } from '../store/useAppStore'
import clsx from 'clsx'

interface WeeklyReviewDialogProps {
  open: boolean
  onClose: () => void
}

const STEPS = [
  { title: 'Выполнено на неделе', icon: CheckCircle2 },
  { title: 'Просроченные', icon: Calendar },
  { title: 'Устаревшие задачи', icon: Archive },
  { title: 'Цель недели', icon: Target }
]

export default function WeeklyReviewDialog({
  open,
  onClose
}: WeeklyReviewDialogProps): JSX.Element | null {
  const { data, persist } = useAppStore()
  const [step, setStep] = useState(0)
  const [goalText, setGoalText] = useState('')

  const weekDays = useMemo(() => getWeekDays(), [])
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]
  const weekKey = getWeekKey()
  const today = todayKey()
  const staleThreshold = new Date()
  staleThreshold.setDate(staleThreshold.getDate() - 30)

  const completedThisWeek = useMemo(
    () =>
      data.tasks.filter(
        (task) =>
          task.status === 'done' &&
          task.completedAt &&
          task.completedAt.slice(0, 10) >= weekStart &&
          task.completedAt.slice(0, 10) <= weekEnd
      ),
    [data.tasks, weekStart, weekEnd]
  )

  const overdueTasks = useMemo(
    () =>
      data.tasks.filter(
        (task) => task.status === 'todo' && !task.archived && task.dueDate && task.dueDate < today
      ),
    [data.tasks, today]
  )

  const staleTasks = useMemo(
    () =>
      data.tasks.filter(
        (task) =>
          task.status === 'todo' &&
          !task.archived &&
          new Date(task.updatedAt) < staleThreshold
      ),
    [data.tasks, staleThreshold]
  )

  if (!open) return null

  const handleReschedule = async (taskId: string, dueDate: string): Promise<void> => {
    const current = useAppStore.getState().data
    await persist(updateTask(current, taskId, { dueDate }))
  }

  const handleArchive = async (taskId: string): Promise<void> => {
    const current = useAppStore.getState().data
    await persist(updateTask(current, taskId, { archived: true }))
  }

  const handleDelete = async (taskId: string): Promise<void> => {
    if (!confirm('Удалить задачу?')) return
    const current = useAppStore.getState().data
    await persist(deleteTaskTree(current, taskId))
  }

  const handleAddGoal = async (): Promise<void> => {
    const text = goalText.trim()
    if (!text) return
    const current = useAppStore.getState().data
    await persist(addWeeklyGoal(current, weekKey, text))
    setGoalText('')
  }

  const handleFinish = (): void => {
    setStep(0)
    setGoalText('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-surface-border bg-surface-elevated shadow-xl">
        <div className="border-b border-surface-border px-6 py-4">
          <h3 className="text-lg font-semibold">Еженедельный обзор</h3>
          <p className="text-sm text-gray-400">
            Шаг {step + 1} из {STEPS.length}: {STEPS[step].title}
          </p>
          <div className="mt-3 flex gap-2">
            {STEPS.map((item, index) => (
              <div
                key={item.title}
                className={clsx(
                  'h-1.5 flex-1 rounded-full',
                  index <= step ? 'bg-accent' : 'bg-surface-border'
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 0 && (
            <div className="space-y-2">
              {completedThisWeek.length === 0 ? (
                <p className="text-sm text-gray-500">На этой неделе выполненных задач нет</p>
              ) : (
                completedThisWeek.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-lg border border-surface-border px-3 py-2 text-sm text-gray-300"
                  >
                    {task.title}
                  </div>
                ))
              )}
              <p className="mt-4 text-xs text-gray-500">Всего: {completedThisWeek.length}</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              {overdueTasks.length === 0 ? (
                <p className="text-sm text-gray-500">Просроченных задач нет</p>
              ) : (
                overdueTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2"
                  >
                    <span className="flex-1 text-sm">{task.title}</span>
                    <input
                      type="date"
                      defaultValue={today}
                      onChange={(event) => void handleReschedule(task.id, event.target.value)}
                      className="rounded border border-surface-border bg-surface px-2 py-1 text-xs"
                    />
                  </div>
                ))
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {staleTasks.length === 0 ? (
                <p className="text-sm text-gray-500">Устаревших задач не найдено (30+ дней без изменений)</p>
              ) : (
                staleTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-surface-border px-3 py-2"
                  >
                    <span className="flex-1 text-sm">{task.title}</span>
                    <button
                      type="button"
                      onClick={() => void handleArchive(task.id)}
                      className="inline-flex items-center gap-1 rounded border border-surface-border px-2 py-1 text-xs text-gray-300"
                    >
                      <Archive size={12} /> В архив
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(task.id)}
                      className="inline-flex items-center gap-1 rounded border border-red-800/50 px-2 py-1 text-xs text-red-300"
                    >
                      <Trash2 size={12} /> Удалить
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="mb-3 text-sm text-gray-400">Задайте главную цель на текущую неделю</p>
              <div className="flex gap-2">
                <input
                  value={goalText}
                  onChange={(event) => setGoalText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleAddGoal()
                  }}
                  placeholder="Например: закрыть 5 просроченных задач"
                  className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleAddGoal()}
                  className="rounded-lg bg-accent px-4 py-2 text-sm text-white"
                >
                  Добавить
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {data.weeklyGoals
                  .filter((goal) => goal.weekKey === weekKey)
                  .map((goal) => (
                    <div key={goal.id} className="rounded-lg border border-surface-border px-3 py-2 text-sm">
                      {goal.text}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between border-t border-surface-border px-6 py-4">
          <button
            type="button"
            onClick={() => (step > 0 ? setStep(step - 1) : handleFinish())}
            className="rounded-lg border border-surface-border px-4 py-2 text-sm text-gray-300"
          >
            {step > 0 ? 'Назад' : 'Закрыть'}
          </button>
          <button
            type="button"
            onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : handleFinish())}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            {step < STEPS.length - 1 ? 'Далее' : 'Завершить'}
          </button>
        </div>
      </div>
    </div>
  )
}