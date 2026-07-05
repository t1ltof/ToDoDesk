import { ChevronDown, ChevronRight, GripVertical, Lock, Pin } from 'lucide-react'
import { useState, type DragEvent, type MouseEvent } from 'react'
import type { Task, ViewId } from '../../../shared/schema'
import { completeTask, reopenTask } from '../utils/recurrence'
import { canCompleteTask, isTaskBlocked } from '../utils/taskFilters'
import {
  formatCompletedDate,
  formatDueDateLabel,
  getChildTasks,
  getTaskTags,
  useAppStore
} from '../store/useAppStore'
import clsx from 'clsx'

interface TaskItemProps {
  task: Task
  depth?: number
  view: ViewId
  draggable?: boolean
  bulkMode?: boolean
  bulkSelected?: boolean
  onBulkToggle?: (taskId: string) => void
  onDragStart?: (taskId: string) => void
  onDrop?: (targetId: string) => void
}

export default function TaskItem({
  task,
  depth = 0,
  view,
  draggable = false,
  bulkMode = false,
  bulkSelected = false,
  onBulkToggle,
  onDragStart,
  onDrop
}: TaskItemProps): JSX.Element {
  const { data, persist, selectedTaskId, setSelectedTaskId } = useAppStore()
  const childStatus = view === 'completed' ? 'done' : undefined
  const children = getChildTasks(data, task.id, childStatus)
  const [expanded, setExpanded] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const tags = getTaskTags(data, task.id)
  const selected = selectedTaskId === task.id
  const completedLabel = formatCompletedDate(task.completedAt)
  const blocked = isTaskBlocked(data, task.id)
  const completable = canCompleteTask(data, task.id)

  const toggleDone = async (event: MouseEvent): Promise<void> => {
    event.stopPropagation()
    if (task.status !== 'done' && !completable) return

    const current = useAppStore.getState().data
    const next =
      task.status === 'done'
        ? reopenTask(current, task.id)
        : completeTask(current, task.id)
    await persist(next)
    if (task.status === 'done' && view === 'completed') setSelectedTaskId(null)
  }

  const dueLabel = formatDueDateLabel(task.dueDate)

  const handleDragStart = (event: DragEvent): void => {
    if (!draggable || depth > 0) return
    event.dataTransfer.effectAllowed = 'move'
    onDragStart?.(task.id)
  }

  const handleDragOver = (event: DragEvent): void => {
    if (!draggable || depth > 0) return
    event.preventDefault()
    setDragOver(true)
  }

  const handleDrop = (event: DragEvent): void => {
    if (!draggable || depth > 0) return
    event.preventDefault()
    setDragOver(false)
    onDrop?.(task.id)
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        draggable={draggable && depth === 0}
        onDragStart={handleDragStart}
        onDragEnd={() => setDragOver(false)}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => setSelectedTaskId(task.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') setSelectedTaskId(task.id)
        }}
        className={clsx(
          'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition',
          selected
            ? 'border-accent bg-accent-muted/40'
            : 'border-surface-border bg-surface-elevated hover:border-gray-600',
          dragOver && 'border-accent'
        )}
        style={{ marginLeft: depth * 20 }}
      >
        <div className="flex shrink-0 items-center gap-0.5">
          {bulkMode && depth === 0 && (
            <input
              type="checkbox"
              checked={bulkSelected}
              onClick={(event) => event.stopPropagation()}
              onChange={() => onBulkToggle?.(task.id)}
              className="mt-0.5"
            />
          )}
          {draggable && depth === 0 && (
            <GripVertical size={16} className="mt-0.5 text-gray-500" />
          )}
          {children.length > 0 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setExpanded((value) => !value)
              }}
              className="mt-0.5 text-gray-400 hover:text-gray-200"
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <span className="w-4" />
          )}
        </div>

        <input
          type="checkbox"
          checked={task.status === 'done'}
          disabled={task.status !== 'done' && !completable}
          onClick={(event) => void toggleDone(event)}
          onChange={() => undefined}
          className="mt-1"
          title={blocked ? 'Задача заблокирована зависимостью' : undefined}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {task.pinned && <Pin size={14} className="shrink-0 text-amber-400" />}
            {blocked && task.status === 'todo' && (
              <span title="Заблокировано зависимостью">
                <Lock size={14} className="shrink-0 text-orange-400" />
              </span>
            )}
            <span
              className={clsx(
                'truncate text-sm',
                task.status === 'done' && 'text-gray-500 line-through'
              )}
            >
              {task.title}
            </span>
            {task.priority === 'important' && (
              <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-xs text-red-300">
                Важно
              </span>
            )}
            {children.length > 0 && (
              <span className="text-xs text-gray-500">{children.length} подз.</span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            {dueLabel && (
              <p className={clsx('text-xs', dueLabel === 'Просрочено' ? 'text-red-400' : 'text-gray-400')}>
                {dueLabel}
                {task.dueTime ? ` · ${task.dueTime}` : ''}
              </p>
            )}
            {task.recurrence !== 'none' && (
              <span className="text-xs text-purple-400">↻ {task.recurrence}</span>
            )}
            {completedLabel && (
              <p className="text-xs text-gray-500">Выполнено: {completedLabel}</p>
            )}
            {tags.map((tag) => (
              <span key={tag} className="text-xs text-blue-400/80">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {expanded &&
        children.map((child) => (
          <TaskItem key={child.id} task={child} depth={depth + 1} view={view} />
        ))}
    </div>
  )
}