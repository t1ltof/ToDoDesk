import type { DataPayload } from './schema'

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
