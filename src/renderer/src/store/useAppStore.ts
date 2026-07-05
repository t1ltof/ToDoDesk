import { create } from 'zustand'
import type { DataPayload, Project, Status, Task, ViewId } from '../../../shared/schema'

interface AppState {
  data: DataPayload
  activeView: ViewId
  searchQuery: string
  selectedTaskId: string | null
  loading: boolean
  setActiveView: (view: ViewId) => void
  setSearchQuery: (query: string) => void
  setSelectedTaskId: (taskId: string | null) => void
  setData: (data: DataPayload) => void
  load: () => Promise<void>
  persist: (data: DataPayload) => Promise<void>
}

export const useAppStore = create<AppState>((set) => ({
  data: {
    projects: [],
    tags: [],
    tasks: [],
    taskTags: [],
    checklistItems: [],
    reminders: []
  },
  activeView: 'today',
  searchQuery: '',
  selectedTaskId: null,
  loading: true,

  setActiveView: (view) => set({ activeView: view, selectedTaskId: null }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),
  setData: (data) => set({ data }),

  load: async () => {
    const data = await window.tododesk.loadData()
    set({ data, loading: false })
  },

  persist: async (data) => {
    const saved = await window.tododesk.saveData(data)
    set({ data: saved })
  }
}))

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function matchesSearch(task: Task, query: string): boolean {
  if (!query) return true
  return (
    task.title.toLowerCase().includes(query) ||
    task.description.toLowerCase().includes(query)
  )
}

export function countCompletedTasks(data: DataPayload): number {
  return data.tasks.filter((task) => task.status === 'done').length
}

export function filterTasksForView(
  data: DataPayload,
  view: ViewId,
  searchQuery: string
): Task[] {
  const query = searchQuery.trim().toLowerCase()
  let tasks = data.tasks.filter((task) => matchesSearch(task, query))

  if (view === 'today') {
    const today = todayKey()
    tasks = tasks.filter(
      (task) =>
        task.status === 'todo' &&
        task.dueDate !== null &&
        task.dueDate <= today
    )
  } else if (view === 'inbox') {
    tasks = tasks.filter((task) => task.projectId === null && task.status === 'todo')
  } else if (view === 'all') {
    tasks = tasks.filter((task) => task.status === 'todo')
  } else if (view === 'completed') {
    tasks = tasks.filter((task) => task.status === 'done' && task.parentId === null)
    return tasks.sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return bTime - aTime
    })
  } else if (view.startsWith('project:')) {
    const projectId = view.replace('project:', '')
    tasks = tasks.filter(
      (task) => task.projectId === projectId && task.parentId === null && task.status === 'todo'
    )
  }

  return tasks.sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getChildTasks(
  data: DataPayload,
  parentId: string,
  status?: Status
): Task[] {
  return data.tasks
    .filter((task) => task.parentId === parentId && (!status || task.status === status))
    .sort((a, b) => {
      if (status === 'done') {
        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0
        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0
        return bTime - aTime
      }
      return a.sortOrder - b.sortOrder
    })
}

export function getTaskTags(data: DataPayload, taskId: string): string[] {
  return data.taskTags
    .filter((link) => link.taskId === taskId)
    .map((link) => data.tags.find((tag) => tag.id === link.tagId)?.name)
    .filter((name): name is string => Boolean(name))
}

export function sortProjects(projects: Project[]): Project[] {
  return [...projects].filter((p) => !p.archived).sort((a, b) => a.sortOrder - b.sortOrder)
}

export function formatCompletedDate(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}