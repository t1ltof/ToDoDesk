import { v4 as uuidv4 } from 'uuid'
import type { ChecklistItem, DataPayload, Priority, Task } from '../../../shared/schema'

function nowIso(): string {
  return new Date().toISOString()
}

const defaultTaskFields = {
  dueDateEnd: null,
  dueTime: null,
  timeOfDay: null,
  recurrenceExceptions: [] as string[],
  dependsOnTaskId: null,
  pinned: false,
  archived: false
} as const

function reminderForDueDate(dueDate: string): string {
  return new Date(`${dueDate}T09:00:00`).toISOString()
}

export function syncReminder(data: DataPayload, taskId: string, dueDate: string | null): DataPayload {
  const others = data.reminders.filter(
    (item) => item.taskId !== taskId || item.kind !== 'dueDate'
  )

  if (!dueDate) {
    return { ...data, reminders: others }
  }

  return {
    ...data,
    reminders: [
      ...others,
      { id: uuidv4(), taskId, remindAt: reminderForDueDate(dueDate), kind: 'dueDate' as const }
    ]
  }
}

function wouldCreateDependencyCycle(
  data: DataPayload,
  taskId: string,
  dependsOnTaskId: string | null
): boolean {
  if (!dependsOnTaskId) return false

  const visited = new Set<string>()
  let current: string | null = dependsOnTaskId

  while (current) {
    if (current === taskId) return true
    if (visited.has(current)) return false
    visited.add(current)
    const task = data.tasks.find((item) => item.id === current)
    current = task?.dependsOnTaskId ?? null
  }

  return false
}

function pruneBoardForTaskIds(data: DataPayload, taskIds: Set<string>): DataPayload {
  const removedNodeIds = new Set(
    data.boardNodes
      .filter((node) => node.taskId && taskIds.has(node.taskId))
      .map((node) => node.id)
  )

  return {
    ...data,
    boardNodes: data.boardNodes.filter((node) => !removedNodeIds.has(node.id)),
    boardLinks: data.boardLinks.filter(
      (link) => !removedNodeIds.has(link.fromNodeId) && !removedNodeIds.has(link.toNodeId)
    ),
    drafts: data.drafts.filter((draft) => !taskIds.has(draft.entityId))
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
  const attachments = data.taskAttachments.filter((item) => ids.has(item.taskId))
  for (const attachment of attachments) {
    void window.tododesk.deleteAttachmentFile(attachment.filePath)
  }

  const next = {
    ...data,
    tasks: data.tasks.filter((task) => !ids.has(task.id)),
    taskTags: data.taskTags.filter((link) => !ids.has(link.taskId)),
    checklistItems: data.checklistItems.filter((item) => !ids.has(item.taskId)),
    reminders: data.reminders.filter((item) => !ids.has(item.taskId)),
    taskAttachments: data.taskAttachments.filter((item) => !ids.has(item.taskId)),
    sprints: data.sprints.map((sprint) => ({
      ...sprint,
      taskIds: sprint.taskIds.filter((id) => !ids.has(id))
    }))
  }

  return pruneBoardForTaskIds(next, ids)
}

export function updateTask(
  data: DataPayload,
  taskId: string,
  patch: Partial<
    Pick<
      Task,
      | 'title'
      | 'description'
      | 'priority'
      | 'dueDate'
      | 'dueDateEnd'
      | 'dueTime'
      | 'timeOfDay'
      | 'projectId'
      | 'status'
      | 'recurrence'
      | 'dependsOnTaskId'
      | 'pinned'
      | 'archived'
    >
  >
): DataPayload {
  const updatedTasks = data.tasks.map((task) =>
    task.id === taskId
      ? { ...task, ...patch, updatedAt: nowIso() }
      : task
  )

  let next: DataPayload = { ...data, tasks: updatedTasks }

  if ('dependsOnTaskId' in patch && wouldCreateDependencyCycle(next, taskId, patch.dependsOnTaskId ?? null)) {
    return data
  }

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
    recurrence: 'none',
    sortOrder: data.tasks.filter((item) => item.parentId === parent.id).length,
    createdAt: now,
    updatedAt: now,
    ...defaultTaskFields
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
    recurrence: 'none',
    sortOrder: data.tasks.length,
    createdAt: now,
    updatedAt: now,
    ...defaultTaskFields
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

export function clearCompletedTasks(data: DataPayload): DataPayload {
  const doneIds = new Set(data.tasks.filter((task) => task.status === 'done').map((task) => task.id))

  const next = {
    ...data,
    tasks: data.tasks.filter((task) => !doneIds.has(task.id)),
    taskTags: data.taskTags.filter((link) => !doneIds.has(link.taskId)),
    checklistItems: data.checklistItems.filter((item) => !doneIds.has(item.taskId)),
    reminders: data.reminders.filter((item) => !doneIds.has(item.taskId)),
    taskAttachments: data.taskAttachments.filter((item) => !doneIds.has(item.taskId)),
    sprints: data.sprints.map((sprint) => ({
      ...sprint,
      taskIds: sprint.taskIds.filter((id) => !doneIds.has(id))
    }))
  }

  return pruneBoardForTaskIds(next, doneIds)
}

export function reorderTasks(data: DataPayload, orderedIds: string[]): DataPayload {
  const orderMap = new Map(orderedIds.map((id, index) => [id, index]))

  return {
    ...data,
    tasks: data.tasks.map((task) =>
      orderMap.has(task.id) ? { ...task, sortOrder: orderMap.get(task.id)! } : task
    )
  }
}

export function addReminderInHours(data: DataPayload, taskId: string, hours: number): DataPayload {
  const remindAt = new Date(Date.now() + hours * 3_600_000).toISOString()

  return {
    ...data,
    reminders: [...data.reminders, { id: uuidv4(), taskId, remindAt, kind: 'custom' as const }]
  }
}