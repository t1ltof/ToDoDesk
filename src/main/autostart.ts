import { app } from 'electron'
import type { Settings } from '../shared/schema'

export function applyAutostart(settings: Settings): void {
  app.setLoginItemSettings({
    openAtLogin: settings.autostart,
    openAsHidden: settings.startMinimized,
    path: process.execPath,
    args: settings.startMinimized ? ['--hidden'] : []
  })
}