import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { ViewId } from '../../../shared/schema'
import { filterTasksForView, useAppStore } from '../store/useAppStore'
import TaskItem from './TaskItem'

const viewTitles: Record<string, string> = {
  today: 'Сегодня',
  inbox: 'Входящие',
  all: 'Все задачи'
}

function getViewTitle(view: ViewId, projectName?: string): string {
  if (view.startsWith('project:')) return projectName ?? 'Проект'
  return viewTitles[view] ?? 'Задачи'
}

export default function TaskPanel(): JSX.Element {
  const { data, activeView, searchQuery, setSearchQuery, persist } = useAppStore()
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const projectName = activeView.startsWith('project:')
    ? data.projects.find((p) => p.id === activeView.replace('project:', ''))?.name
    : undefined

  const tasks = useMemo(
    () => filterTasksForView(data, activeView, searchQuery),
    [data, activeView, searchQuery]
  )

  const addTask = async (): Promise<void> => {
    const title = newTaskTitle.trim()
    if (!title) return

    const now = new Date().toISOString()
    const projectId = activeView.startsWith('project:')
      ? activeView.replace('project:', '')
      : null

    const task = {
      id: uuidv4(),
      projectId,
      parentId: null,
      title,
      description: '',
      status: 'todo' as const,
      priority: 'normal' as const,
      dueDate: activeView === 'today' ? now.slice(0, 10) : null,
      completedAt: null,
      sortOrder: data.tasks.length,
      createdAt: now,
      updatedAt: now
    }

    await persist({ ...data, tasks: [...data.tasks, task] })
    setNewTaskTitle('')
  }

  const addProject = async (): Promise<void> => {
    const name = prompt('Название проекта')
    if (!name?.trim()) return

    const project = {
      id: uuidv4(),
      name: name.trim(),
      color: '#3b82f6',
      sortOrder: data.projects.length,
      archived: false
    }

    await persist({ ...data, projects: [...data.projects, project] })
  }

  return (
    <section className="flex h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-surface-border px-6 py-4">
        <div>
          <h2 className="text-xl font-semibold">{getViewTitle(activeView, projectName)}</h2>
          <p className="text-sm text-gray-400">{tasks.length} задач</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Поиск..."
              className="rounded-lg border border-surface-border bg-surface-elevated py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <button
            type="button"
            onClick={() => void addProject()}
            className="rounded-lg border border-surface-border px-3 py-2 text-sm text-gray-300 hover:bg-surface-elevated"
          >
            + Проект
          </button>
        </div>
      </header>

      <div className="border-b border-surface-border px-6 py-3">
        <div className="flex gap-2">
          <input
            value={newTaskTitle}
            onChange={(event) => setNewTaskTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void addTask()
            }}
            placeholder="Новая задача..."
            className="flex-1 rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => void addTask()}
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            <Plus size={16} />
            Добавить
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border px-6 py-12 text-center text-gray-400">
            Задач пока нет. Добавьте первую задачу выше.
          </div>
        ) : (
          tasks.map((task) => <TaskItem key={task.id} task={task} />)
        )}
      </div>
    </section>
  )
}