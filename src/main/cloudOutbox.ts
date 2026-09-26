import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DataPayload } from '../shared/schema'
import { getDataDirectory } from './paths'

function queuePath(): string {
  return join(getDataDirectory(), 'cloud-outbox.json')
}

export function queueCloudPush(data: DataPayload): void {
  writeFileSync(queuePath(), JSON.stringify({ savedAt: new Date().toISOString(), data }))
}

export function readCloudQueue(): DataPayload | null {
  const path = queuePath()
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { data?: DataPayload }
    return parsed.data ?? null
  } catch {
    return null
  }
}

export function hasCloudQueue(): boolean {
  return existsSync(queuePath())
}

export function clearCloudQueue(): void {
  const path = queuePath()
  if (existsSync(path)) unlinkSync(path)
}
