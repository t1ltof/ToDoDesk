import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import { getIconPath } from './resources'
import {
  exportToFile,
  importFromPath,
  loadData,
  peekImportFile,
  saveData
} from './dataStore'
import { registerHotkeys, unregisterHotkeys } from './hotkeys'
import { checkDueTasks, scheduleDailyReminder } from './notifications'
import { createTray, destroyTray, updateTrayTooltip } from './tray'
import type { DataPayload } from '../shared/schema'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let isQuitting = false
let reminderTimer: NodeJS.Timeout | null = null

function getWindow(): BrowserWindow | null {
  return mainWindow
}

function showMainWindow(): void {
  if (!mainWindow) return
  if (!mainWindow.isVisible()) mainWindow.show()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
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
    mainWindow?.show()
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

function quitApp(): void {
  isQuitting = true
  unregisterHotkeys()
  destroyTray()
  if (reminderTimer) clearInterval(reminderTimer)
  app.quit()
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.t1ltof.tododesk')

    ipcMain.handle('data:load', () => loadData())
    ipcMain.handle('data:save', (_, data: DataPayload) => {
      saveData(data)
      updateTrayTooltip(data)
      return data
    })

    ipcMain.handle('data:export', async () => {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: 'Экспорт данных',
        defaultPath: `tododesk-${new Date().toISOString().slice(0, 10)}.tododesk`,
        filters: [{ name: 'ToDoDesk', extensions: ['tododesk'] }]
      })

      if (result.canceled || !result.filePath) return null
      return exportToFile(result.filePath)
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

    ipcMain.handle('data:import-file', (_, filePath: string, mode: 'replace' | 'new-project') => {
      const data = importFromPath(filePath, mode)
      broadcastData(data)
      return data
    })

    ipcMain.handle('app:show', () => {
      showMainWindow()
    })

    createWindow()
    createTray(getWindow, loadData, quitApp)
    registerHotkeys(getWindow)

    const data = loadData()
    updateTrayTooltip(data)
    checkDueTasks(data)
    reminderTimer = scheduleDailyReminder(() => checkDueTasks(loadData()))

    app.on('activate', () => {
      showMainWindow()
    })
  })

  app.on('will-quit', () => {
    unregisterHotkeys()
  })

  app.on('window-all-closed', () => {
    // Windows: keep running in tray
  })
}