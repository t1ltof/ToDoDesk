import { contextBridge, ipcRenderer } from 'electron'
import type { ImportPreview } from '../shared/import'
import type { DataPayload } from '../shared/schema'

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

export interface ToDoDeskApi {
  loadData: () => Promise<DataPayload>
  saveData: (data: DataPayload) => Promise<DataPayload>
  exportData: () => Promise<DataPayload | null>
  pickImportFile: () => Promise<ImportPreview | null>
  importFile: (filePath: string, mode: 'replace' | 'new-project') => Promise<ImportResult>
  checkUpdates: () => Promise<UpdateInfo>
  openUpdateUrl: (url: string) => Promise<void>
  onDataUpdated: (callback: (data: DataPayload) => void) => () => void
  onQuickAdd: (callback: () => void) => () => void
  onOpenTask: (callback: (taskId: string) => void) => () => void
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void
}

const api: ToDoDeskApi = {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  exportData: () => ipcRenderer.invoke('data:export'),
  pickImportFile: () => ipcRenderer.invoke('data:pick-import'),
  importFile: (filePath, mode) => ipcRenderer.invoke('data:import-file', filePath, mode),
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
  }
}

contextBridge.exposeInMainWorld('tododesk', api)