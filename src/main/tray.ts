import { app, Menu, nativeImage, Tray, type BrowserWindow } from 'electron'
import type { DataPayload } from '../shared/schema'
import { getTrayIconPath } from './resources'

let tray: Tray | null = null

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function countTodayTasks(data: DataPayload): number {
  const today = todayKey()
  return data.tasks.filter(
    (task) => task.status === 'todo' && task.dueDate !== null && task.dueDate <= today
  ).length
}

function loadTrayIcon(): Electron.NativeImage {
  const iconPath = getTrayIconPath()
  const image = nativeImage.createFromPath(iconPath)
  if (!image.isEmpty()) return image.resize({ width: 16, height: 16 })
  return nativeImage.createEmpty()
}

export function updateTrayTooltip(data: DataPayload): void {
  if (!tray) return
  const count = countTodayTasks(data)
  const label = count > 0 ? `ToDoDesk — ${count} на сегодня` : 'ToDoDesk'
  tray.setToolTip(label)
}

export function createTray(
  getWindow: () => BrowserWindow | null,
  getData: () => DataPayload,
  onQuit: () => void
): Tray {
  tray = new Tray(loadTrayIcon())
  updateTrayTooltip(getData())

  const showWindow = (): void => {
    const window = getWindow()
    if (!window) return
    if (!window.isVisible()) window.show()
    if (window.isMinimized()) window.restore()
    window.focus()
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Открыть ToDoDesk',
      click: () => showWindow()
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => onQuit()
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => showWindow())

  return tray
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}