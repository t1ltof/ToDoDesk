import type {
  BoardGroup,
  BoardHistoryEntry,
  BoardLink,
  BoardNode,
  BoardSnapshot,
  ChecklistItem,
  Comment,
  DataPayload,
  Draft,
  Project,
  Reminder,
  Sprint,
  Tag,
  Task,
  TaskAttachment,
  TaskTag
} from './schema'
import { createEmptyData } from './schema'

export interface ProjectSlice {
  tasks: Task[]
  taskTags: TaskTag[]
  checklistItems: ChecklistItem[]
  reminders: Reminder[]
  tags: Tag[]
  drafts: Draft[]
  comments: Comment[]
  taskAttachments: TaskAttachment[]
  boardNodes: BoardNode[]
  boardLinks: BoardLink[]
  boardGroups: BoardGroup[]
  boardSnapshots: BoardSnapshot[]
  boardHistory: BoardHistoryEntry[]
  sprints: Sprint[]
}

export function collectProjectTaskIds(data: DataPayload, projectId: string): Set<string> {
  const ids = new Set(
    data.tasks.filter((task) => task.projectId === projectId).map((task) => task.id)
  )
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

export function extractProjectSlice(data: DataPayload, projectId: string): ProjectSlice {
  const taskIds = collectProjectTaskIds(data, projectId)
  const tasks = data.tasks.filter((task) => taskIds.has(task.id))
  const taskTags = data.taskTags.filter((link) => taskIds.has(link.taskId))
  const tagIds = new Set(taskTags.map((link) => link.tagId))
  const boardNodes = data.boardNodes.filter((node) => (node.projectId ?? null) === projectId)
  const boardNodeIds = new Set(boardNodes.map((node) => node.id))

  return {
    tasks,
    taskTags,
    checklistItems: data.checklistItems.filter((item) => taskIds.has(item.taskId)),
    reminders: data.reminders.filter((item) => taskIds.has(item.taskId)),
    tags: data.tags.filter((tag) => tag.projectId === projectId || tagIds.has(tag.id)),
    drafts: data.drafts.filter((draft) => taskIds.has(draft.entityId)),
    comments: data.comments.filter((comment) => taskIds.has(comment.taskId)),
    taskAttachments: data.taskAttachments.filter((item) => taskIds.has(item.taskId)),
    boardNodes,
    boardLinks: data.boardLinks.filter(
      (link) =>
        (link.projectId ?? null) === projectId ||
        boardNodeIds.has(link.fromNodeId) ||
        boardNodeIds.has(link.toNodeId)
    ),
    boardGroups: data.boardGroups.filter((group) => (group.projectId ?? null) === projectId),
    boardSnapshots: data.boardSnapshots.filter(
      (snapshot) => (snapshot.projectId ?? null) === projectId
    ),
    boardHistory: data.boardHistory.filter((entry) => (entry.projectId ?? null) === projectId),
    sprints: data.sprints.filter((sprint) => (sprint.projectId ?? null) === projectId)
  }
}

export function mergeProjectSlice(
  data: DataPayload,
  project: Project,
  slice: ProjectSlice
): DataPayload {
  const taskIds = collectProjectTaskIds(data, project.id)
  const incomingTaskIds = new Set(slice.tasks.map((task) => task.id))
  const removeTaskIds = new Set([...taskIds, ...incomingTaskIds])

  const projects = [
    ...data.projects.filter((item) => item.id !== project.id),
    project
  ].sort((a, b) => a.sortOrder - b.sortOrder)

  return {
    ...data,
    projects,
    tasks: [...data.tasks.filter((task) => !removeTaskIds.has(task.id)), ...slice.tasks],
    taskTags: [
      ...data.taskTags.filter((link) => !removeTaskIds.has(link.taskId)),
      ...slice.taskTags
    ],
    checklistItems: [
      ...data.checklistItems.filter((item) => !removeTaskIds.has(item.taskId)),
      ...slice.checklistItems
    ],
    reminders: [
      ...data.reminders.filter((item) => !removeTaskIds.has(item.taskId)),
      ...slice.reminders
    ],
    tags: mergeTags(data.tags, slice.tags),
    drafts: [
      ...data.drafts.filter((draft) => !removeTaskIds.has(draft.entityId)),
      ...slice.drafts
    ],
    comments: [
      ...data.comments.filter((comment) => !removeTaskIds.has(comment.taskId)),
      ...slice.comments
    ],
    taskAttachments: [
      ...data.taskAttachments.filter((item) => !removeTaskIds.has(item.taskId)),
      ...slice.taskAttachments
    ],
    boardNodes: [
      ...data.boardNodes.filter((node) => (node.projectId ?? null) !== project.id),
      ...slice.boardNodes
    ],
    boardLinks: [
      ...data.boardLinks.filter((link) => (link.projectId ?? null) !== project.id),
      ...slice.boardLinks
    ],
    boardGroups: [
      ...data.boardGroups.filter((group) => (group.projectId ?? null) !== project.id),
      ...slice.boardGroups
    ],
    boardSnapshots: [
      ...data.boardSnapshots.filter((snapshot) => (snapshot.projectId ?? null) !== project.id),
      ...slice.boardSnapshots
    ],
    boardHistory: [
      ...data.boardHistory.filter((entry) => (entry.projectId ?? null) !== project.id),
      ...slice.boardHistory
    ],
    sprints: [
      ...data.sprints.filter((sprint) => (sprint.projectId ?? null) !== project.id),
      ...slice.sprints
    ]
  }
}

function mergeTags(current: Tag[], incoming: Tag[]): Tag[] {
  const byId = new Map(current.map((tag) => [tag.id, tag]))
  for (const tag of incoming) {
    byId.set(tag.id, tag)
  }
  return [...byId.values()]
}

export function emptySlice(): ProjectSlice {
  const empty = createEmptyData()
  return {
    tasks: empty.tasks,
    taskTags: empty.taskTags,
    checklistItems: empty.checklistItems,
    reminders: empty.reminders,
    tags: empty.tags,
    drafts: empty.drafts,
    comments: empty.comments,
    taskAttachments: empty.taskAttachments,
    boardNodes: empty.boardNodes,
    boardLinks: empty.boardLinks,
    boardGroups: empty.boardGroups,
    boardSnapshots: empty.boardSnapshots,
    boardHistory: empty.boardHistory,
    sprints: empty.sprints
  }
}
