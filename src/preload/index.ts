import { contextBridge, ipcRenderer } from 'electron'
import type { ImportPreview } from '../shared/import'
import type { DataPayload } from '../shared/schema'

export interface ToDoDeskApi {
  loadData: () => Promise<DataPayload>
  saveData: (data: DataPayload) => Promise<DataPayload>
  exportData: () => Promise<DataPayload | null>
  pickImportFile: () => Promise<ImportPreview | null>
  importFile: (filePath: string, mode: 'replace' | 'new-project') => Promise<DataPayload>
  onDataUpdated: (callback: (data: DataPayload) => void) => () => void
  onQuickAdd: (callback: () => void) => () => void
}

const api: ToDoDeskApi = {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  exportData: () => ipcRenderer.invoke('data:export'),
  pickImportFile: () => ipcRenderer.invoke('data:pick-import'),
  importFile: (filePath, mode) => ipcRenderer.invoke('data:import-file', filePath, mode),
  onDataUpdated: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: DataPayload): void => callback(data)
    ipcRenderer.on('data:updated', listener)
    return () => ipcRenderer.removeListener('data:updated', listener)
  },
  onQuickAdd: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('app:quick-add', listener)
    return () => ipcRenderer.removeListener('app:quick-add', listener)
  }
}

contextBridge.exposeInMainWorld('tododesk', api)