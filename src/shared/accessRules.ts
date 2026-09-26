export type ShareRole = 'owner' | 'admin' | 'editor' | 'viewer' | null

export function canWriteRole(role: ShareRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor'
}

export function canManageRole(role: ShareRole): boolean {
  return role === 'owner' || role === 'admin'
}

export function revisionsConflict(clientRevision: number, serverRevision: number, exists: boolean): boolean {
  return exists && clientRevision !== serverRevision
}
