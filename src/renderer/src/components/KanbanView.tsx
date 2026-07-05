import type { ViewId } from '../../../shared/schema'
import { filterTasksForView, useAppStore } from '../store/useAppStore'
import { completeTask, reopenTask } from '../utils/recurrence'
import clsx from 'clsx'

interface KanbanViewProps {
  view: ViewId
}

export default function KanbanView({ view }: KanbanViewProps): JSX.Element {
  const { data, persist, setSelectedTaskId, searchQuery } = useAppStore()
  const projectId = view.replace('kanban:', '')
  const project = data.projects.find((p) => p.id === projectId)

  const todoTasks = filterTasksForView(data, view, searchQuery).filter((t) => t.status === 'todo')
  const doneTasks = data.tasks.filter(
    (t) => t.projectId === projectId && t.parentId === null && t.status === 'done'
  )

  const toggle = async (taskId: string, done: boolean): Promise<void> => {
    const current = useAppStore.getState().data
    await persist(done ? reopenTask(current, taskId) : completeTask(current, taskId))
  }

  const Column = ({
    title,
    tasks,
    done
  }: {
    title: string
    tasks: typeof todoTasks
    done: boolean
  }) => (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-surface-border bg-surface-elevated">
      <div className="border-b border-surface-border px-4 py-3 font-medium">{title}</div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => setSelectedTaskId(task.id)}
            className="w-full rounded-lg border border-surface-border bg-surface p-3 text-left text-sm hover:border-accent"
          >
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={done}
                onClick={(e) => e.stopPropagation()}
                onChange={() => void toggle(task.id, done)}
              />
              <span className={clsx(done && 'text-gray-500 line-through')}>{task.title}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <section className="flex h-full flex-1 flex-col">
      <header className="border-b border-surface-border px-6 py-4">
        <h2 className="text-xl font-semibold">Kanban — {project?.name ?? 'Проект'}</h2>
      </header>
      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        <Column title={`К выполнению (${todoTasks.length})`} tasks={todoTasks} done={false} />
        <Column title={`Выполнено (${doneTasks.length})`} tasks={doneTasks} done={true} />
      </div>
    </section>
  )
}