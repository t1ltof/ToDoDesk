import { createHash, randomBytes } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { config } from './config.js'
import { query } from './db.js'
import { broadcastProject } from './hub.js'
import { newId, verifyAccessToken } from './tokens.js'

type Role = 'owner' | 'admin' | 'editor' | 'viewer'
type WriteRole = 'owner' | 'admin' | 'editor'

interface UserRow {
  id: string
  login: string
  display_name: string
}

interface MemberRow {
  user_id: string
  login: string
  display_name: string
  role: Role
}

function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7).trim() || null
}

async function requireUser(request: FastifyRequest): Promise<UserRow> {
  const token = bearer(request)
  if (!token) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
  const payload = await verifyAccessToken(token)
  const result = await query<UserRow>(
    'SELECT id, login, display_name FROM users WHERE id = $1',
    [payload.sub]
  )
  const user = result.rows[0]
  if (!user) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
  return user
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function canWrite(role: Role): role is WriteRole {
  return role === 'owner' || role === 'admin' || role === 'editor'
}

function canManage(role: Role): boolean {
  return role === 'owner' || role === 'admin'
}

async function membership(projectId: string, userId: string): Promise<Role | null> {
  const result = await query<{ role: Role }>(
    'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  )
  return result.rows[0]?.role ?? null
}

async function loadMembers(projectId: string): Promise<MemberRow[]> {
  const result = await query<MemberRow>(
    `SELECT m.user_id, u.login, u.display_name, m.role
     FROM project_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.project_id = $1
     ORDER BY m.role, u.login`,
    [projectId]
  )
  return result.rows
}

function publicMembers(rows: MemberRow[]): Array<{
  userId: string
  login: string
  displayName: string
  role: Role
}> {
  return rows.map((row) => ({
    userId: row.user_id,
    login: row.login,
    displayName: row.display_name,
    role: row.role
  }))
}

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  app.get('/projects', async (request, reply) => {
    try {
      const user = await requireUser(request)
      const result = await query<{
        project_id: string
        role: Role
        revision: string
        project: unknown
      }>(
        `SELECT m.project_id, m.role, s.revision::text, s.project
         FROM project_members m
         JOIN project_spaces s ON s.project_id = m.project_id
         WHERE m.user_id = $1`,
        [user.id]
      )
      const projects = []
      for (const row of result.rows) {
        const members = publicMembers(await loadMembers(row.project_id))
        projects.push({
          projectId: row.project_id,
          role: row.role,
          revision: Number(row.revision),
          project: row.project,
          members
        })
      }
      return { projects }
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  app.post('/projects', async (request, reply) => {
    try {
      const user = await requireUser(request)
      const body = request.body as { project?: { id?: string }; slice?: unknown }
      const project = body.project
      if (!project?.id || body.slice === undefined) {
        return reply.code(400).send({ error: 'Нужны project и slice' })
      }
      const existing = await query('SELECT project_id FROM project_spaces WHERE project_id = $1', [
        project.id
      ])
      if (existing.rows.length > 0) {
        const role = await membership(project.id, user.id)
        if (!role) return reply.code(403).send({ error: 'Проект уже опубликован' })
        return reply.code(200).send({ projectId: project.id, role, revision: 0 })
      }
      await query(
        `INSERT INTO project_spaces (project_id, owner_id, project, payload, revision)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, 1)`,
        [project.id, user.id, JSON.stringify(project), JSON.stringify(body.slice)]
      )
      await query(
        'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
        [project.id, user.id, 'owner']
      )
      return { projectId: project.id, role: 'owner', revision: 1 }
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode ?? 500
      return reply.code(status === 401 ? 401 : 500).send({ error: 'Ошибка публикации проекта' })
    }
  })

  app.get('/projects/:id', async (request, reply) => {
    try {
      const user = await requireUser(request)
      const { id } = request.params as { id: string }
      const role = await membership(id, user.id)
      if (!role) return reply.code(403).send({ error: 'Нет доступа' })
      const space = await query<{ project: unknown; payload: unknown; revision: string }>(
        'SELECT project, payload, revision::text FROM project_spaces WHERE project_id = $1',
        [id]
      )
      const row = space.rows[0]
      if (!row) return reply.code(404).send({ error: 'Проект не найден' })
      return {
        project: row.project,
        slice: row.payload,
        revision: Number(row.revision),
        role,
        members: publicMembers(await loadMembers(id))
      }
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  app.put('/projects/:id', async (request, reply) => {
    try {
      const user = await requireUser(request)
      const { id } = request.params as { id: string }
      const role = await membership(id, user.id)
      if (!role || !canWrite(role)) return reply.code(403).send({ error: 'Только чтение' })
      const body = request.body as { revision?: number; project?: unknown; slice?: unknown }
      if (typeof body.revision !== 'number' || body.project === undefined || body.slice === undefined) {
        return reply.code(400).send({ error: 'Нужны revision, project и slice' })
      }
      const space = await query<{ revision: string; payload: unknown; project: unknown }>(
        'SELECT revision::text, payload, project FROM project_spaces WHERE project_id = $1',
        [id]
      )
      const row = space.rows[0]
      if (!row) return reply.code(404).send({ error: 'Проект не найден' })
      const currentRevision = Number(row.revision)
      if (body.revision !== currentRevision) {
        return reply.code(409).send({
          error: 'Конфликт ревизии',
          revision: currentRevision,
          project: row.project,
          slice: row.payload
        })
      }
      const nextRevision = currentRevision + 1
      await query(
        `UPDATE project_spaces
         SET project = $2::jsonb, payload = $3::jsonb, revision = $4, updated_at = now()
         WHERE project_id = $1`,
        [id, JSON.stringify(body.project), JSON.stringify(body.slice), nextRevision]
      )
      broadcastProject(id, { type: 'project.updated', projectId: id, revision: nextRevision })
      return { revision: nextRevision }
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  app.delete('/projects/:id', async (request, reply) => {
    try {
      const user = await requireUser(request)
      const { id } = request.params as { id: string }
      const role = await membership(id, user.id)
      if (role !== 'owner') return reply.code(403).send({ error: 'Только владелец' })
      await query('DELETE FROM project_spaces WHERE project_id = $1', [id])
      broadcastProject(id, { type: 'project.deleted', projectId: id })
      return reply.code(204).send()
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  app.delete('/projects/:id/members/:userId', async (request, reply) => {
    try {
      const user = await requireUser(request)
      const { id, userId } = request.params as { id: string; userId: string }
      const role = await membership(id, user.id)
      const targetRole = await membership(id, userId)
      if (!role || !targetRole) return reply.code(404).send({ error: 'Участник не найден' })
      if (targetRole === 'owner') return reply.code(403).send({ error: 'Владельца нельзя исключить' })
      if (userId !== user.id && !canManage(role)) {
        return reply.code(403).send({ error: 'Недостаточно прав' })
      }
      await query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [id, userId])
      return reply.code(204).send()
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  app.post('/projects/:id/invites', async (request, reply) => {
    try {
      const user = await requireUser(request)
      const { id } = request.params as { id: string }
      const role = await membership(id, user.id)
      if (!role || !canManage(role)) return reply.code(403).send({ error: 'Недостаточно прав' })
      const body = request.body as { role?: Role; days?: number }
      const inviteRole = body.role ?? 'editor'
      if (inviteRole === 'owner' || !['admin', 'editor', 'viewer'].includes(inviteRole)) {
        return reply.code(400).send({ error: 'Некорректная роль' })
      }
      const days = Math.min(30, Math.max(1, Number(body.days) || 7))
      const token = randomBytes(24).toString('base64url')
      const expires = new Date(Date.now() + days * 86_400_000)
      await query(
        `INSERT INTO invites (id, project_id, role, token_hash, expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newId(), id, inviteRole, hashToken(token), expires.toISOString(), user.id]
      )
      const url = `${config.publicUrl}/invite/${token}`
      return {
        token,
        url,
        appUrl: `tododesk://invite/${token}`,
        role: inviteRole,
        expiresAt: expires.toISOString()
      }
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  app.get('/invite/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    const result = await query<{ project: { name?: string }; role: Role; expires_at: string }>(
      `SELECT s.project, i.role, i.expires_at::text
       FROM invites i
       JOIN project_spaces s ON s.project_id = i.project_id
       WHERE i.token_hash = $1 AND i.used_at IS NULL AND i.expires_at > now()`,
      [hashToken(token)]
    )
    const row = result.rows[0]
    const name = row?.project && typeof row.project === 'object' ? (row.project as { name?: string }).name : 'проект'
    const html = `<!doctype html><meta charset="utf-8"><title>ToDoDesk</title>
      <body style="font-family:Segoe UI,sans-serif;background:#1a1d23;color:#e5e7eb;padding:48px;max-width:40rem">
      <h1>Приглашение в ToDoDesk</h1>
      <p>${row ? `Проект «${name}», роль ${row.role}.` : 'Ссылка недействительна или истекла.'}</p>
      <p>Откройте приложение ToDoDesk или вставьте токен в Настройки → Облако.</p>
      <code style="display:block;margin-top:16px;padding:12px;background:#22262e;border-radius:8px">${token}</code>
      </body>`
    return reply.type('text/html').send(html)
  })

  app.post('/invites/accept', async (request, reply) => {
    try {
      const user = await requireUser(request)
      const body = request.body as { token?: string }
      const token = body.token?.trim()
      if (!token) return reply.code(400).send({ error: 'Нет токена' })
      const invite = await query<{
        id: string
        project_id: string
        role: Role
      }>(
        `SELECT id, project_id, role FROM invites
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
        [hashToken(token)]
      )
      const row = invite.rows[0]
      if (!row) return reply.code(404).send({ error: 'Приглашение недействительно' })
      await query(
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [row.project_id, user.id, row.role]
      )
      await query('UPDATE invites SET used_at = now(), used_by = $2 WHERE id = $1', [
        row.id,
        user.id
      ])
      const space = await query<{ project: unknown; payload: unknown; revision: string }>(
        'SELECT project, payload, revision::text FROM project_spaces WHERE project_id = $1',
        [row.project_id]
      )
      const projectRow = space.rows[0]
      if (!projectRow) return reply.code(404).send({ error: 'Проект не найден' })
      const acceptedRole = (await membership(row.project_id, user.id)) ?? row.role
      return {
        project: projectRow.project,
        slice: projectRow.payload,
        revision: Number(projectRow.revision),
        role: acceptedRole,
        members: publicMembers(await loadMembers(row.project_id))
      }
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  })
}
