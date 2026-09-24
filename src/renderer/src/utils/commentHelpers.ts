import { v4 as uuidv4 } from 'uuid'
import type { Comment, DataPayload } from '../../../shared/schema'

export function addComment(
  data: DataPayload,
  taskId: string,
  body: string,
  authorUserId: string | null
): DataPayload {
  const text = body.trim()
  if (!text) return data
  const comment: Comment = {
    id: uuidv4(),
    taskId,
    authorUserId,
    body: text,
    createdAt: new Date().toISOString()
  }
  return { ...data, comments: [...data.comments, comment] }
}
