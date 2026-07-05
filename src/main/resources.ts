import { app } from 'electron'
import { join } from 'path'

export function getResourcesDirectory(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources')
  }

  return join(app.getAppPath(), 'resources')
}

export function getIconPath(): string {
  return join(getResourcesDirectory(), 'icon.png')
}

export function getTrayIconPath(): string {
  return join(getResourcesDirectory(), 'tray.png')
}