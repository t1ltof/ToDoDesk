import { mkdirSync } from 'fs'
import { join } from 'path'
import type { DataPayload } from '../shared/schema'
import { exportCsvToFile, exportToFile, loadData, saveData } from './dataStore'

let exportTimer: NodeJS.Timeout | null = null

function todayDateKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function runScheduledExportIfDue(): boolean {
  const data = loadData()
  const exportDir = data.settings.scheduledExportPath?.trim()
  if (!data.settings.scheduledExportEnabled || !exportDir) return false

  const now = new Date()
  if (now.getHours() !== data.settings.scheduledExportHour) return false

  const today = todayDateKey()
  if (data.settings.scheduledExportLastRunDate === today) return false

  try {
    mkdirSync(exportDir, { recursive: true })
    const format = data.settings.scheduledExportFormat

    if (format === 'tododesk' || format === 'both') {
      exportToFile(join(exportDir, `tododesk-${today}.tododesk`))
    }
    if (format === 'csv' || format === 'both') {
      exportCsvToFile(join(exportDir, `tododesk-tasks-${today}.csv`))
    }

    const current = loadData()
    saveData({
      ...current,
      settings: { ...current.settings, scheduledExportLastRunDate: today }
    })
    return true
  } catch {
    return false
  }
}

export function startScheduledExportTimer(): void {
  stopScheduledExportTimer()
  exportTimer = setInterval(() => {
    runScheduledExportIfDue()
  }, 60_000)
}

export function stopScheduledExportTimer(): void {
  if (exportTimer) clearInterval(exportTimer)
  exportTimer = null
}

export function getScheduledExportSummary(data: DataPayload): string {
  if (!data.settings.scheduledExportEnabled) return 'Отключён'
  const hour = String(data.settings.scheduledExportHour).padStart(2, '0')
  const path = data.settings.scheduledExportPath ?? 'папка не указана'
  const last = data.settings.scheduledExportLastRunDate
  return `Ежедневно в ${hour}:00 → ${path}${last ? ` (последний: ${last})` : ''}`
}