import { readFileSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { MAX_ATTACHMENT_BYTES, parseCloudAttachmentPath } from '../shared/attachmentLimits'
import type { StoredAttachment } from './attachments'
import { readCloudSession } from './cloudAuth'

export async function uploadProjectAttachment(
  projectId: string,
  sourcePath: string
): Promise<StoredAttachment> {
  const session = readCloudSession()
  if (!session) throw new Error('Нет облачной сессии')
  const size = statSync(sourcePath).size
  if (size > MAX_ATTACHMENT_BYTES) throw new Error('Файл больше 5 МБ')
  const fileName = basename(sourcePath)
  const response = await fetch(`${session.serverUrl}/projects/${projectId}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(fileName)
    },
    body: readFileSync(sourcePath)
  })
  const body = (await response.json()) as { error?: string; fileName?: string; filePath?: string }
  if (!response.ok || !body.filePath || !body.fileName) {
    throw new Error(body.error ?? 'Не удалось загрузить файл')
  }
  return { fileName: body.fileName, filePath: body.filePath }
}

export async function fetchCloudAttachment(filePath: string): Promise<Response> {
  const parsed = parseCloudAttachmentPath(filePath)
  const session = readCloudSession()
  if (!parsed || !session) return new Response('Not Found', { status: 404 })
  const response = await fetch(
    `${session.serverUrl}/projects/${parsed.projectId}/attachments/${parsed.attachmentId}`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } }
  )
  if (!response.ok) return new Response('Not Found', { status: response.status })
  return new Response(response.body, {
    status: 200,
    headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/octet-stream' }
  })
}

export async function deleteCloudAttachment(filePath: string): Promise<void> {
  const parsed = parseCloudAttachmentPath(filePath)
  const session = readCloudSession()
  if (!parsed || !session) return
  await fetch(
    `${session.serverUrl}/projects/${parsed.projectId}/attachments/${parsed.attachmentId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${session.accessToken}` } }
  )
}
