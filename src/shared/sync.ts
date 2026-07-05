import type { DataPayload } from './schema'

export interface SyncConflictSummary {
  taskCount: number
  projectCount: number
  boardNodeCount: number
  noteCount: number
  lastUpdated: string | null
}

export function buildSyncConflictSummary(data: DataPayload): SyncConflictSummary {
  let lastUpdated: string | null = null
  for (const task of data.tasks) {
    if (!lastUpdated || task.updatedAt > lastUpdated) {
      lastUpdated = task.updatedAt
    }
  }

  return {
    taskCount: data.tasks.length,
    projectCount: data.projects.length,
    boardNodeCount: data.boardNodes.length,
    noteCount: data.notes.length,
    lastUpdated
  }
}

export type SyncConflictChoice = 'local' | 'external' | 'cancel'

export interface SyncConflictPayload {
  local: SyncConflictSummary
  external: SyncConflictSummary
}