import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import { applyAutostart } from './autostart'
import {
  exportToFile,
  importFromPath,
  loadData,
  peekImportFile,
  saveData
} from './dataStore'
import { registerHotkeys, unregisterHotkeys } from './hotkeys'
import { checkDueTasks, scheduleReminders } from './notifications'
import { getIconPath } from './resources'
import { createTray, destroyTray, updateTrayTooltip } from './tray'
import { checkForUpdates } from './updates'
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
}

function quitApp(): void {
  isQuitting = true
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

const startHidden = process.argv.includes('--hidden')
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())

  app.whenReady().then(() => {
    app.setAppUserModelId('com.t1ltof.tododesk')

    ipcMain.handle('data:load', () => loadData())
    ipcMain.handle('data:save', (_, data: DataPayload) => {
      saveData(data)
      applySettings(data)
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

    ipcMain.handle('app:show', () => showMainWindow())
    ipcMain.handle('updates:check', () => checkForUpdates())
    ipcMain.handle('updates:open', (_, url: string) => shell.openExternal(url))

    createWindow(startHidden)
    createTray(getWindow, loadData, quitApp)
    registerHotkeys(getWindow)

    const data = loadData()
    applySettings(data)
    updateTrayTooltip(data)
    checkDueTasks(data, getWindow)
    reminderTimer = scheduleReminders(loadData, getWindow)
    void maybeCheckUpdates(data)

    app.on('activate', () => showMainWindow())
  })

  app.on('will-quit', () => unregisterHotkeys())
}