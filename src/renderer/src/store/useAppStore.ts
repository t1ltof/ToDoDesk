import { create } from 'zustand'
import type { DataPayload, Project, ProjectViewMode, Status, Task, ViewId } from '../../../shared/schema'
import { createEmptyData } from '../../../shared/schema'

interface AppState {
  data: DataPayload
  activeView: ViewId
  projectViewMode: ProjectViewMode
  searchQuery: string
  selectedTaskId: string | null
  undoSnapshot: DataPayload | null
  loading: boolean
  setActiveView: (view: ViewId) => void
  setProjectViewMode: (mode: ProjectViewMode) => void
  setSearchQuery: (query: string) => void
  setSelectedTaskId: (taskId: string | null) => void
  setData: (data: DataPayload) => void
  load: () => Promise<void>
  persist: (data: DataPayload) => Promise<void>
  undo: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  data: createEmptyData(),
  activeView: 'today',
  projectViewMode: 'list',
  searchQuery: '',
  selectedTaskId: null,
  undoSnapshot: null,
  loading: true,

  setActiveView: (view) => {
    set({ activeView: view, selectedTaskId: null })
    if (view.startsWith('kanban:')) set({ projectViewMode: 'kanban' })
    if (view.startsWith('project:')) set({ projectViewMode: 'list' })
  },
  setProjectViewMode: (mode) => set({ projectViewMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),
  setData: (data) => set({ data }),

  load: async () => {
    const data = await window.tododesk.loadData()
    set({ data, loading: false })
  },

  persist: async (data) => {
    const current = get().data
    set({ undoSnapshot: structuredClone(current) })
    const saved = await window.tododesk.saveData(data)
    set({ data: saved })
  },

  undo: async () => {
    const snapshot = get().undoSnapshot
    if (!snapshot) return
    const saved = await window.tododesk.saveData(snapshot)
    set({ data: saved, undoSnapshot: null })
  }
}))

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function matchesSearch(task: Task, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return task.title.toLowerCase().includes(q) || task.description.toLowerCase().includes(q)
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
      (task) => task.status === 'todo' && task.dueDate !== null && task.dueDate <= today
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
  } else if (view.startsWith('tag:')) {
    const tagId = view.replace('tag:', '')
    const taskIds = new Set(
      data.taskTags.filter((link) => link.tagId === tagId).map((link) => link.taskId)
    )
    tasks = tasks.filter(
      (task) => taskIds.has(task.id) && task.parentId === null && task.status === 'todo'
    )
  } else if (view.startsWith('project:') || view.startsWith('kanban:')) {
    const projectId = view.replace('project:', '').replace('kanban:', '')
    tasks = tasks.filter(
      (task) => task.projectId === projectId && task.parentId === null
    )
    if (view.startsWith('project:')) {
      tasks = tasks.filter((task) => task.status === 'todo')
    }
  }

  return tasks.sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getChildTasks(data: DataPayload, parentId: string, status?: Status): Task[] {
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

export function formatDueDateLabel(dueDate: string | null): string | null {
  if (!dueDate) return null
  const today = todayKey()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = tomorrow.toISOString().slice(0, 10)
  if (dueDate === today) return 'Сегодня'
  if (dueDate === tomorrowKey) return 'Завтра'
  if (dueDate < today) return 'Просрочено'
  const diff = Math.ceil(
    (new Date(`${dueDate}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) /
      86_400_000
  )
  if (diff <= 7) return `Через ${diff} дн.`
  return dueDate
}

export function getWeekDays(baseDate = new Date()): string[] {
  const day = baseDate.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(baseDate)
  monday.setDate(baseDate.getDate() + mondayOffset)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

export function getStats(data: DataPayload) {
  const today = todayKey()
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)

  const done = data.tasks.filter((t) => t.status === 'done')
  const doneWeek = done.filter((t) => t.completedAt && new Date(t.completedAt) >= weekAgo)
  const doneMonth = done.filter((t) => t.completedAt && new Date(t.completedAt) >= monthAgo)
  const overdue = data.tasks.filter(
    (t) => t.status === 'todo' && t.dueDate && t.dueDate < today
  )
  const todayCount = data.tasks.filter(
    (t) => t.status === 'todo' && t.dueDate && t.dueDate <= today
  )

  return {
    total: data.tasks.length,
    active: data.tasks.filter((t) => t.status === 'todo').length,
    doneWeek: doneWeek.length,
    doneMonth: doneMonth.length,
    overdue: overdue.length,
    today: todayCount.length
  }
}