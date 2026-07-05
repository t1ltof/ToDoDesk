import { create } from 'zustand'
import type { DataPayload, Project, Task, ViewId } from '../../../shared/schema'

interface AppState {
  data: DataPayload
  activeView: ViewId
  searchQuery: string
  loading: boolean
  setActiveView: (view: ViewId) => void
  setSearchQuery: (query: string) => void
  setData: (data: DataPayload) => void
  load: () => Promise<void>
  persist: (data: DataPayload) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
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
  loading: true,

  setActiveView: (view) => set({ activeView: view }),
  setSearchQuery: (query) => set({ searchQuery: query }),
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
    if (query && !task.title.toLowerCase().includes(query)) return false
    return true
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

export function sortProjects(projects: Project[]): Project[] {
  return [...projects].filter((p) => !p.archived).sort((a, b) => a.sortOrder - b.sortOrder)
}