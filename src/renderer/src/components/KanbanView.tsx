import { Columns3, List, Search } from 'lucide-react'
import type { ViewId } from '../../../shared/schema'
import { filterTasksForView, useAppStore } from '../store/useAppStore'
import { completeTask, reopenTask } from '../utils/recurrence'
import clsx from 'clsx'

interface KanbanViewProps {
  view: ViewId
}

export default function KanbanView({ view }: KanbanViewProps): JSX.Element {
  const { data, persist, setSelectedTaskId, searchQuery, setSearchQuery, setActiveView } =
    useAppStore()
  const projectId = view.replace('kanban:', '')
  const projectListView = `project:${projectId}` as ViewId
  const project = data.projects.find((p) => p.id === projectId)

  const query = searchQuery.trim().toLowerCase()
  const matchesSearch = (title: string, description: string): boolean =>
    !query || title.toLowerCase().includes(query) || description.toLowerCase().includes(query)

  const todoTasks = filterTasksForView(data, view, searchQuery).filter((t) => t.status === 'todo')
  const doneTasks = data.tasks.filter(
    (t) =>
      t.projectId === projectId &&
      t.parentId === null &&
      t.status === 'done' &&
      matchesSearch(t.title, t.description)
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
      <header className="flex items-center justify-between border-b border-surface-border px-6 py-4">
        <div>
          <h2 className="text-xl font-semibold">{project?.name ?? 'Проект'}</h2>
          <p className="text-sm text-gray-400">Kanban</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-surface-border">
            <button
              type="button"
              onClick={() => setActiveView(projectListView)}
              className="p-2 text-gray-400 hover:text-gray-200"
              title="Список"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              className="bg-accent-muted p-2 text-blue-300"
              title="Kanban"
            >
              <Columns3 size={16} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск..."
              className="rounded-lg border border-surface-border bg-surface-elevated py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>
      </header>
      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        <Column title={`К выполнению (${todoTasks.length})`} tasks={todoTasks} done={false} />
        <Column title={`Выполнено (${doneTasks.length})`} tasks={doneTasks} done={true} />
      </div>
    </section>
  )
}