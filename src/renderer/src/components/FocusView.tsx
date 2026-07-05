import { Pause, Play, RotateCcw, Timer } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { filterTasksForView, useAppStore } from '../store/useAppStore'
import clsx from 'clsx'

type Phase = 'work' | 'break'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function FocusView(): JSX.Element {
  const { data, setSelectedTaskId } = useAppStore()
  const workMinutes = data.settings.pomodoroWorkMinutes
  const breakMinutes = data.settings.pomodoroBreakMinutes

  const [phase, setPhase] = useState<Phase>('work')
  const [secondsLeft, setSecondsLeft] = useState(workMinutes * 60)
  const [running, setRunning] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)

  const tasks = useMemo(() => filterTasksForView(data, 'all', ''), [data])
  const selectedTask = tasks.find((t) => t.id === taskId)

  const reset = useCallback(
    (nextPhase: Phase = 'work') => {
      setPhase(nextPhase)
      setSecondsLeft((nextPhase === 'work' ? workMinutes : breakMinutes) * 60)
      setRunning(false)
    },
    [workMinutes, breakMinutes]
  )

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          const nextPhase = phase === 'work' ? 'break' : 'work'
          setPhase(nextPhase)
          setRunning(false)
          return (nextPhase === 'work' ? workMinutes : breakMinutes) * 60
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [running, phase, workMinutes, breakMinutes])

  useEffect(() => {
    reset('work')
  }, [workMinutes, breakMinutes, reset])

  const totalSeconds = (phase === 'work' ? workMinutes : breakMinutes) * 60
  const progress = 1 - secondsLeft / totalSeconds

  return (
    <section className="flex h-full flex-1 flex-col items-center justify-center p-8">
      <div className="w-full max-w-md text-center">
        <div className="mb-2 flex items-center justify-center gap-2 text-gray-400">
          <Timer size={18} />
          <span className="text-sm uppercase tracking-wide">
            {phase === 'work' ? 'Фокус' : 'Перерыв'}
          </span>
        </div>

        <div className="relative mx-auto mb-8 h-48 w-48">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#2d3340" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={phase === 'work' ? '#3b82f6' : '#22c55e'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${progress * 283} 283`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-mono font-semibold tabular-nums">
              {formatTime(secondsLeft)}
            </span>
          </div>
        </div>

        <div className="mb-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-blue-500"
          >
            {running ? <Pause size={18} /> : <Play size={18} />}
            {running ? 'Пауза' : 'Старт'}
          </button>
          <button
            type="button"
            onClick={() => reset(phase)}
            className="inline-flex items-center gap-2 rounded-xl border border-surface-border px-6 py-3 text-sm text-gray-300 hover:bg-surface-elevated"
          >
            <RotateCcw size={18} />
            Сброс
          </button>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-elevated p-4 text-left">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Задача для фокуса
          </p>
          <select
            value={taskId ?? ''}
            onChange={(e) => setTaskId(e.target.value || null)}
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
          >
            <option value="">Без привязки</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
          {selectedTask && (
            <button
              type="button"
              onClick={() => setSelectedTaskId(selectedTask.id)}
              className={clsx(
                'mt-3 text-xs text-blue-300 hover:underline'
              )}
            >
              Открыть задачу
            </button>
          )}
        </div>

        <p className="mt-6 text-xs text-gray-500">
          {workMinutes} мин работы · {breakMinutes} мин перерыва
        </p>
      </div>
    </section>
  )
}