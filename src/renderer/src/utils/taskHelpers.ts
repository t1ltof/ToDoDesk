import { v4 as uuidv4 } from 'uuid'
import type { ChecklistItem, DataPayload, Priority, Task } from '../../../shared/schema'

function nowIso(): string {
  return new Date().toISOString()
}

function reminderForDueDate(dueDate: string): string {
  return new Date(`${dueDate}T09:00:00`).toISOString()
}

export function syncReminder(data: DataPayload, taskId: string, dueDate: string | null): DataPayload {
  const others = data.reminders.filter((item) => item.taskId !== taskId)

  if (!dueDate) {
    return { ...data, reminders: others }
  }

  return {
    ...data,
    reminders: [
      ...others,
      { id: uuidv4(), taskId, remindAt: reminderForDueDate(dueDate) }
    ]
  }
}

export function collectDescendantIds(data: DataPayload, taskId: string): Set<string> {
  const ids = new Set<string>([taskId])
  let added = true

  while (added) {
    added = false
    for (const task of data.tasks) {
      if (task.parentId && ids.has(task.parentId) && !ids.has(task.id)) {
        ids.add(task.id)
        added = true
      }
    }
  }

  return ids
}

export function deleteTaskTree(data: DataPayload, taskId: string): DataPayload {
  const ids = collectDescendantIds(data, taskId)

  return {
    projects: data.projects,
    tags: data.tags,
    tasks: data.tasks.filter((task) => !ids.has(task.id)),
    taskTags: data.taskTags.filter((link) => !ids.has(link.taskId)),
    checklistItems: data.checklistItems.filter((item) => !ids.has(item.taskId)),
    reminders: data.reminders.filter((item) => !ids.has(item.taskId))
  }
}

export function updateTask(
  data: DataPayload,
  taskId: string,
  patch: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'dueDate' | 'projectId' | 'status'>>
): DataPayload {
  const updatedTasks = data.tasks.map((task) =>
    task.id === taskId
      ? { ...task, ...patch, updatedAt: nowIso() }
      : task
  )

  let next: DataPayload = { ...data, tasks: updatedTasks }

  if ('dueDate' in patch) {
    next = syncReminder(next, taskId, patch.dueDate ?? null)
  }

  if ('status' in patch && patch.status === 'done') {
    next = {
      ...next,
      tasks: next.tasks.map((task) =>
        task.id === taskId ? { ...task, completedAt: nowIso() } : task
      )
    }
  }

  if ('status' in patch && patch.status === 'todo') {
    next = {
      ...next,
      tasks: next.tasks.map((task) =>
        task.id === taskId ? { ...task, completedAt: null } : task
      )
    }
  }

  return next
}

export function createSubtask(
  data: DataPayload,
  parent: Task,
  title: string
): DataPayload {
  const now = nowIso()
  const task: Task = {
    id: uuidv4(),
    projectId: parent.projectId,
    parentId: parent.id,
    title,
    description: '',
    status: 'todo',
    priority: parent.priority,
    dueDate: parent.dueDate,
    completedAt: null,
    sortOrder: data.tasks.filter((item) => item.parentId === parent.id).length,
    createdAt: now,
    updatedAt: now
  }

  let next: DataPayload = { ...data, tasks: [...data.tasks, task] }
  if (task.dueDate) next = syncReminder(next, task.id, task.dueDate)
  return next
}

export function createRootTask(
  data: DataPayload,
  input: {
    title: string
    projectId: string | null
    dueDate: string | null
  }
): DataPayload {
  const now = nowIso()
  const task: Task = {
    id: uuidv4(),
    projectId: input.projectId,
    parentId: null,
    title: input.title,
    description: '',
    status: 'todo',
    priority: 'normal',
    dueDate: input.dueDate,
    completedAt: null,
    sortOrder: data.tasks.length,
    createdAt: now,
    updatedAt: now
  }

  let next: DataPayload = { ...data, tasks: [...data.tasks, task] }
  if (task.dueDate) next = syncReminder(next, task.id, task.dueDate)
  return next
}

export function toggleTaskTag(data: DataPayload, taskId: string, tagId: string): DataPayload {
  const exists = data.taskTags.some((link) => link.taskId === taskId && link.tagId === tagId)
  return {
    ...data,
    taskTags: exists
      ? data.taskTags.filter((link) => !(link.taskId === taskId && link.tagId === tagId))
      : [...data.taskTags, { taskId, tagId }]
  }
}

export function createTag(data: DataPayload, name: string): DataPayload {
  const trimmed = name.trim()
  if (!trimmed) return data

  const existing = data.tags.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase())
  if (existing) return data

  return {
    ...data,
    tags: [...data.tags, { id: uuidv4(), name: trimmed }]
  }
}

export function addChecklistItem(data: DataPayload, taskId: string, text: string): DataPayload {
  const item: ChecklistItem = {
    id: uuidv4(),
    taskId,
    text,
    completed: false,
    sortOrder: data.checklistItems.filter((entry) => entry.taskId === taskId).length
  }

  return { ...data, checklistItems: [...data.checklistItems, item] }
}

export function toggleChecklistItem(data: DataPayload, itemId: string): DataPayload {
  return {
    ...data,
    checklistItems: data.checklistItems.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    )
  }
}

export function removeChecklistItem(data: DataPayload, itemId: string): DataPayload {
  return {
    ...data,
    checklistItems: data.checklistItems.filter((item) => item.id !== itemId)
  }
}

export function setTaskPriority(data: DataPayload, taskId: string, priority: Priority): DataPayload {
  return updateTask(data, taskId, { priority })
}