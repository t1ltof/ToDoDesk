import type { DataPayload, Project } from '../shared/schema'
import type {
  CloudInviteResult,
  CloudLoginResult,
  CloudMembership,
  CloudProjectBundle,
  CloudSessionInfo,
  CloudSyncResult,
  CloudUser,
  MemberRole
} from '../shared/cloud'
import { extractProjectSlice, mergeProjectSlice, type ProjectSlice } from '../shared/projectSlice'
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

export async function overlaySharedProjects(data: DataPayload): Promise<DataPayload> {
  const session = readCloudSession()
  if (!session) return data
  const list = await api(session, '/projects')
  if (!list.ok) return data
  const body = (await list.json()) as {
    projects: Array<{
      projectId: string
      role: MemberRole
      revision: number
      project: Project
      members: CloudMembership['members']
    }>
  }
  const memberships: CloudMembership[] = []
  const revisions = { ...(session.projectRevisions ?? {}) }
  let next = data
  for (const item of body.projects ?? []) {
    memberships.push({
      projectId: item.projectId,
      role: item.role,
      members: item.members
    })
    const detail = await api(session, `/projects/${item.projectId}`)
    if (!detail.ok) continue
    const bundle = (await detail.json()) as CloudProjectBundle
    next = mergeProjectSlice(next, bundle.project, bundle.slice)
    revisions[item.projectId] = bundle.revision
  }
  writeCloudSession({ ...session, projectRevisions: revisions })
  return {
    ...next,
    settings: {
      ...next.settings,
      profileMode: 'cloud',
      cloudUserId: session.userId,
      cloudServerUrl: session.serverUrl,
      cloudMemberships: memberships
    }
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
    writeCloudSession({ ...readCloudSession()!, revision: body.revision })
    if (body.data == null) {
      return { ok: true, action: 'unchanged', revision: 0 }
    }
    const merged = await overlaySharedProjects(migratePayload(body.data))
    return {
      ok: true,
      action: 'pulled',
      revision: body.revision,
      data: merged
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Ошибка сети' }
  }
}

async function pushSharedProjects(data: DataPayload): Promise<void> {
  const session = readCloudSession()
  if (!session) return
  const revisions = { ...(session.projectRevisions ?? {}) }
  for (const membership of data.settings.cloudMemberships) {
    if (membership.role === 'viewer') continue
    const project = data.projects.find((item) => item.id === membership.projectId)
    if (!project) continue
    const slice = extractProjectSlice(data, project.id)
    const revision = revisions[project.id] ?? 0
    let response = await api(session, `/projects/${project.id}`, {
      method: 'PUT',
      body: JSON.stringify({ revision, project, slice })
    })
    if (response.status === 404) {
      response = await api(session, '/projects', {
        method: 'POST',
        body: JSON.stringify({ project, slice })
      })
    }
    if (response.ok) {
      const body = (await response.json()) as { revision?: number }
      if (typeof body.revision === 'number') revisions[project.id] = body.revision
      else revisions[project.id] = revision + 1
    }
  }
  const latest = readCloudSession()
  if (latest) writeCloudSession({ ...latest, projectRevisions: revisions })
}

export async function cloudPush(data: DataPayload): Promise<CloudSyncResult> {
  const session = readCloudSession()
  if (!session) return { ok: false, error: 'Нет облачной сессии' }
  try {
    await pushSharedProjects(data)
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

export async function shareAndInvite(
  data: DataPayload,
  projectId: string,
  role: MemberRole
): Promise<CloudInviteResult> {
  const project = data.projects.find((item) => item.id === projectId)
  if (!project) return { ok: false, error: 'Проект не найден' }
  const published = await publishProject(project, extractProjectSlice(data, projectId))
  if (!published.ok) return { ok: false, error: published.error }
  return createProjectInvite(projectId, role)
}

export async function publishProject(
  project: Project,
  slice: ProjectSlice
): Promise<{ ok: boolean; error?: string; revision?: number }> {
  const session = readCloudSession()
  if (!session) return { ok: false, error: 'Нет облачной сессии' }
  const response = await api(session, '/projects', {
    method: 'POST',
    body: JSON.stringify({ project, slice })
  })
  const body = (await response.json()) as { error?: string; revision?: number }
  if (!response.ok) return { ok: false, error: body.error ?? 'Не удалось опубликовать' }
  const latest = readCloudSession()
  if (latest) {
    writeCloudSession({
      ...latest,
      projectRevisions: { ...(latest.projectRevisions ?? {}), [project.id]: body.revision ?? 1 }
    })
  }
  return { ok: true, revision: body.revision }
}

export async function createProjectInvite(
  projectId: string,
  role: MemberRole
): Promise<CloudInviteResult> {
  const session = readCloudSession()
  if (!session) return { ok: false, error: 'Нет облачной сессии' }
  const response = await api(session, `/projects/${projectId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ role, days: 7 })
  })
  const body = (await response.json()) as CloudInviteResult & { error?: string }
  if (!response.ok) return { ok: false, error: body.error ?? 'Не удалось создать ссылку' }
  return { ok: true, token: body.token, url: body.url, appUrl: body.appUrl }
}

export async function acceptProjectInvite(token: string): Promise<CloudSyncResult> {
  const session = readCloudSession()
  if (!session) return { ok: false, error: 'Нет облачной сессии' }
  const response = await api(session, '/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token })
  })
  const body = (await response.json()) as CloudProjectBundle & { error?: string }
  if (!response.ok) return { ok: false, error: body.error ?? 'Не удалось принять приглашение' }
  return {
    ok: true,
    action: 'pulled',
    revision: body.revision,
    data: undefined
  }
}

export async function acceptInviteAndMerge(
  token: string,
  current: DataPayload
): Promise<CloudSyncResult> {
  const session = readCloudSession()
  if (!session) return { ok: false, error: 'Нет облачной сессии' }
  const response = await api(session, '/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token })
  })
  const body = (await response.json()) as CloudProjectBundle & { error?: string }
  if (!response.ok) return { ok: false, error: body.error ?? 'Не удалось принять приглашение' }
  const merged = mergeProjectSlice(current, body.project, body.slice)
  const memberships = [
    ...merged.settings.cloudMemberships.filter((item) => item.projectId !== body.project.id),
    { projectId: body.project.id, role: body.role, members: body.members }
  ]
  const latest = readCloudSession()
  if (latest) {
    writeCloudSession({
      ...latest,
      projectRevisions: { ...(latest.projectRevisions ?? {}), [body.project.id]: body.revision }
    })
  }
  return {
    ok: true,
    action: 'pulled',
    revision: body.revision,
    data: {
      ...merged,
      settings: { ...merged.settings, cloudMemberships: memberships }
    }
  }
}

export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = readCloudSession()
  if (!session) return { ok: false, error: 'Нет облачной сессии' }
  const response = await api(session, `/projects/${projectId}/members/${userId}`, {
    method: 'DELETE'
  })
  if (!response.ok && response.status !== 204) {
    return { ok: false, error: 'Не удалось исключить' }
  }
  return { ok: true }
}

let watchTimer: ReturnType<typeof setInterval> | null = null

export function startCloudWatch(onData: (data: DataPayload) => void): void {
  stopCloudWatch()
  watchTimer = setInterval(() => {
    void (async () => {
      const session = readCloudSession()
      if (!session) return
      const list = await api(session, '/projects')
      if (!list.ok) return
      const body = (await list.json()) as {
        projects: Array<{ projectId: string; revision: number }>
      }
      const revisions = session.projectRevisions ?? {}
      const changed = (body.projects ?? []).some(
        (item) => (revisions[item.projectId] ?? -1) < item.revision
      )
      if (!changed) return
      const pulled = await cloudPull()
      if (pulled.ok && pulled.data) onData(pulled.data)
    })()
  }, 15_000)
}

export function stopCloudWatch(): void {
  if (watchTimer) {
    clearInterval(watchTimer)
    watchTimer = null
  }
}

