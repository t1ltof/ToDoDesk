import type { DataPayload } from '../../../shared/schema'
import type { CloudMembership, MemberRole } from '../../../shared/cloud'

export function membershipFor(
  data: DataPayload,
  projectId: string | null
): CloudMembership | null {
  if (!projectId) return null
  return data.settings.cloudMemberships.find((item) => item.projectId === projectId) ?? null
}

export function roleFor(data: DataPayload, projectId: string | null): MemberRole | null {
  return membershipFor(data, projectId)?.role ?? null
}

export function canEditProject(data: DataPayload, projectId: string | null): boolean {
  if (data.settings.profileMode !== 'cloud') return true
  const role = roleFor(data, projectId)
  if (!role) return true
  return role === 'owner' || role === 'admin' || role === 'editor'
}

export function canManageMembers(data: DataPayload, projectId: string | null): boolean {
  const role = roleFor(data, projectId)
  return role === 'owner' || role === 'admin'
}

export function canDeleteSharedProject(data: DataPayload, projectId: string | null): boolean {
  return roleFor(data, projectId) === 'owner'
}
