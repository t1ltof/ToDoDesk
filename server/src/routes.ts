import argon2 from 'argon2'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { query } from './db.js'
import { hitRateLimit } from './rateLimit.js'
import {
  createRefreshToken,
  hashRefreshToken,
  newId,
  signAccessToken,
  verifyAccessToken
} from './tokens.js'

interface UserRow {
  id: string
  login: string
  password_hash: string
  display_name: string
}

interface SpaceRow {
  payload: unknown
  revision: string
}

function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7).trim() || null
}

async function requireUser(request: FastifyRequest): Promise<UserRow> {
  const token = bearer(request)
  if (!token) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
  }
  try {
    const payload = await verifyAccessToken(token)
    const result = await query<UserRow>('SELECT id, login, password_hash, display_name FROM users WHERE id = $1', [
      payload.sub
    ])
    const user = result.rows[0]
    if (!user) {
      throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
    }
    return user
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 401) throw error
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
  }
}

function publicUser(user: UserRow): { id: string; login: string; displayName: string } {
  return { id: user.id, login: user.login, displayName: user.display_name }
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ ok: true }))

  app.post('/auth/login', async (request, reply) => {
    const ip = request.ip || 'unknown'
    if (hitRateLimit(`login:${ip}`, 10, 10 * 60_000)) {
      return reply.code(429).send({ error: 'Слишком много попыток входа' })
    }

    const body = request.body as { login?: string; password?: string }
    const login = body.login?.trim().toLowerCase()
    const password = body.password ?? ''
    if (!login || !password) {
      return reply.code(400).send({ error: 'Укажите логин и пароль' })
    }

    const result = await query<UserRow>(
      'SELECT id, login, password_hash, display_name FROM users WHERE login = $1',
      [login]
    )
    const user = result.rows[0]
    if (!user || !(await argon2.verify(user.password_hash, password))) {
      return reply.code(401).send({ error: 'Неверный логин или пароль' })
    }

    const refresh = createRefreshToken()
    await query('INSERT INTO sessions (id, user_id, refresh_hash, expires_at) VALUES ($1, $2, $3, $4)', [
      newId(),
      user.id,
      refresh.hash,
      refresh.expiresAt.toISOString()
    ])
    const accessToken = await signAccessToken(user.id, user.login)
    return {
      accessToken,
      refreshToken: refresh.token,
      user: publicUser(user)
    }
  })

  app.post('/auth/refresh', async (request, reply) => {
    const body = request.body as { refreshToken?: string }
    const refreshToken = body.refreshToken?.trim()
    if (!refreshToken) {
      return reply.code(400).send({ error: 'Нет refresh-токена' })
    }
    const hash = hashRefreshToken(refreshToken)
    const session = await query<{ id: string; user_id: string }>(
      'SELECT id, user_id FROM sessions WHERE refresh_hash = $1 AND expires_at > now()',
      [hash]
    )
    const row = session.rows[0]
    if (!row) {
      return reply.code(401).send({ error: 'Сессия недействительна' })
    }
    const userResult = await query<UserRow>(
      'SELECT id, login, password_hash, display_name FROM users WHERE id = $1',
      [row.user_id]
    )
    const user = userResult.rows[0]
    if (!user) {
      return reply.code(401).send({ error: 'Пользователь не найден' })
    }
    const next = createRefreshToken()
    await query('UPDATE sessions SET refresh_hash = $1, expires_at = $2 WHERE id = $3', [
      next.hash,
      next.expiresAt.toISOString(),
      row.id
    ])
    return {
      accessToken: await signAccessToken(user.id, user.login),
      refreshToken: next.token,
      user: publicUser(user)
    }
  })

  app.post('/auth/logout', async (request, reply) => {
    const body = request.body as { refreshToken?: string }
    const refreshToken = body.refreshToken?.trim()
    if (refreshToken) {
      await query('DELETE FROM sessions WHERE refresh_hash = $1', [hashRefreshToken(refreshToken)])
    }
    return reply.code(204).send()
  })

  app.get('/me', async (request, reply) => {
    try {
      const user = await requireUser(request)
      return { user: publicUser(user) }
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  app.get('/sync/personal', async (request, reply) => {
    try {
      const user = await requireUser(request)
      const space = await query<SpaceRow>(
        'SELECT payload, revision::text FROM personal_spaces WHERE user_id = $1',
        [user.id]
      )
      const row = space.rows[0]
      if (!row) {
        return { revision: 0, data: null }
      }
      return { revision: Number(row.revision), data: row.payload }
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode ?? 500
      return reply.code(status === 401 ? 401 : 500).send({ error: status === 401 ? 'Unauthorized' : 'Ошибка сервера' })
    }
  })

  app.put('/sync/personal', async (request, reply) => {
    try {
      const user = await requireUser(request)
      const body = request.body as { revision?: number; data?: unknown }
      if (body.data === undefined || typeof body.revision !== 'number') {
        return reply.code(400).send({ error: 'Нужны data и revision' })
      }

      const space = await query<SpaceRow>(
        'SELECT payload, revision::text FROM personal_spaces WHERE user_id = $1',
        [user.id]
      )
      const row = space.rows[0]
      const currentRevision = row ? Number(row.revision) : 0
      if (row && body.revision !== currentRevision) {
        return reply.code(409).send({
          error: 'Конфликт ревизии',
          revision: currentRevision,
          data: row.payload
        })
      }

      const nextRevision = currentRevision + 1
      await query(
        `INSERT INTO personal_spaces (user_id, payload, revision, updated_at)
         VALUES ($1, $2::jsonb, $3, now())
         ON CONFLICT (user_id)
         DO UPDATE SET payload = EXCLUDED.payload, revision = EXCLUDED.revision, updated_at = now()`,
        [user.id, JSON.stringify(body.data), nextRevision]
      )
      return { revision: nextRevision, data: body.data }
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode ?? 500
      return reply.code(status === 401 ? 401 : 500).send({
        error: status === 401 ? 'Unauthorized' : 'Ошибка сервера'
      })
    }
  })
}
