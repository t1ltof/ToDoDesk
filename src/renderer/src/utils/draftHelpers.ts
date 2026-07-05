import type { DataPayload } from '../../../shared/schema'

export function getTaskDraft(data: DataPayload, taskId: string) {
  return data.drafts.find((d) => d.entityType === 'task' && d.entityId === taskId) ?? null
}

export function upsertTaskDraft(
  data: DataPayload,
  taskId: string,
  title: string,
  description: string
): DataPayload {
  const draft = {
    entityType: 'task' as const,
    entityId: taskId,
    title,
    description,
    updatedAt: new Date().toISOString()
  }
  const drafts = data.drafts.filter((d) => !(d.entityType === 'task' && d.entityId === taskId))
  return { ...data, drafts: [...drafts, draft] }
}

export function removeTaskDraft(data: DataPayload, taskId: string): DataPayload {
  return {
    ...data,
    drafts: data.drafts.filter((d) => !(d.entityType === 'task' && d.entityId === taskId))
  }
}