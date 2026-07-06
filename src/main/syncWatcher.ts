import { createHash } from 'crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  watch,
  writeFileSync,
  type FSWatcher
} from 'fs'
import { join } from 'path'
import { BrowserWindow } from 'electron'
import type { SyncNowResult } from '../shared/api'
import { buildSyncConflictSummary, type SyncConflictPayload } from '../shared/sync'
import { getDataFilePath } from './paths'
import { loadData, loadFromExternalPath, saveData } from './dataStore'
import type { DataPayload } from '../shared/schema'

let watcher: FSWatcher | null = null
let debounceTimer: NodeJS.Timeout | null = null
let ownWriteUntil = 0
let getWindowRef: (() => BrowserWindow | null) | null = null
let getHasUnsavedChangesRef: (() => boolean) | null = null
let pendingExternalPath: string | null = null
let pendingExternalData: DataPayload | null = null

function fileHash(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function fileMtime(path: string): number {
  return statSync(path).mtimeMs
}

export function setSyncConflictHandlers(
  getWindow: () => BrowserWindow | null,
  getHasUnsavedChanges: () => boolean
): void {
  getWindowRef = getWindow
  getHasUnsavedChangesRef = getHasUnsavedChanges
}

export function getPendingExternalData(): DataPayload | null {
  return pendingExternalData
}

export function clearPendingExternalData(): void {
  pendingExternalPath = null
  pendingExternalData = null
}

export function resolveSyncConflict(
  choice: 'local' | 'external' | 'cancel',
  localData?: DataPayload
): DataPayload | null {
  const externalPath = pendingExternalPath
  const externalData = pendingExternalData
  clearPendingExternalData()

  if (choice === 'cancel' || !externalPath || !externalData) {
    return null
  }

  if (choice === 'local') {
    const local = localData ?? loadData()
    saveData(local)
    markSyncWrite()
    try {
      const content = readFileSync(getDataFilePath())
      writeFileSync(join(externalPath, 'data.tododesk'), content)
      markSyncWrite()
    } catch {
      // ignore sync write errors
    }
    return local
  }

  saveData(externalData)
  return externalData
}

export function startSyncWatcher(
  syncFolderPath: string | null,
  onUpdated: (data: DataPayload) => void
): void {
  stopSyncWatcher()

  if (!syncFolderPath) return

  const filePath = join(syncFolderPath, 'data.tododesk')
  const localPath = getDataFilePath()

  try {
    watcher = watch(syncFolderPath, (_, filename) => {
      if (filename && filename !== 'data.tododesk') return
      if (Date.now() < ownWriteUntil) return

      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        try {
          if (!existsSync(filePath)) return
          if (!existsSync(localPath)) return

          const externalHash = fileHash(filePath)
          const localHash = fileHash(localPath)
          const externalMtime = fileMtime(filePath)
          const localMtime = fileMtime(localPath)

          if (externalHash === localHash) return

          const externalData = loadFromExternalPath(filePath)
          const localData = loadData()
          const hasUnsaved = getHasUnsavedChangesRef?.() ?? false

          if (hasUnsaved || (localMtime > externalMtime && externalHash !== localHash)) {
            pendingExternalPath = syncFolderPath
            pendingExternalData = externalData
            const payload: SyncConflictPayload = {
              local: buildSyncConflictSummary(localData),
              external: buildSyncConflictSummary(externalData)
            }
            getWindowRef?.()?.webContents.send('sync:conflict', payload)
            return
          }

          saveData(externalData)
          onUpdated(externalData)
        } catch {
          // ignore reload errors from partial writes
        }
      }, 500)
    })

    watcher.on('error', () => stopSyncWatcher())
  } catch {
    // folder may not exist yet
  }
}

export function stopSyncWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  watcher?.close()
  watcher = null
}

export function markSyncWrite(): void {
  ownWriteUntil = Date.now() + 1500
}

function getSyncFilePath(syncFolderPath: string): string {
  return join(syncFolderPath, 'data.tododesk')
}

export function pushSyncNow(syncFolderPath: string | null): SyncNowResult {
  if (!syncFolderPath?.trim()) {
    return { ok: false, error: 'Укажите папку синхронизации в настройках' }
  }

  const localPath = getDataFilePath()
  const remotePath = getSyncFilePath(syncFolderPath)

  if (!existsSync(localPath)) {
    return { ok: false, error: 'Локальный файл данных не найден' }
  }

  try {
    mkdirSync(syncFolderPath, { recursive: true })
    const content = readFileSync(localPath)
    if (existsSync(remotePath) && fileHash(remotePath) === fileHash(localPath)) {
      return { ok: true, action: 'unchanged' }
    }
    writeFileSync(remotePath, content)
    markSyncWrite()
    return { ok: true, action: 'pushed' }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Не удалось отправить данные'
    }
  }
}

export function pullSyncNow(syncFolderPath: string | null): SyncNowResult & { data?: DataPayload } {
  if (!syncFolderPath?.trim()) {
    return { ok: false, error: 'Укажите папку синхронизации в настройках' }
  }

  const localPath = getDataFilePath()
  const remotePath = getSyncFilePath(syncFolderPath)

  if (!existsSync(remotePath)) {
    return { ok: false, error: 'В папке синхронизации нет data.tododesk' }
  }

  try {
    if (existsSync(localPath) && fileHash(remotePath) === fileHash(localPath)) {
      return { ok: true, action: 'unchanged', data: loadData() }
    }

    const hasUnsaved = getHasUnsavedChangesRef?.() ?? false
    const externalData = loadFromExternalPath(remotePath)

    if (hasUnsaved) {
      pendingExternalPath = syncFolderPath
      pendingExternalData = externalData
      const localData = loadData()
      const payload: SyncConflictPayload = {
        local: buildSyncConflictSummary(localData),
        external: buildSyncConflictSummary(externalData)
      }
      getWindowRef?.()?.webContents.send('sync:conflict', payload)
      return { ok: false, error: 'Есть несохранённые правки — выберите версию в диалоге конфликта' }
    }

    saveData(externalData)
    markSyncWrite()
    return { ok: true, action: 'pulled', data: externalData }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Не удалось получить данные'
    }
  }
}