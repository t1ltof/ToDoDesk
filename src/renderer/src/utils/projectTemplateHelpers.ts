import { v4 as uuidv4 } from 'uuid'
import type { DataPayload, ProjectTemplate } from '../../../shared/schema'

type ProjectTemplateTask = ProjectTemplate['tasks'][number]
import { createRootTask } from './taskHelpers'

function nowIso(): string {
  return new Date().toISOString()
}

export function createProjectTemplate(
  data: DataPayload,
  input: Omit<ProjectTemplate, 'id'>
): DataPayload {
  const template: ProjectTemplate = { ...input, id: uuidv4() }
  return { ...data, projectTemplates: [...data.projectTemplates, template] }
}

export function updateProjectTemplate(
  data: DataPayload,
  templateId: string,
  patch: Partial<Omit<ProjectTemplate, 'id'>>
): DataPayload {
  return {
    ...data,
    projectTemplates: data.projectTemplates.map((t) =>
      t.id === templateId ? { ...t, ...patch } : t
    )
  }
}

export function deleteProjectTemplate(data: DataPayload, templateId: string): DataPayload {
  return {
    ...data,
    projectTemplates: data.projectTemplates.filter((t) => t.id !== templateId)
  }
}

export function applyProjectTemplate(data: DataPayload, templateId: string): DataPayload {
  const template = data.projectTemplates.find((t) => t.id === templateId)
  if (!template) return data

  const projectId = uuidv4()
  const project = {
    id: projectId,
    name: template.name,
    color: template.projectColor,
    icon: template.projectIcon,
    sortOrder: data.projects.length,
    archived: false
  }

  let next: DataPayload = { ...data, projects: [...data.projects, project] }

  for (const taskTpl of template.tasks) {
    next = createTaskFromTemplate(next, projectId, taskTpl)
  }

  return next
}

function createTaskFromTemplate(
  data: DataPayload,
  projectId: string,
  taskTpl: ProjectTemplateTask
): DataPayload {
  let next = createRootTask(data, {
    title: taskTpl.title,
    projectId,
    dueDate: null
  })
  const task = next.tasks[next.tasks.length - 1]
  if (!task) return next

  next = {
    ...next,
    tasks: next.tasks.map((t) =>
      t.id === task.id
        ? { ...t, description: taskTpl.description, priority: taskTpl.priority }
        : t
    )
  }

  if (taskTpl.checklistTexts.length > 0) {
    const items = taskTpl.checklistTexts.map((text: string, index: number) => ({
      id: uuidv4(),
      taskId: task.id,
      text,
      completed: false,
      sortOrder: index
    }))
    next = { ...next, checklistItems: [...next.checklistItems, ...items] }
  }

  return next
}

export function logActivity(
  data: DataPayload,
  action: string,
  entityType: string,
  entityId: string | null,
  summary: string
): DataPayload {
  const entry = {
    id: uuidv4(),
    timestamp: nowIso(),
    action,
    entityType,
    entityId,
    summary
  }
  return { ...data, activityLogs: [...data.activityLogs, entry].slice(-500) }
}