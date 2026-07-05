import { contextBridge, ipcRenderer } from 'electron'
import type { DataPayload } from '../shared/schema'

export interface ToDoDeskApi {
  loadData: () => Promise<DataPayload>
  saveData: (data: DataPayload) => Promise<DataPayload>
  exportData: () => Promise<DataPayload | null>
  importData: (mode: 'replace' | 'new-project') => Promise<DataPayload | null>
  onDataUpdated: (callback: (data: DataPayload) => void) => () => void
}

const api: ToDoDeskApi = {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: (mode) => ipcRenderer.invoke('data:import', mode),
  onDataUpdated: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: DataPayload): void => callback(data)
    ipcRenderer.on('data:updated', listener)
    return () => ipcRenderer.removeListener('data:updated', listener)
  }
}

contextBridge.exposeInMainWorld('tododesk', api)