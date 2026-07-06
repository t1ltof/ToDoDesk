import type { ImportPreview } from './import'
import type { DataPayload } from './schema'
import type { SyncConflictChoice, SyncConflictPayload } from './sync'

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

export interface DataLoadFailedPayload {
  message: string
  needsPassword: boolean
}

export interface SaveDataOptions {
  clearUnsaved?: boolean
}

export interface SyncNowResult {
  ok: boolean
  action?: 'pushed' | 'pulled' | 'unchanged'
  error?: string
}

export interface ToDoDeskApi {
  loadData: () => Promise<DataPayload>
  reloadData: () => Promise<DataPayload>
  saveData: (data: DataPayload, options?: SaveDataOptions) => Promise<DataPayload>
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
  syncPushNow: () => Promise<SyncNowResult>
  syncPullNow: () => Promise<SyncNowResult>
  resolveSyncConflict: (choice: SyncConflictChoice) => Promise<DataPayload | null>
  checkUpdates: () => Promise<UpdateInfo>
  openUpdateUrl: (url: string) => Promise<void>
  onDataUpdated: (callback: (data: DataPayload) => void) => () => void
  onDataLoadFailed: (callback: (payload: DataLoadFailedPayload) => void) => () => void
  onQuickAdd: (callback: () => void) => () => void
  onOpenTask: (callback: (taskId: string) => void) => () => void
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void
  onSyncConflict: (callback: (payload: SyncConflictPayload) => void) => () => void
  onNotification: (callback: () => void) => () => void
}