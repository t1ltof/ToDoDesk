import { z } from 'zod'

export const FORMAT_VERSION = '1.1'

export const prioritySchema = z.enum(['normal', 'important'])
export const statusSchema = z.enum(['todo', 'done'])
export const recurrenceSchema = z.enum(['none', 'daily', 'weekly', 'monthly'])

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  color: z.string(),
  sortOrder: z.number().int(),
  archived: z.boolean()
})

export const tagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1)
})

export const taskSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  parentId: z.string().uuid().nullable(),
  title: z.string().min(1),
  description: z.string().default(''),
  status: statusSchema,
  priority: prioritySchema,
  dueDate: z.string().nullable(),
  completedAt: z.string().nullable(),
  recurrence: recurrenceSchema.default('none'),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const checklistItemSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  text: z.string().min(1),
  completed: z.boolean(),
  sortOrder: z.number().int()
})

export const taskTagSchema = z.object({
  taskId: z.string().uuid(),
  tagId: z.string().uuid()
})

export const reminderSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  remindAt: z.string()
})

export const templateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  priority: prioritySchema.default('normal'),
  projectId: z.string().uuid().nullable().default(null),
  tagIds: z.array(z.string().uuid()).default([]),
  checklistTexts: z.array(z.string()).default([])
})

export const settingsSchema = z.object({
  autostart: z.boolean().default(false),
  startMinimized: z.boolean().default(false),
  notificationHour: z.number().int().min(0).max(23).default(9),
  notificationMinute: z.number().int().min(0).max(59).default(0),
  remindDayBefore: z.boolean().default(true),
  remindHourBefore: z.boolean().default(false),
  checkUpdates: z.boolean().default(true),
  lastUpdateCheck: z.string().nullable().default(null),
  dismissedUpdateVersion: z.string().nullable().default(null)
})

export const dataPayloadSchema = z.object({
  projects: z.array(projectSchema),
  tags: z.array(tagSchema),
  tasks: z.array(taskSchema),
  taskTags: z.array(taskTagSchema),
  checklistItems: z.array(checklistItemSchema),
  reminders: z.array(reminderSchema),
  templates: z.array(templateSchema).default([]),
  settings: settingsSchema
})

export const dataFileSchema = z.object({
  format: z.literal('tododesk-backup'),
  version: z.string(),
  exportedAt: z.string(),
  appVersion: z.string(),
  data: dataPayloadSchema
})

export type Priority = z.infer<typeof prioritySchema>
export type Status = z.infer<typeof statusSchema>
export type Recurrence = z.infer<typeof recurrenceSchema>
export type Project = z.infer<typeof projectSchema>
export type Tag = z.infer<typeof tagSchema>
export type Task = z.infer<typeof taskSchema>
export type ChecklistItem = z.infer<typeof checklistItemSchema>
export type TaskTag = z.infer<typeof taskTagSchema>
export type Reminder = z.infer<typeof reminderSchema>
export type Template = z.infer<typeof templateSchema>
export type Settings = z.infer<typeof settingsSchema>
export type DataPayload = z.infer<typeof dataPayloadSchema>
export type DataFile = z.infer<typeof dataFileSchema>

export type ViewId =
  | 'today'
  | 'inbox'
  | 'all'
  | 'completed'
  | 'calendar'
  | 'stats'
  | `tag:${string}`
  | `project:${string}`
  | `kanban:${string}`

export type ProjectViewMode = 'list' | 'kanban'

export const defaultSettings: Settings = settingsSchema.parse({})

export function createEmptyData(): DataPayload {
  return {
    projects: [],
    tags: [],
    tasks: [],
    taskTags: [],
    checklistItems: [],
    reminders: [],
    templates: [],
    settings: { ...defaultSettings }
  }
}

export function migratePayload(raw: unknown): DataPayload {
  const base = createEmptyData()
  if (!raw || typeof raw !== 'object') return base

  const data = raw as Record<string, unknown>
  const tasks = Array.isArray(data.tasks)
    ? data.tasks.map((task) => {
        const t = task as Partial<Task>
        return { ...t, recurrence: t.recurrence ?? 'none', description: t.description ?? '' }
      })
    : []

  return dataPayloadSchema.parse({
    ...base,
    ...data,
    tasks,
    templates: data.templates ?? [],
    settings: { ...defaultSettings, ...(data.settings as object) }
  })
}