import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { basename, join, resolve, sep } from 'path'
import { randomUUID } from 'crypto'
import { getAttachmentsDirectory, getDataDirectory } from './paths'

export interface StoredAttachment {
  fileName: string
  filePath: string
}

function ensureAttachmentsDirectory(): void {
  mkdirSync(getAttachmentsDirectory(), { recursive: true })
}

export function getFullAttachmentPath(relativePath: string): string {
  const baseDir = getDataDirectory()
  const attachmentsDir = resolve(getAttachmentsDirectory())
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')

  if (!normalized.startsWith('attachments/')) {
    throw new Error('Invalid attachment path')
  }

  const fullPath = resolve(baseDir, normalized)
  if (fullPath !== attachmentsDir && !fullPath.startsWith(`${attachmentsDir}${sep}`)) {
    throw new Error('Path traversal detected')
  }

  return fullPath
}

export function copyAttachmentToStorage(sourcePath: string, preferredName?: string): StoredAttachment {
  ensureAttachmentsDirectory()
  const originalName = preferredName ?? basename(sourcePath)
  const safeName = originalName.replace(/[<>:"/\\|?*]/g, '_')
  const storedName = `${randomUUID()}-${safeName}`
  const relativePath = join('attachments', storedName)
  const targetPath = getFullAttachmentPath(relativePath)

  copyFileSync(sourcePath, targetPath)

  return {
    fileName: originalName,
    filePath: relativePath.replace(/\\/g, '/')
  }
}

export function deleteAttachmentFile(relativePath: string): void {
  const fullPath = getFullAttachmentPath(relativePath)
  if (existsSync(fullPath)) {
    try {
      unlinkSync(fullPath)
    } catch {
      // ignore
    }
  }
}