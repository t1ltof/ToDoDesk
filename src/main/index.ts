import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron'
import { pathToFileURL } from 'url'
import {
  copyAttachmentToStorage,
  deleteAttachmentFile,
  getFullAttachmentPath
} from './attachments'
import { join } from 'path'
import { applyAutostart } from './autostart'
import {
  buildExportReport,
  DataLoadError,
  exportCsvToFile,
  exportToFile,
  importFromPath,
  loadData,
  peekImportFile,
  saveData,
  type ImportMode
} from './dataStore'
import { createEmptyData } from '../shared/schema'
import { setDataPassword } from './encryption'
import { registerHotkeys, unregisterHotkeys } from './hotkeys'
import { checkDueTasks, scheduleReminders } from './notifications'
import { getIconPath } from './resources'
import { createTray, destroyTray, updateTrayTooltip } from './tray'
import { checkForUpdates } from './updates'
import {
  resolveSyncConflict,
  setSyncConflictHandlers,
  startSyncWatcher,
  stopSyncWatcher
} from './syncWatcher'
import type { DataPayload } from '../shared/schema'
import type { SyncConflictChoice } from '../shared/sync'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let isQuitting = false
let reminderTimer: NodeJS.Timeout | null = null
let hasUnsavedChanges = false
let lastSyncFolderPath: string | null | undefined

function getWindow(): BrowserWindow | null {
  return mainWindow
}

function showMainWindow(): void {
  if (!mainWindow) return
  if (!mainWindow.isVisible()) mainWindow.show()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
}

function createWindow(startHidden = false): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    title: isDev ? 'ToDoDesk — Разработка' : 'ToDoDesk',
    backgroundColor: '#1a1d23',
    autoHideMenuBar: true,
    icon: getIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (!startHidden) mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function broadcastData(data: DataPayload): void {
  updateTrayTooltip(data)
  mainWindow?.webContents.send('data:updated', data)
}

function applySettings(data: DataPayload): void {
  applyAutostart(data.settings)
  const syncPath = data.settings.syncFolderPath
  if (syncPath !== lastSyncFolderPath) {
    lastSyncFolderPath = syncPath
    startSyncWatcher(syncPath, (synced) => {
      applySettings(synced)
      broadcastData(synced)
    })
  }
}

function quitApp(): void {
  isQuitting = true
  stopSyncWatcher()
  unregisterHotkeys()
  destroyTray()
  if (reminderTimer) clearInterval(reminderTimer)
  app.quit()
}

async function maybeCheckUpdates(data: DataPayload): Promise<void> {
  if (!data.settings.checkUpdates) return
  const dismissed = data.settings.dismissedUpdateVersion
  const info = await checkForUpdates()
  if (info.hasUpdate && info.latestVersion !== dismissed) {
    mainWindow?.webContents.send('app:update-available', info)
  }
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'tododesk-attachment',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

const startHidden = process.argv.includes('--hidden')
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())

  app.whenReady().then(() => {
    app.setAppUserModelId('com.t1ltof.tododesk')

    protocol.handle('tododesk-attachment', (request) => {
      try {
        const relativePath = decodeURIComponent(
          request.url.replace(/^tododesk-attachment:\/\//, '')
        )
        return net.fetch(pathToFileURL(getFullAttachmentPath(relativePath)).toString())
      } catch {
        return new Response('Not Found', { status: 404 })
      }
    })

    ipcMain.handle('data:load', () => loadData())
    ipcMain.handle('data:reload', () => loadData())
    ipcMain.handle(
      'data:save',
      (_, payload: DataPayload | { data: DataPayload; clearUnsaved?: boolean }) => {
        const data = 'data' in payload ? payload.data : payload
        const clearUnsaved = 'data' in payload ? payload.clearUnsaved !== false : false
        saveData(data)
        if (clearUnsaved) hasUnsavedChanges = false
        applySettings(data)
        updateTrayTooltip(data)
        return data
      }
    )

    ipcMain.handle('data:export', async (_, mergeWithCurrent?: boolean) => {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: 'Экспорт данных',
        defaultPath: `tododesk-${new Date().toISOString().slice(0, 10)}.tododesk`,
        filters: [{ name: 'ToDoDesk', extensions: ['tododesk'] }]
      })
      if (result.canceled || !result.filePath) return null
      return exportToFile(result.filePath, mergeWithCurrent ?? false)
    })

    ipcMain.handle('data:export-report', () => buildExportReport(loadData()))

    ipcMain.handle('data:export-csv', async () => {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: 'Экспорт CSV',
        defaultPath: `tododesk-tasks-${new Date().toISOString().slice(0, 10)}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      })
      if (result.canceled || !result.filePath) return null
      return exportCsvToFile(result.filePath)
    })

    ipcMain.handle('sync:set-unsaved', (_, value: boolean) => {
      hasUnsavedChanges = value
    })

    ipcMain.handle('sync:resolve', (_, choice: SyncConflictChoice) => {
      const data = resolveSyncConflict(choice)
      if (data) {
        applySettings(data)
        broadcastData(data)
      }
      return data
    })

    ipcMain.handle('data:pick-import', async () => {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: 'Выберите файл для импорта',
        filters: [{ name: 'ToDoDesk', extensions: ['tododesk'] }],
        properties: ['openFile']
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return peekImportFile(result.filePaths[0])
    })

    ipcMain.handle('data:import-file', (_, filePath: string, mode: ImportMode) => {
      try {
        const data = importFromPath(filePath, mode)
        applySettings(data)
        broadcastData(data)
        return { ok: true as const, data }
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : 'Ошибка импорта'
        }
      }
    })

    ipcMain.handle('security:set-password', (_, password: string | null) => {
      setDataPassword(password)
      return true
    })

    ipcMain.handle('app:show', () => showMainWindow())
    ipcMain.handle('updates:check', () => checkForUpdates())
    ipcMain.handle('updates:open', (_, url: string) => shell.openExternal(url))

    ipcMain.handle('attachments:pick', async () => {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: 'Прикрепить файл',
        properties: ['openFile']
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return copyAttachmentToStorage(result.filePaths[0])
    })

    ipcMain.handle('attachments:copy', (_, sourcePath: string, fileName?: string) =>
      copyAttachmentToStorage(sourcePath, fileName)
    )

    ipcMain.handle('attachments:open', async (_, filePath: string) => {
      await shell.openPath(getFullAttachmentPath(filePath))
    })

    ipcMain.handle('attachments:delete', (_, filePath: string) => {
      deleteAttachmentFile(filePath)
    })

    createWindow(startHidden)
    setSyncConflictHandlers(getWindow, () => hasUnsavedChanges)
    createTray(getWindow, loadData, quitApp)
    registerHotkeys(getWindow)

    let data: DataPayload
    try {
      data = loadData()
    } catch (error) {
      data = createEmptyData()
      const needsPassword = error instanceof DataLoadError && error.needsPassword
      mainWindow?.webContents.once('did-finish-load', () => {
        mainWindow?.webContents.send('data:load-failed', {
          message: error instanceof Error ? error.message : 'Не удалось загрузить данные',
          needsPassword
        })
      })
    }

    applySettings(data)
    updateTrayTooltip(data)
    checkDueTasks(data, getWindow)
    reminderTimer = scheduleReminders(loadData, getWindow)
    void maybeCheckUpdates(data)

    app.on('activate', () => showMainWindow())
  })

  app.on('will-quit', () => {
    stopSyncWatcher()
    unregisterHotkeys()
  })
}