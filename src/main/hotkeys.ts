import { globalShortcut, type BrowserWindow } from 'electron'

const QUICK_ADD_HOTKEY = 'CommandOrControl+Shift+T'

export function registerHotkeys(getWindow: () => BrowserWindow | null): void {
  const showAndQuickAdd = (): void => {
    const window = getWindow()
    if (!window) return

    if (!window.isVisible()) window.show()
    if (window.isMinimized()) window.restore()
    window.focus()
    window.webContents.send('app:quick-add')
  }

  if (!globalShortcut.register(QUICK_ADD_HOTKEY, showAndQuickAdd)) {
    console.warn(`Не удалось зарегистрировать хоткей ${QUICK_ADD_HOTKEY}`)
  }
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll()
}