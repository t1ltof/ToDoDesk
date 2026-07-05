import { createHash } from 'crypto'
import { existsSync, readFileSync, statSync, watch, writeFileSync, type FSWatcher } from 'fs'
import { join } from 'path'
import { BrowserWindow } from 'electron'
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

export function resolveSyncConflict(choice: 'local' | 'external' | 'cancel'): DataPayload | null {
  const externalPath = pendingExternalPath
  const externalData = pendingExternalData
  clearPendingExternalData()

  if (choice === 'cancel' || !externalPath || !externalData) {
    return null
  }

  if (choice === 'local') {
    const local = loadData()
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