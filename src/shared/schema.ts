import { z } from 'zod'

export const FORMAT_VERSION = '1.0'

export const prioritySchema = z.enum(['normal', 'important'])
export const statusSchema = z.enum(['todo', 'done'])

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
  description: z.string(),
  status: statusSchema,
  priority: prioritySchema,
  dueDate: z.string().nullable(),
  completedAt: z.string().nullable(),
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

export const dataPayloadSchema = z.object({
  projects: z.array(projectSchema),
  tags: z.array(tagSchema),
  tasks: z.array(taskSchema),
  taskTags: z.array(taskTagSchema),
  checklistItems: z.array(checklistItemSchema),
  reminders: z.array(reminderSchema)
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
export type Project = z.infer<typeof projectSchema>
export type Tag = z.infer<typeof tagSchema>
export type Task = z.infer<typeof taskSchema>
export type ChecklistItem = z.infer<typeof checklistItemSchema>
export type TaskTag = z.infer<typeof taskTagSchema>
export type Reminder = z.infer<typeof reminderSchema>
export type DataPayload = z.infer<typeof dataPayloadSchema>
export type DataFile = z.infer<typeof dataFileSchema>

export type ViewId = 'today' | 'inbox' | 'all' | 'completed' | `project:${string}`

export function createEmptyData(): DataPayload {
  return {
    projects: [],
    tags: [],
    tasks: [],
    taskTags: [],
    checklistItems: [],
    reminders: []
  }
}