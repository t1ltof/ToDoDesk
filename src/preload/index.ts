import { contextBridge, ipcRenderer } from 'electron'
import type { ImportPreview } from '../shared/import'
import type { DataPayload } from '../shared/schema'
import type { SyncConflictChoice, SyncConflictPayload } from '../shared/sync'

export interface UpdateInfo {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string | null
  url: string | null
  error: string | null
}

export interface ImportResult {
  ok: boolean
  data?: DataPayload
  error?: string
}

export interface ExportReport {
  exportedAt: string
  appVersion: string
  formatVersion: string
  projectCount: number
  taskCount: number
  doneCount: number
  tagCount: number
  templateCount: number
  projectTemplateCount: number
  noteCount: number
  boardNodeCount: number
  activityLogCount: number
}

export interface ExportResult {
  data: DataPayload
  report: ExportReport
}

export interface CsvExportResult {
  path: string
  rowCount: number
}

export type ImportMode = 'replace' | 'new-project' | 'merge'

export interface StoredAttachment {
  fileName: string
  filePath: string
}

export interface ToDoDeskApi {
  loadData: () => Promise<DataPayload>
  saveData: (data: DataPayload) => Promise<DataPayload>
  pickAttachmentFile: () => Promise<StoredAttachment | null>
  copyAttachmentFile: (sourcePath: string, fileName?: string) => Promise<StoredAttachment>
  openAttachmentPath: (filePath: string) => Promise<void>
  deleteAttachmentFile: (filePath: string) => Promise<void>
  exportData: (mergeWithCurrent?: boolean) => Promise<ExportResult | null>
  exportCsv: () => Promise<CsvExportResult | null>
  exportReport: () => Promise<ExportReport>
  pickImportFile: () => Promise<ImportPreview | null>
  importFile: (filePath: string, mode: ImportMode) => Promise<ImportResult>
  setDataPassword: (password: string | null) => Promise<boolean>
  setUnsavedChanges: (hasUnsaved: boolean) => Promise<void>
  resolveSyncConflict: (choice: SyncConflictChoice) => Promise<DataPayload | null>
  checkUpdates: () => Promise<UpdateInfo>
  openUpdateUrl: (url: string) => Promise<void>
  onDataUpdated: (callback: (data: DataPayload) => void) => () => void
  onQuickAdd: (callback: () => void) => () => void
  onOpenTask: (callback: (taskId: string) => void) => () => void
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void
  onSyncConflict: (callback: (payload: SyncConflictPayload) => void) => () => void
  onNotification: (callback: () => void) => () => void
}

const api: ToDoDeskApi = {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  pickAttachmentFile: () => ipcRenderer.invoke('attachments:pick'),
  copyAttachmentFile: (sourcePath, fileName) =>
    ipcRenderer.invoke('attachments:copy', sourcePath, fileName),
  openAttachmentPath: (filePath) => ipcRenderer.invoke('attachments:open', filePath),
  deleteAttachmentFile: (filePath) => ipcRenderer.invoke('attachments:delete', filePath),
  exportData: (mergeWithCurrent) => ipcRenderer.invoke('data:export', mergeWithCurrent),
  exportCsv: () => ipcRenderer.invoke('data:export-csv'),
  exportReport: () => ipcRenderer.invoke('data:export-report'),
  pickImportFile: () => ipcRenderer.invoke('data:pick-import'),
  importFile: (filePath, mode) => ipcRenderer.invoke('data:import-file', filePath, mode),
  setDataPassword: (password) => ipcRenderer.invoke('security:set-password', password),
  setUnsavedChanges: (hasUnsaved) => ipcRenderer.invoke('sync:set-unsaved', hasUnsaved),
  resolveSyncConflict: (choice) => ipcRenderer.invoke('sync:resolve', choice),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  openUpdateUrl: (url) => ipcRenderer.invoke('updates:open', url),
  onDataUpdated: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: DataPayload): void => callback(data)
    ipcRenderer.on('data:updated', listener)
    return () => ipcRenderer.removeListener('data:updated', listener)
  },
  onQuickAdd: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('app:quick-add', listener)
    return () => ipcRenderer.removeListener('app:quick-add', listener)
  },
  onOpenTask: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, taskId: string): void => callback(taskId)
    ipcRenderer.on('app:open-task', listener)
    return () => ipcRenderer.removeListener('app:open-task', listener)
  },
  onUpdateAvailable: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, info: UpdateInfo): void => callback(info)
    ipcRenderer.on('app:update-available', listener)
    return () => ipcRenderer.removeListener('app:update-available', listener)
  },
  onSyncConflict: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, payload: SyncConflictPayload): void =>
      callback(payload)
    ipcRenderer.on('sync:conflict', listener)
    return () => ipcRenderer.removeListener('sync:conflict', listener)
  },
  onNotification: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('app:notification', listener)
    return () => ipcRenderer.removeListener('app:notification', listener)
  }
}

contextBridge.exposeInMainWorld('tododesk', api)