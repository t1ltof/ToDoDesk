import { createReadStream, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { query } from './db.js'
import { newId, verifyAccessToken } from './tokens.js'

const MAX_FILE = 5 * 1024 * 1024
const MAX_PROJECT = 50 * 1024 * 1024

function uploadRoot(): string {
  return process.env.UPLOAD_DIR?.trim() || '/opt/tododesk/uploads'
}

function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7).trim() || null
}

async function requireUserId(request: FastifyRequest): Promise<string> {
  const token = bearer(request)
  if (!token) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
  const payload = await verifyAccessToken(token)
  return payload.sub
}

async function roleOf(projectId: string, userId: string): Promise<string | null> {
  const result = await query<{ role: string }>(
    'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  )
  return result.rows[0]?.role ?? null
}

function canWrite(role: string | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor'
}

export async function registerAttachmentRoutes(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer', bodyLimit: MAX_FILE },
    (_request, body, done) => {
      done(null, body)
    }
  )

  app.post('/projects/:id/attachments', async (request, reply) => {
    try {
      const userId = await requireUserId(request)
      const { id: projectId } = request.params as { id: string }
      const role = await roleOf(projectId, userId)
      if (!canWrite(role)) return reply.code(403).send({ error: 'Недостаточно прав' })

      const body = request.body
      if (!Buffer.isBuffer(body)) return reply.code(400).send({ error: 'Ожидается файл' })
      if (body.length > MAX_FILE) return reply.code(413).send({ error: 'Файл больше 5 МБ' })

      const used = await query<{ total: string }>(
        'SELECT COALESCE(SUM(size), 0)::text AS total FROM project_attachments WHERE project_id = $1',
        [projectId]
      )
      const nextTotal = Number(used.rows[0]?.total ?? 0) + body.length
      if (nextTotal > MAX_PROJECT) {
        return reply.code(413).send({ error: 'Квота проекта 50 МБ исчерпана' })
      }

      const attachmentId = newId()
      const rawName = decodeURIComponent(String(request.headers['x-file-name'] ?? 'file'))
      const fileName = rawName.replace(/[<>:"/\\|?*]/g, '_').slice(0, 180) || 'file'
      const dir = join(uploadRoot(), projectId)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, attachmentId), body)
      await query(
        `INSERT INTO project_attachments (id, project_id, uploaded_by, file_name, size)
         VALUES ($1, $2, $3, $4, $5)`,
        [attachmentId, projectId, userId, fileName, body.length]
      )
      return {
        id: attachmentId,
        fileName,
        filePath: `cloud/${projectId}/${attachmentId}`,
        size: body.length
      }
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 401) return reply.code(401).send({ error: 'Unauthorized' })
      throw error
    }
  })

  app.get('/projects/:id/attachments/:attachmentId', async (request, reply) => {
    try {
      const userId = await requireUserId(request)
      const { id: projectId, attachmentId } = request.params as { id: string; attachmentId: string }
      const role = await roleOf(projectId, userId)
      if (!role) return reply.code(403).send({ error: 'Нет доступа' })
      const row = await query<{ file_name: string }>(
        'SELECT file_name FROM project_attachments WHERE id = $1 AND project_id = $2',
        [attachmentId, projectId]
      )
      const file = row.rows[0]
      if (!file) return reply.code(404).send({ error: 'Файл не найден' })
      reply.header('Content-Disposition', `inline; filename="${encodeURIComponent(file.file_name)}"`)
      return reply.send(createReadStream(join(uploadRoot(), projectId, attachmentId)))
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 401) return reply.code(401).send({ error: 'Unauthorized' })
      throw error
    }
  })

  app.delete('/projects/:id/attachments/:attachmentId', async (request, reply) => {
    try {
      const userId = await requireUserId(request)
      const { id: projectId, attachmentId } = request.params as { id: string; attachmentId: string }
      const role = await roleOf(projectId, userId)
      if (!canWrite(role)) return reply.code(403).send({ error: 'Недостаточно прав' })
      const row = await query(
        'DELETE FROM project_attachments WHERE id = $1 AND project_id = $2 RETURNING id',
        [attachmentId, projectId]
      )
      if (!row.rows[0]) return reply.code(404).send({ error: 'Файл не найден' })
      try {
        unlinkSync(join(uploadRoot(), projectId, attachmentId))
      } catch {
        // file may already be gone
      }
      return reply.code(204).send()
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 401) return reply.code(401).send({ error: 'Unauthorized' })
      throw error
    }
  })
}
