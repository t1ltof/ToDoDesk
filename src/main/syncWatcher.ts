import { existsSync, watch, type FSWatcher } from 'fs'
import { join } from 'path'
import { loadFromExternalPath, saveData } from './dataStore'
import type { DataPayload } from '../shared/schema'

let watcher: FSWatcher | null = null
let debounceTimer: NodeJS.Timeout | null = null
let ownWriteUntil = 0

export function startSyncWatcher(
  syncFolderPath: string | null,
  onUpdated: (data: DataPayload) => void
): void {
  stopSyncWatcher()

  if (!syncFolderPath) return

  const filePath = join(syncFolderPath, 'data.tododesk')

  try {
    watcher = watch(syncFolderPath, (_, filename) => {
      if (filename && filename !== 'data.tododesk') return
      if (Date.now() < ownWriteUntil) return

      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        try {
          if (!existsSync(filePath)) return
          const data = loadFromExternalPath(filePath)
          saveData(data)
          onUpdated(data)
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