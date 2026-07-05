import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import type { Task } from '../../../shared/schema'
import { getChildTasks, getTaskTags, useAppStore } from '../store/useAppStore'
import clsx from 'clsx'

interface TaskItemProps {
  task: Task
  depth?: number
}

export default function TaskItem({ task, depth = 0 }: TaskItemProps): JSX.Element {
  const { data, persist, selectedTaskId, setSelectedTaskId } = useAppStore()
  const children = getChildTasks(data, task.id)
  const [expanded, setExpanded] = useState(true)
  const tags = getTaskTags(data, task.id)
  const selected = selectedTaskId === task.id

  const toggleDone = async (event: MouseEvent): Promise<void> => {
    event.stopPropagation()
    const now = new Date().toISOString()
    const nextStatus = task.status === 'done' ? 'todo' : 'done'
    const updatedTasks = data.tasks.map((item) =>
      item.id === task.id
        ? {
            ...item,
            status: nextStatus,
            completedAt: nextStatus === 'done' ? now : null,
            updatedAt: now
          }
        : item
    )

    await persist({ ...data, tasks: updatedTasks })
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setSelectedTaskId(task.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') setSelectedTaskId(task.id)
        }}
        className={clsx(
          'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition',
          selected
            ? 'border-accent bg-accent-muted/40'
            : 'border-surface-border bg-surface-elevated hover:border-gray-600'
        )}
        style={{ marginLeft: depth * 20 }}
      >
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

        <input
          type="checkbox"
          checked={task.status === 'done'}
          onClick={(event) => void toggleDone(event)}
          onChange={() => undefined}
          className="mt-1"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
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
            {task.dueDate && <p className="text-xs text-gray-400">Срок: {task.dueDate}</p>}
            {tags.map((tag) => (
              <span key={tag} className="text-xs text-blue-400/80">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {expanded &&
        children.map((child) => <TaskItem key={child.id} task={child} depth={depth + 1} />)}
    </div>
  )
}