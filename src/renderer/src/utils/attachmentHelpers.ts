import { v4 as uuidv4 } from 'uuid'
import type { DataPayload, TaskAttachment } from '../../../shared/schema'

export function addTaskAttachment(
  data: DataPayload,
  taskId: string,
  fileName: string,
  filePath: string
): DataPayload {
  const attachment: TaskAttachment = {
    id: uuidv4(),
    taskId,
    fileName,
    filePath,
    addedAt: new Date().toISOString()
  }

  return {
    ...data,
    taskAttachments: [...data.taskAttachments, attachment]
  }
}

export function removeTaskAttachment(data: DataPayload, attachmentId: string): DataPayload {
  const attachment = data.taskAttachments.find((item) => item.id === attachmentId)
  if (attachment) {
    void window.tododesk.deleteAttachmentFile(attachment.filePath)
  }

  return {
    ...data,
    taskAttachments: data.taskAttachments.filter((item) => item.id !== attachmentId)
  }
}

export function getTaskAttachments(data: DataPayload, taskId: string): TaskAttachment[] {
  return data.taskAttachments
    .filter((item) => item.taskId === taskId)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
}