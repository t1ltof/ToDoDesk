import type { DataPayload } from '../../../shared/schema'
import { appendActivityLog } from './activityLog'
import { deleteTaskTree, syncReminder } from './taskHelpers'

function nowIso(): string {
  return new Date().toISOString()
}

export function bulkMoveToProject(
  data: DataPayload,
  taskIds: string[],
  projectId: string | null
): DataPayload {
  const ids = new Set(taskIds)
  const next = {
    ...data,
    tasks: data.tasks.map((task) =>
      ids.has(task.id) ? { ...task, projectId, updatedAt: nowIso() } : task
    )
  }

  return appendActivityLog(next, `Перенесено задач: ${taskIds.length}`, 'task')
}

export function bulkAddTag(data: DataPayload, taskIds: string[], tagId: string): DataPayload {
  const newLinks = taskIds
    .filter(
      (taskId) => !data.taskTags.some((link) => link.taskId === taskId && link.tagId === tagId)
    )
    .map((taskId) => ({ taskId, tagId }))

  const next = { ...data, taskTags: [...data.taskTags, ...newLinks] }
  return appendActivityLog(next, `Добавлен тег к ${taskIds.length} задачам`, 'task')
}

export function bulkSetDueDate(
  data: DataPayload,
  taskIds: string[],
  dueDate: string | null
): DataPayload {
  const ids = new Set(taskIds)
  let next: DataPayload = {
    ...data,
    tasks: data.tasks.map((task) =>
      ids.has(task.id) ? { ...task, dueDate, updatedAt: nowIso() } : task
    )
  }

  for (const taskId of taskIds) {
    next = syncReminder(next, taskId, dueDate)
  }

  return appendActivityLog(next, `Обновлён срок у ${taskIds.length} задач`, 'task')
}

export function bulkArchive(data: DataPayload, taskIds: string[], archived: boolean): DataPayload {
  const ids = new Set(taskIds)
  const next = {
    ...data,
    tasks: data.tasks.map((task) =>
      ids.has(task.id) ? { ...task, archived, updatedAt: nowIso() } : task
    )
  }

  const summary = archived
    ? `Архивировано задач: ${taskIds.length}`
    : `Разархивировано задач: ${taskIds.length}`

  return appendActivityLog(next, summary, 'task')
}

export function bulkDelete(data: DataPayload, taskIds: string[]): DataPayload {
  let next = data
  for (const taskId of taskIds) {
    next = deleteTaskTree(next, taskId)
  }

  return appendActivityLog(next, `Удалено задач: ${taskIds.length}`, 'task', null, 'delete')
}

export function bulkPin(data: DataPayload, taskIds: string[], pinned: boolean): DataPayload {
  const ids = new Set(taskIds)
  const next = {
    ...data,
    tasks: data.tasks.map((task) =>
      ids.has(task.id) ? { ...task, pinned, updatedAt: nowIso() } : task
    )
  }

  const summary = pinned
    ? `Закреплено задач: ${taskIds.length}`
    : `Откреплено задач: ${taskIds.length}`

  return appendActivityLog(next, summary, 'task')
}