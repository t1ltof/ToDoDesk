import type { DataPayload } from '../../../shared/schema'

export function renameTag(data: DataPayload, tagId: string, name: string): DataPayload {
  const trimmed = name.trim()
  if (!trimmed) return data

  return {
    ...data,
    tags: data.tags.map((tag) => (tag.id === tagId ? { ...tag, name: trimmed } : tag))
  }
}

export function deleteTag(data: DataPayload, tagId: string): DataPayload {
  return {
    ...data,
    tags: data.tags.filter((tag) => tag.id !== tagId),
    taskTags: data.taskTags.filter((link) => link.tagId !== tagId)
  }
}