import type { DataPayload } from '../shared/schema'
import type { CloudLoginResult, CloudSessionInfo, CloudSyncResult, CloudUser } from '../shared/cloud'
import { migratePayload } from '../shared/schema'
import {
  clearCloudSession,
  readCloudSession,
  writeCloudSession,
  type CloudSession
} from './cloudAuth'

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

async function api(
  session: CloudSession,
  path: string,
  init: RequestInit = {},
  retry = true
): Promise<Response> {
  const response = await fetch(`${session.serverUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
      ...(init.headers ?? {})
    }
  })
  if (response.status !== 401 || !retry) return response
  const refreshed = await refreshSession(session)
  if (!refreshed) return response
  return api(refreshed, path, init, false)
}

async function refreshSession(session: CloudSession): Promise<CloudSession | null> {
  const response = await fetch(`${session.serverUrl}/auth/refresh`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken })
  })
  if (!response.ok) {
    clearCloudSession()
    return null
  }
  const body = (await response.json()) as {
    accessToken: string
    refreshToken: string
    user: CloudUser
  }
  const next: CloudSession = {
    ...session,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    userId: body.user.id,
    login: body.user.login,
    displayName: body.user.displayName
  }
  writeCloudSession(next)
  return next
}

export async function cloudLogin(
  serverUrl: string,
  login: string,
  password: string
): Promise<CloudLoginResult> {
  const base = normalizeUrl(serverUrl)
  try {
    const response = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password })
    })
    const body = (await response.json()) as {
      error?: string
      accessToken?: string
      refreshToken?: string
      user?: CloudUser
    }
    if (!response.ok || !body.accessToken || !body.refreshToken || !body.user) {
      return { ok: false, error: body.error ?? 'Не удалось войти' }
    }
    writeCloudSession({
      serverUrl: base,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      userId: body.user.id,
      login: body.user.login,
      displayName: body.user.displayName,
      revision: 0
    })
    return { ok: true, user: body.user }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Ошибка сети' }
  }
}

export function cloudLogout(): void {
  const session = readCloudSession()
  if (session) {
    void fetch(`${session.serverUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken })
    }).catch(() => undefined)
  }
  clearCloudSession()
}

export function getCloudSessionInfo(error: string | null = null): CloudSessionInfo {
  const session = readCloudSession()
  if (!session) {
    return {
      connected: false,
      serverUrl: null,
      login: null,
      displayName: null,
      revision: null,
      error
    }
  }
  return {
    connected: true,
    serverUrl: session.serverUrl,
    login: session.login,
    displayName: session.displayName,
    revision: session.revision,
    error
  }
}

export async function cloudPull(): Promise<CloudSyncResult> {
  const session = readCloudSession()
  if (!session) return { ok: false, error: 'Нет облачной сессии' }
  try {
    const response = await api(session, '/sync/personal')
    if (!response.ok) {
      return { ok: false, error: `Сервер: ${response.status}` }
    }
    const body = (await response.json()) as { revision: number; data: unknown }
    const next = { ...session, revision: body.revision }
    writeCloudSession(next)
    if (body.data == null) {
      return { ok: true, action: 'unchanged', revision: 0 }
    }
    return {
      ok: true,
      action: 'pulled',
      revision: body.revision,
      data: migratePayload(body.data)
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Ошибка сети' }
  }
}

export async function cloudPush(data: DataPayload): Promise<CloudSyncResult> {
  const session = readCloudSession()
  if (!session) return { ok: false, error: 'Нет облачной сессии' }
  try {
    const response = await api(session, '/sync/personal', {
      method: 'PUT',
      body: JSON.stringify({ revision: session.revision, data })
    })
    const body = (await response.json()) as {
      error?: string
      revision?: number
      data?: unknown
    }
    if (response.status === 409 && body.data) {
      return {
        ok: false,
        action: 'conflict',
        error: body.error ?? 'Конфликт ревизии',
        revision: body.revision,
        data: migratePayload(body.data)
      }
    }
    if (!response.ok) {
      return { ok: false, error: body.error ?? `Сервер: ${response.status}` }
    }
    writeCloudSession({ ...session, revision: body.revision ?? session.revision + 1 })
    return {
      ok: true,
      action: 'pushed',
      revision: body.revision,
      data
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Ошибка сети' }
  }
}

export function isCloudSession(): boolean {
  return readCloudSession() !== null
}
