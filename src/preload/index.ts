import { contextBridge, ipcRenderer } from 'electron'
import type { ToDoDeskApi } from '../shared/api'

export type {
  CsvExportResult,
  DataLoadFailedPayload,
  ExportReport,
  ExportResult,
  ImportMode,
  ImportResult,
  SaveDataOptions,
  StoredAttachment,
  SyncNowResult,
  ToDoDeskApi,
  UpdateInfo
} from '../shared/api'

const api: ToDoDeskApi = {
  loadData: () => ipcRenderer.invoke('data:load'),
  reloadData: () => ipcRenderer.invoke('data:reload'),
  saveData: (data, options) => ipcRenderer.invoke('data:save', { data, ...options }),
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
  syncPushNow: (data) => ipcRenderer.invoke('sync:push-now', data),
  syncPullNow: () => ipcRenderer.invoke('sync:pull-now'),
  getSyncStatus: () => ipcRenderer.invoke('sync:status'),
  resolveSyncConflict: (choice, localData) => ipcRenderer.invoke('sync:resolve', choice, localData),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  openUpdateUrl: (url) => ipcRenderer.invoke('updates:open', url),
  onDataUpdated: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, data) => callback(data)
    ipcRenderer.on('data:updated', listener)
    return () => ipcRenderer.removeListener('data:updated', listener)
  },
  onDataLoadFailed: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, payload) => callback(payload)
    ipcRenderer.on('data:load-failed', listener)
    return () => ipcRenderer.removeListener('data:load-failed', listener)
  },
  onQuickAdd: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('app:quick-add', listener)
    return () => ipcRenderer.removeListener('app:quick-add', listener)
  },
  onOpenTask: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, taskId: string) => callback(taskId)
    ipcRenderer.on('app:open-task', listener)
    return () => ipcRenderer.removeListener('app:open-task', listener)
  },
  onUpdateAvailable: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, info) => callback(info)
    ipcRenderer.on('app:update-available', listener)
    return () => ipcRenderer.removeListener('app:update-available', listener)
  },
  onSyncConflict: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, payload) => callback(payload)
    ipcRenderer.on('sync:conflict', listener)
    return () => ipcRenderer.removeListener('sync:conflict', listener)
  },
  onNotification: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('app:notification', listener)
    return () => ipcRenderer.removeListener('app:notification', listener)
  }
}

contextBridge.exposeInMainWorld('tododesk', api)