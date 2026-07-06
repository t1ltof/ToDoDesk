import { z } from 'zod'

export const FORMAT_VERSION = '1.4'

export const prioritySchema = z.enum(['normal', 'important'])
export const statusSchema = z.enum(['todo', 'done'])
export const recurrenceSchema = z.enum([
  'none',
  'daily',
  'weekly',
  'monthly',
  'weekdays',
  'weekends'
])
export const themeSchema = z.enum(['dark', 'amoled', 'light'])
export const fontSizeSchema = z.enum(['compact', 'normal', 'large'])
export const boardNodeStyleSchema = z.enum(['card', 'sticker', 'photo', 'document'])
export const timeOfDaySchema = z.enum(['morning', 'day', 'evening'])

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  color: z.string(),
  icon: z.string().default(''),
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
  dueDateEnd: z.string().nullable().default(null),
  dueTime: z.string().nullable().default(null),
  timeOfDay: timeOfDaySchema.nullable().default(null),
  completedAt: z.string().nullable(),
  recurrence: recurrenceSchema.default('none'),
  recurrenceExceptions: z.array(z.string()).default([]),
  dependsOnTaskId: z.string().uuid().nullable().default(null),
  pinned: z.boolean().default(false),
  archived: z.boolean().default(false),
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

export const projectTemplateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  priority: prioritySchema.default('normal'),
  checklistTexts: z.array(z.string()).default([])
})

export const projectTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().default(''),
  projectColor: z.string().default('#3b82f6'),
  projectIcon: z.string().default(''),
  tasks: z.array(projectTemplateTaskSchema).default([])
})

export const noteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  content: z.string().default(''),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const activityLogSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable().default(null),
  summary: z.string()
})

export const boardNodeKindSchema = z.enum(['task', 'idea'])

export const boardNodeSchema = z.object({
  id: z.string().uuid(),
  kind: boardNodeKindSchema,
  taskId: z.string().uuid().nullable().default(null),
  title: z.string().min(1),
  notes: z.string().default(''),
  x: z.number(),
  y: z.number(),
  width: z.number().positive().default(220),
  height: z.number().positive().default(130),
  color: z.string().default('#d97706'),
  style: boardNodeStyleSchema.default('card'),
  groupId: z.string().uuid().nullable().default(null),
  imagePath: z.string().nullable().default(null)
})

export const boardLinkSchema = z.object({
  id: z.string().uuid(),
  fromNodeId: z.string().uuid(),
  toNodeId: z.string().uuid(),
  label: z.string().default('')
})

export const boardGroupSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  color: z.string().default('#78350f')
})

export const weeklyGoalSchema = z.object({
  id: z.string().uuid(),
  weekKey: z.string(),
  text: z.string().min(1),
  completed: z.boolean().default(false)
})

export const taskAttachmentSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  addedAt: z.string()
})

export const sprintSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  goal: z.string().default(''),
  taskIds: z.array(z.string().uuid()).default([]),
  completed: z.boolean().default(false)
})

export const boardSnapshotSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  createdAt: z.string(),
  nodes: z.array(boardNodeSchema),
  links: z.array(boardLinkSchema)
})

export const smartRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  condition: z.literal('overdue_days'),
  days: z.number().int().min(1),
  action: z.enum(['move_inbox', 'add_tag']),
  tagId: z.string().uuid().optional()
})

export const draftSchema = z.object({
  entityType: z.literal('task'),
  entityId: z.string().uuid(),
  title: z.string(),
  description: z.string().default(''),
  updatedAt: z.string()
})

export const boardHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string(),
  nodes: z.array(boardNodeSchema),
  links: z.array(boardLinkSchema)
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
  dismissedUpdateVersion: z.string().nullable().default(null),
  boardBackgroundColor: z.string().default('#3d2b1f'),
  theme: themeSchema.default('dark'),
  fontSize: fontSizeSchema.default('normal'),
  quietHoursEnabled: z.boolean().default(true),
  quietHoursStart: z.string().nullable().default('23:00'),
  quietHoursEnd: z.string().nullable().default('08:00'),
  autoBackupEnabled: z.boolean().default(true),
  autoBackupMaxVersions: z.number().int().min(1).max(50).default(10),
  syncFolderPath: z.string().nullable().default(null),
  dataPasswordEnabled: z.boolean().default(false),
  pomodoroWorkMinutes: z.number().int().min(1).max(120).default(25),
  pomodoroBreakMinutes: z.number().int().min(1).max(60).default(5),
  accentColor: z.string().default('#3b82f6'),
  sidebarCompact: z.boolean().default(false),
  boardAnimations: z.boolean().default(true),
  notificationSound: z.boolean().default(false),
  dailyDigestEnabled: z.boolean().default(false),
  dailyDigestHour: z.number().int().min(0).max(23).default(8),
  recentTaskIds: z.array(z.string().uuid()).default([]),
  todayOnlyMaxTasks: z.number().int().min(0).max(50).default(0)
})

export const dataPayloadSchema = z.object({
  projects: z.array(projectSchema),
  tags: z.array(tagSchema),
  tasks: z.array(taskSchema),
  taskTags: z.array(taskTagSchema),
  checklistItems: z.array(checklistItemSchema),
  reminders: z.array(reminderSchema),
  templates: z.array(templateSchema).default([]),
  projectTemplates: z.array(projectTemplateSchema).default([]),
  notes: z.array(noteSchema).default([]),
  activityLogs: z.array(activityLogSchema).default([]),
  weeklyGoals: z.array(weeklyGoalSchema).default([]),
  boardNodes: z.array(boardNodeSchema).default([]),
  boardLinks: z.array(boardLinkSchema).default([]),
  boardGroups: z.array(boardGroupSchema).default([]),
  taskAttachments: z.array(taskAttachmentSchema).default([]),
  sprints: z.array(sprintSchema).default([]),
  boardSnapshots: z.array(boardSnapshotSchema).default([]),
  smartRules: z.array(smartRuleSchema).default([]),
  drafts: z.array(draftSchema).default([]),
  boardHistory: z.array(boardHistoryEntrySchema).default([]),
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
export type Theme = z.infer<typeof themeSchema>
export type FontSize = z.infer<typeof fontSizeSchema>
export type BoardNodeStyle = z.infer<typeof boardNodeStyleSchema>
export type TimeOfDay = z.infer<typeof timeOfDaySchema>
export type Project = z.infer<typeof projectSchema>
export type Tag = z.infer<typeof tagSchema>
export type Task = z.infer<typeof taskSchema>
export type ChecklistItem = z.infer<typeof checklistItemSchema>
export type TaskTag = z.infer<typeof taskTagSchema>
export type Reminder = z.infer<typeof reminderSchema>
export type Template = z.infer<typeof templateSchema>
export type ProjectTemplate = z.infer<typeof projectTemplateSchema>
export type Note = z.infer<typeof noteSchema>
export type ActivityLog = z.infer<typeof activityLogSchema>
export type BoardNodeKind = z.infer<typeof boardNodeKindSchema>
export type BoardNode = z.infer<typeof boardNodeSchema>
export type BoardLink = z.infer<typeof boardLinkSchema>
export type BoardGroup = z.infer<typeof boardGroupSchema>
export type WeeklyGoal = z.infer<typeof weeklyGoalSchema>
export type TaskAttachment = z.infer<typeof taskAttachmentSchema>
export type Sprint = z.infer<typeof sprintSchema>
export type BoardSnapshot = z.infer<typeof boardSnapshotSchema>
export type SmartRule = z.infer<typeof smartRuleSchema>
export type Draft = z.infer<typeof draftSchema>
export type BoardHistoryEntry = z.infer<typeof boardHistoryEntrySchema>
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
  | 'board'
  | 'notes'
  | 'focus'
  | 'timeline'
  | 'sprint'
  | 'next'
  | 'weekly-review'
  | `tag:${string}`
  | `project:${string}`
  | `kanban:${string}`

export type ProjectViewMode = 'list' | 'kanban'

export type QuickFilter = 'none' | 'overdue' | 'no-due' | 'no-project' | 'important' | 'archived'

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
    projectTemplates: [],
    notes: [],
    activityLogs: [],
    weeklyGoals: [],
    boardNodes: [],
    boardLinks: [],
    boardGroups: [],
    taskAttachments: [],
    sprints: [],
    boardSnapshots: [],
    smartRules: [],
    drafts: [],
    boardHistory: [],
    settings: { ...defaultSettings }
  }
}

function migrateTask(task: Partial<Task>): Task {
  return {
    ...task,
    description: task.description ?? '',
    recurrence: task.recurrence ?? 'none',
    dueDateEnd: task.dueDateEnd ?? null,
    dueTime: task.dueTime ?? null,
    timeOfDay: task.timeOfDay ?? null,
    recurrenceExceptions: task.recurrenceExceptions ?? [],
    dependsOnTaskId: task.dependsOnTaskId ?? null,
    pinned: task.pinned ?? false,
    archived: task.archived ?? false
  } as Task
}

function migrateProject(project: Partial<Project>): Project {
  return { ...project, icon: project.icon ?? '' } as Project
}

function migrateBoardNode(node: Partial<BoardNode>): BoardNode {
  return {
    ...node,
    style: node.style ?? 'card',
    groupId: node.groupId ?? null,
    notes: node.notes ?? '',
    taskId: node.taskId ?? null,
    imagePath: node.imagePath ?? null
  } as BoardNode
}

export function migratePayload(raw: unknown): DataPayload {
  const base = createEmptyData()
  if (!raw || typeof raw !== 'object') return base

  const data = raw as Record<string, unknown>
  const tasks = Array.isArray(data.tasks) ? data.tasks.map((t) => migrateTask(t as Partial<Task>)) : []
  const projects = Array.isArray(data.projects)
    ? data.projects.map((p) => migrateProject(p as Partial<Project>))
    : []
  const boardNodes = Array.isArray(data.boardNodes)
    ? data.boardNodes.map((n) => migrateBoardNode(n as Partial<BoardNode>))
    : []

  return dataPayloadSchema.parse({
    ...base,
    ...data,
    projects,
    tasks,
    templates: data.templates ?? [],
    projectTemplates: data.projectTemplates ?? [],
    notes: data.notes ?? [],
    activityLogs: data.activityLogs ?? [],
    weeklyGoals: data.weeklyGoals ?? [],
    boardNodes,
    boardLinks: data.boardLinks ?? [],
    boardGroups: data.boardGroups ?? [],
    taskAttachments: data.taskAttachments ?? [],
    sprints: data.sprints ?? [],
    boardSnapshots: data.boardSnapshots ?? [],
    smartRules: data.smartRules ?? [],
    drafts: data.drafts ?? [],
    boardHistory: Array.isArray(data.boardHistory)
      ? (data.boardHistory as unknown[]).slice(0, 20)
      : [],
    settings: { ...defaultSettings, ...(data.settings as object) }
  })
}