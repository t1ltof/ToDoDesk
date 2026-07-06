import type { DataPayload } from '../../../shared/schema'

export interface CalendarFilterOptions {
  search: string
  projectId: string | null
  tagId: string | null
  importantOnly: boolean
}

export function applyCalendarFilters(data: DataPayload, options: CalendarFilterOptions): DataPayload {
  const query = options.search.trim().toLowerCase()
  let tasks = data.tasks

  if (query) {
    tasks = tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query)
    )
  }

  if (options.projectId) {
    tasks = tasks.filter((task) => task.projectId === options.projectId)
  }

  if (options.tagId) {
    const taskIds = new Set(
      data.taskTags.filter((link) => link.tagId === options.tagId).map((link) => link.taskId)
    )
    tasks = tasks.filter((task) => taskIds.has(task.id))
  }

  if (options.importantOnly) {
    tasks = tasks.filter((task) => task.priority === 'important')
  }

  return { ...data, tasks }
}

export function filterNotes(data: DataPayload, search: string) {
  const query = search.trim().toLowerCase()
  if (!query) return data.notes

  return data.notes.filter(
    (note) =>
      note.title.toLowerCase().includes(query) || note.content.toLowerCase().includes(query)
  )
}