import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import {
  exportToFile,
  importFromPath,
  loadData,
  peekImportFile,
  saveData
} from './dataStore'
import { checkDueTasks, scheduleDailyReminder } from './notifications'
import type { DataPayload } from '../shared/schema'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    backgroundColor: '#1a1d23',
    autoHideMenuBar: true,
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
  mainWindow?.webContents.send('data:updated', data)
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.t1ltof.tododesk')

    ipcMain.handle('data:load', () => loadData())
    ipcMain.handle('data:save', (_, data: DataPayload) => {
      saveData(data)
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

    createWindow()

    const data = loadData()
    checkDueTasks(data)
    scheduleDailyReminder(() => checkDueTasks(loadData()))

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}