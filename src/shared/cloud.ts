import type { DataPayload, Project } from './schema'
import type { ProjectSlice } from './projectSlice'

export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface CloudMember {
  userId: string
  login: string
  displayName: string
  role: MemberRole
}

export interface CloudMembership {
  projectId: string
  role: MemberRole
  members: CloudMember[]
}

export interface CloudUser {
  id: string
  login: string
  displayName: string
}

export interface CloudSessionInfo {
  connected: boolean
  serverUrl: string | null
  login: string | null
  displayName: string | null
  revision: number | null
  error: string | null
}

export interface CloudLoginResult {
  ok: boolean
  error?: string
  user?: CloudUser
}

export interface CloudSyncResult {
  ok: boolean
  action?: 'pushed' | 'pulled' | 'unchanged' | 'conflict'
  error?: string
  data?: DataPayload
  revision?: number
}

export const DEFAULT_CLOUD_SERVER_URL = 'https://tododesk.91.186.212.152.sslip.io'

export interface CloudInviteResult {
  ok: boolean
  error?: string
  token?: string
  url?: string
  appUrl?: string
}

export interface CloudProjectBundle {
  project: Project
  slice: ProjectSlice
  revision: number
  role: MemberRole
  members: CloudMember[]
}
