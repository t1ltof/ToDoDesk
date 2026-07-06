import { v4 as uuidv4 } from 'uuid'
import type { DataPayload, Template } from '../../../shared/schema'
import { syncReminder } from './taskHelpers'

export function createTemplate(
  data: DataPayload,
  input: Omit<Template, 'id'>
): DataPayload {
  return {
    ...data,
    templates: [...data.templates, { ...input, id: uuidv4() }]
  }
}

export function deleteTemplate(data: DataPayload, templateId: string): DataPayload {
  return {
    ...data,
    templates: data.templates.filter((tpl) => tpl.id !== templateId)
  }
}

export function applyTemplate(data: DataPayload, templateId: string): DataPayload {
  const template = data.templates.find((tpl) => tpl.id === templateId)
  if (!template) return data

  const now = new Date().toISOString()
  const taskId = uuidv4()
  const task = {
    id: taskId,
    projectId: template.projectId,
    parentId: null,
    title: template.title,
    description: template.description,
    status: 'todo' as const,
    priority: template.priority,
    dueDate: null,
    dueDateEnd: null,
    dueTime: null,
    timeOfDay: null,
    completedAt: null,
    recurrence: 'none' as const,
    recurrenceExceptions: [] as string[],
    dependsOnTaskId: null,
    pinned: false,
    archived: false,
    sortOrder: data.tasks.length,
    createdAt: now,
    updatedAt: now
  }

  const checklistItems = template.checklistTexts.map((text, index) => ({
    id: uuidv4(),
    taskId,
    text,
    completed: false,
    sortOrder: index
  }))

  const taskTags = template.tagIds.map((tagId) => ({ taskId, tagId }))

  let next: DataPayload = {
    ...data,
    tasks: [...data.tasks, task],
    checklistItems: [...data.checklistItems, ...checklistItems],
    taskTags: [...data.taskTags, ...taskTags]
  }

  return next
}