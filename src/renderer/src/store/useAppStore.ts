import { create } from 'zustand'
import type { DataPayload, Project, Task, ViewId } from '../../../shared/schema'

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

export function filterTasksForView(
  data: DataPayload,
  view: ViewId,
  searchQuery: string
): Task[] {
  const query = searchQuery.trim().toLowerCase()
  let tasks = data.tasks.filter((task) => {
    if (!query) return true
    return (
      task.title.toLowerCase().includes(query) ||
      task.description.toLowerCase().includes(query)
    )
  })

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
  } else if (view.startsWith('project:')) {
    const projectId = view.replace('project:', '')
    tasks = tasks.filter(
      (task) => task.projectId === projectId && task.parentId === null
    )
  }

  return tasks.sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getChildTasks(data: DataPayload, parentId: string): Task[] {
  return data.tasks
    .filter((task) => task.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
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