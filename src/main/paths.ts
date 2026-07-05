import { app } from 'electron'
import { join } from 'path'

export function getDataDirectory(): string {
  if (app.isPackaged) {
    return join(process.env.PORTABLE_EXECUTABLE_DIR ?? join(process.execPath, '..'))
  }

  return join(app.getAppPath(), 'data-dev')
}

export function getDataFilePath(): string {
  return join(getDataDirectory(), 'data.tododesk')
}

export function getBackupFilePath(): string {
  return join(getDataDirectory(), 'data.tododesk.bak')
}

export function getBackupsDirectory(): string {
  return join(getDataDirectory(), 'backups')
}

export function getAttachmentsDirectory(): string {
  return join(getDataDirectory(), 'attachments')
}