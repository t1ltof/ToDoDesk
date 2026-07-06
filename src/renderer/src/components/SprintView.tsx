import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Sprint } from '../../../shared/schema'
import {
  assignTasksToSprint,
  createSprint,
  deleteSprint,
  getSprintProgress,
  updateSprint
} from '../utils/sprintHelpers'
import { addDaysToDateKey, localDateKey } from '../utils/calendarUtils'
import { useAppStore } from '../store/useAppStore'
import clsx from 'clsx'

export default function SprintView(): JSX.Element {
  const { data, persist, setSelectedTaskId } = useAppStore()
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(data.sprints[0]?.id ?? null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(localDateKey())
  const [endDate, setEndDate] = useState(() => addDaysToDateKey(localDateKey(), 13))
  const [goal, setGoal] = useState('')
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])

  const sprints = useMemo(
    () => [...data.sprints].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [data.sprints]
  )

  const selectedSprint = sprints.find((sprint) => sprint.id === selectedSprintId) ?? null
  const todoTasks = useMemo(
    () => data.tasks.filter((task) => task.status === 'todo' && !task.archived && task.parentId === null),
    [data.tasks]
  )

  const progress = selectedSprint ? getSprintProgress(data, selectedSprint) : null

  const handleCreate = async (): Promise<void> => {
    if (!name.trim()) return
    const current = useAppStore.getState().data
    const next = createSprint(current, { name, startDate, endDate, goal })
    await persist(next)
    setSelectedSprintId(next.sprints[next.sprints.length - 1]?.id ?? null)
    setShowForm(false)
    setName('')
    setGoal('')
  }

  const handleDelete = async (sprint: Sprint): Promise<void> => {
    if (!confirm(`Удалить спринт «${sprint.name}»?`)) return
    const current = useAppStore.getState().data
    const next = deleteSprint(current, sprint.id)
    await persist(next)
    setSelectedSprintId(next.sprints[0]?.id ?? null)
  }

  const handleSaveSprint = async (patch: Partial<Sprint>): Promise<void> => {
    if (!selectedSprint) return
    const current = useAppStore.getState().data
    await persist(updateSprint(current, selectedSprint.id, patch))
  }

  const handleAssign = async (): Promise<void> => {
    if (!selectedSprint) return
    const current = useAppStore.getState().data
    await persist(assignTasksToSprint(current, selectedSprint.id, selectedTaskIds))
  }

  return (
    <section className="flex h-full flex-1 overflow-hidden">
      <div className="flex w-72 flex-col border-r border-surface-border bg-surface-elevated">
        <div className="border-b border-surface-border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Спринты</h2>
            <button
              type="button"
              onClick={() => setShowForm((value) => !value)}
              className="rounded-lg bg-accent p-2 text-white"
            >
              <Plus size={16} />
            </button>
          </div>

          {showForm && (
            <div className="mt-3 space-y-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Название спринта"
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs"
                />
              </div>
              <input
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="Цель спринта"
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleCreate()}
                className="w-full rounded-lg bg-accent px-3 py-2 text-sm text-white"
              >
                Создать
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sprints.length === 0 ? (
            <p className="px-2 py-4 text-sm text-gray-500">Спринтов пока нет</p>
          ) : (
            sprints.map((sprint) => {
              const itemProgress = getSprintProgress(data, sprint)
              return (
                <button
                  key={sprint.id}
                  type="button"
                  onClick={() => {
                    setSelectedSprintId(sprint.id)
                    setSelectedTaskIds(sprint.taskIds)
                  }}
                  className={clsx(
                    'mb-1 w-full rounded-lg px-3 py-2 text-left transition',
                    selectedSprintId === sprint.id
                      ? 'bg-accent-muted text-blue-300'
                      : 'text-gray-300 hover:bg-surface-border/60'
                  )}
                >
                  <p className="truncate text-sm font-medium">{sprint.name}</p>
                  <p className="text-xs text-gray-500">
                    {sprint.startDate} — {sprint.endDate}
                  </p>
                  <p className="text-xs text-gray-500">
                    {itemProgress.done}/{itemProgress.total} ({itemProgress.percent}%)
                  </p>
                </button>
              )
            })
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto p-6">
        {selectedSprint && progress ? (
          <>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex-1">
                <input
                  value={selectedSprint.name}
                  onChange={(event) => void handleSaveSprint({ name: event.target.value })}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-xl font-semibold"
                />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={selectedSprint.startDate}
                    onChange={(event) => void handleSaveSprint({ startDate: event.target.value })}
                    className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={selectedSprint.endDate}
                    onChange={(event) => void handleSaveSprint({ endDate: event.target.value })}
                    className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
                  />
                </div>
                <textarea
                  value={selectedSprint.goal}
                  onChange={(event) => void handleSaveSprint({ goal: event.target.value })}
                  placeholder="Цель спринта..."
                  rows={2}
                  className="mt-3 w-full resize-none rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(selectedSprint)}
                className="rounded-lg border border-red-800/50 p-2 text-red-300"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="mb-8 rounded-xl border border-surface-border bg-surface-elevated p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-gray-400">Прогресс</span>
                <span className="font-medium text-green-300">
                  {progress.done} / {progress.total} ({progress.percent}%)
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-surface-border">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium">Задачи спринта</h3>
              <button
                type="button"
                onClick={() => void handleAssign()}
                className="rounded-lg bg-accent px-4 py-2 text-sm text-white"
              >
                Сохранить выбор
              </button>
            </div>

            <div className="space-y-2">
              {todoTasks.map((task) => {
                const checked = selectedTaskIds.includes(task.id)
                return (
                  <label
                    key={task.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-surface-border px-3 py-2 hover:bg-surface"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedTaskIds((current) =>
                          checked ? current.filter((id) => id !== task.id) : [...current, task.id]
                        )
                      }
                    />
                    <span className="flex-1 text-sm">{task.title}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(task.id)}
                      className="text-xs text-blue-300 hover:underline"
                    >
                      Открыть
                    </button>
                  </label>
                )
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-500">
            Выберите или создайте спринт
          </div>
        )}
      </div>
    </section>
  )
}