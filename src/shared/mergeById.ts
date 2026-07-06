export function mergeById<T extends { id: string }>(current: T[], imported: T[]): T[] {
  const existingIds = new Set(current.map((item) => item.id))
  return [...current, ...imported.filter((item) => !existingIds.has(item.id))]
}