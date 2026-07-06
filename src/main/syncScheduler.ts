import type { DataPayload } from '../shared/schema'
import { loadData, saveData } from './dataStore'
import { pushSyncNow } from './syncWatcher'

export type SyncStatus = 'disabled' | 'idle' | 'synced' | 'pending' | 'error'

export interface SyncStatusInfo {
  status: SyncStatus
  message: string
  lastPushAt: string | null
}

let status: SyncStatus = 'disabled'
let statusMessage = 'Папка синхронизации не указана'
let pendingPush = false
let pushInProgress = false
let schedulerTimer: NodeJS.Timeout | null = null
let onStatusChangeRef: (() => void) | null = null

function formatPushTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function getSyncStatusInfo(data?: DataPayload): SyncStatusInfo {
  const payload = data ?? loadData()
  return {
    status,
    message: statusMessage,
    lastPushAt: payload.settings.syncLastPushAt ?? null
  }
}

export function refreshSyncStatus(data: DataPayload): void {
  if (!data.settings.syncFolderPath?.trim()) {
    status = 'disabled'
    statusMessage = 'Папка синхронизации не указана'
    return
  }

  if (pushInProgress || status === 'pending') return

  if (status === 'error') return

  if (data.settings.syncLastPushAt) {
    status = 'synced'
    statusMessage = `Отправлено ${formatPushTime(data.settings.syncLastPushAt)}`
    return
  }

  status = data.settings.syncAutoPushEnabled ? 'idle' : 'idle'
  statusMessage = data.settings.syncAutoPushEnabled
    ? 'Автоотправка включена'
    : 'Ручная синхронизация'
}

export function markSyncPending(): void {
  const data = loadData()
  if (!data.settings.syncFolderPath?.trim()) return
  pendingPush = true
  status = 'pending'
  statusMessage = 'Ожидание отправки'
  onStatusChangeRef?.()
}

export function recordManualPush(data: DataPayload, ok: boolean, error?: string): DataPayload {
  if (!ok) {
    status = 'error'
    statusMessage = error ?? 'Ошибка отправки'
    onStatusChangeRef?.()
    return data
  }

  pendingPush = false
  const now = new Date().toISOString()
  const updated: DataPayload = {
    ...data,
    settings: { ...data.settings, syncLastPushAt: now }
  }
  status = 'synced'
  statusMessage = `Отправлено ${formatPushTime(now)}`
  onStatusChangeRef?.()
  return updated
}

async function attemptAutoPush(): Promise<void> {
  const data = loadData()
  const folder = data.settings.syncFolderPath?.trim()
  if (!folder || !data.settings.syncAutoPushEnabled || pushInProgress) {
    refreshSyncStatus(data)
    return
  }

  const intervalMs = data.settings.syncAutoPushIntervalMinutes * 60_000
  const lastPushMs = data.settings.syncLastPushAt
    ? new Date(data.settings.syncLastPushAt).getTime()
    : 0
  const due = pendingPush || Date.now() - lastPushMs >= intervalMs
  if (!due) return

  pushInProgress = true
  status = 'pending'
  statusMessage = 'Отправка...'
  onStatusChangeRef?.()

  const result = pushSyncNow(folder)
  pushInProgress = false

  if (result.ok) {
    pendingPush = false
    const now = new Date().toISOString()
    const updated: DataPayload = {
      ...data,
      settings: { ...data.settings, syncLastPushAt: now }
    }
    saveData(updated)
    status = 'synced'
    statusMessage =
      result.action === 'unchanged'
        ? `Актуально (${formatPushTime(now)})`
        : `Отправлено ${formatPushTime(now)}`
  } else {
    status = 'error'
    statusMessage = result.error ?? 'Ошибка отправки'
  }

  onStatusChangeRef?.()
}

export function startSyncScheduler(onStatusChange: () => void): void {
  stopSyncScheduler()
  onStatusChangeRef = onStatusChange
  refreshSyncStatus(loadData())
  schedulerTimer = setInterval(() => {
    void attemptAutoPush()
  }, 60_000)
}

export function stopSyncScheduler(): void {
  if (schedulerTimer) clearInterval(schedulerTimer)
  schedulerTimer = null
  onStatusChangeRef = null
}