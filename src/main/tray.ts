import { app, Menu, Tray, type BrowserWindow } from 'electron'
import type { DataPayload } from '../shared/schema'
import { createTrayIconWithCount } from './trayBadge'

let tray: Tray | null = null
let getWindowRef: (() => BrowserWindow | null) | null = null
let onQuitRef: (() => void) | null = null

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function truncateTitle(title: string, max = 28): string {
  if (title.length <= max) return title
  return title.slice(0, max - 1) + '…'
}

export function countTodayTasks(data: DataPayload): number {
  const today = todayKey()
  return data.tasks.filter(
    (task) => task.status === 'todo' && task.dueDate !== null && task.dueDate <= today
  ).length
}

function getTodayTasks(data: DataPayload, limit = 8) {
  const today = todayKey()
  return data.tasks
    .filter((task) => task.status === 'todo' && task.dueDate !== null && task.dueDate <= today)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, limit)
}

function buildContextMenu(data: DataPayload): Menu {
  const showWindow = (): void => {
    const window = getWindowRef?.()
    if (!window) return
    if (!window.isVisible()) window.show()
    if (window.isMinimized()) window.restore()
    window.focus()
  }

  const openTask = (taskId: string): void => {
    showWindow()
    const window = getWindowRef?.()
    window?.webContents.send('app:open-task', taskId)
  }

  const todayTasks = getTodayTasks(data)
  const todaySubmenu: Electron.MenuItemConstructorOptions[] =
    todayTasks.length === 0
      ? [{ label: 'Нет задач на сегодня', enabled: false }]
      : todayTasks.map((task) => ({
          label: truncateTitle(task.title),
          click: () => openTask(task.id)
        }))

  return Menu.buildFromTemplate([
    { label: 'Открыть ToDoDesk', click: () => showWindow() },
    { type: 'separator' },
    {
      label: 'Сегодня',
      submenu: todaySubmenu
    },
    { type: 'separator' },
    { label: 'Выход', click: () => onQuitRef?.() }
  ])
}

export function updateTrayTooltip(data: DataPayload): void {
  if (!tray) return
  const count = countTodayTasks(data)
  const label = count > 0 ? `ToDoDesk — ${count} на сегодня` : 'ToDoDesk'
  tray.setToolTip(label)
  tray.setImage(createTrayIconWithCount(count))
  tray.setContextMenu(buildContextMenu(data))
}

export function createTray(
  getWindow: () => BrowserWindow | null,
  getData: () => DataPayload,
  onQuit: () => void
): Tray {
  getWindowRef = getWindow
  onQuitRef = onQuit

  const data = getData()
  const count = countTodayTasks(data)
  tray = new Tray(createTrayIconWithCount(count))
  updateTrayTooltip(data)

  tray.on('double-click', () => {
    const window = getWindow()
    if (!window) return
    if (!window.isVisible()) window.show()
    if (window.isMinimized()) window.restore()
    window.focus()
  })

  return tray
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
  getWindowRef = null
  onQuitRef = null
}