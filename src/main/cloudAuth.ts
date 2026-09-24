import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { safeStorage } from 'electron'
import { getDataDirectory } from './paths'

export interface CloudSession {
  serverUrl: string
  accessToken: string
  refreshToken: string
  userId: string
  login: string
  displayName: string
  revision: number
}

function sessionPath(): string {
  return join(getDataDirectory(), 'cloud-session.bin')
}

export function readCloudSession(): CloudSession | null {
  const path = sessionPath()
  if (!existsSync(path)) return null
  try {
    const raw = readFileSync(path)
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(raw)
      : raw.toString('utf8')
    return JSON.parse(json) as CloudSession
  } catch {
    return null
  }
}

export function writeCloudSession(session: CloudSession): void {
  const json = JSON.stringify(session)
  const payload = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, 'utf8')
  writeFileSync(sessionPath(), payload)
}

export function clearCloudSession(): void {
  const path = sessionPath()
  if (existsSync(path)) {
    unlinkSync(path)
  }
}
