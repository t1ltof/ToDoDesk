import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import {
  createEmptyData,
  dataFileSchema,
  type DataFile,
  type DataPayload,
  FORMAT_VERSION
} from '../shared/schema'
import { getBackupFilePath, getBackupsDirectory, getDataDirectory, getDataFilePath } from './paths'

const APP_VERSION = '0.1.0'

function ensureDataDirectory(): void {
  mkdirSync(getDataDirectory(), { recursive: true })
  mkdirSync(getBackupsDirectory(), { recursive: true })
}

function buildDataFile(data: DataPayload): DataFile {
  return {
    format: 'tododesk-backup',
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    data
  }
}

function writeAtomic(file: DataFile): void {
  ensureDataDirectory()
  const dataPath = getDataFilePath()
  const tempPath = `${dataPath}.tmp`

  if (existsSync(dataPath)) {
    writeFileSync(getBackupFilePath(), readFileSync(dataPath))
  }

  writeFileSync(tempPath, JSON.stringify(file, null, 2), 'utf-8')
  renameSync(tempPath, dataPath)
}

export function loadData(): DataPayload {
  ensureDataDirectory()
  const dataPath = getDataFilePath()

  if (!existsSync(dataPath)) {
    const empty = buildDataFile(createEmptyData())
    writeAtomic(empty)
    return empty.data
  }

  try {
    const raw = JSON.parse(readFileSync(dataPath, 'utf-8'))
    const parsed = dataFileSchema.parse(raw)
    return parsed.data
  } catch {
    const backupPath = getBackupFilePath()
    if (existsSync(backupPath)) {
      const raw = JSON.parse(readFileSync(backupPath, 'utf-8'))
      const parsed = dataFileSchema.parse(raw)
      return parsed.data
    }

    const empty = buildDataFile(createEmptyData())
    writeAtomic(empty)
    return empty.data
  }
}

export function saveData(data: DataPayload): void {
  writeAtomic(buildDataFile(data))
}

export function exportToFile(targetPath: string): DataPayload {
  const data = loadData()
  writeFileSync(targetPath, JSON.stringify(buildDataFile(data), null, 2), 'utf-8')
  return data
}

import type { ImportPreview } from '../shared/import'

export function peekImportFile(sourcePath: string): ImportPreview {
  const raw = JSON.parse(readFileSync(sourcePath, 'utf-8'))
  const parsed = dataFileSchema.parse(raw)

  return {
    filePath: sourcePath,
    exportedAt: parsed.exportedAt,
    projectCount: parsed.data.projects.length,
    taskCount: parsed.data.tasks.length,
    doneCount: parsed.data.tasks.filter((task) => task.status === 'done').length,
    tagCount: parsed.data.tags.length
  }
}

export function importFromPath(sourcePath: string, mode: 'replace' | 'new-project'): DataPayload {
  if (mode === 'replace') return importReplace(sourcePath)
  return importAsNewProject(sourcePath)
}

export function importReplace(sourcePath: string): DataPayload {
  const raw = JSON.parse(readFileSync(sourcePath, 'utf-8'))
  const parsed = dataFileSchema.parse(raw)
  writeAtomic(parsed)
  return parsed.data
}

export function importAsNewProject(sourcePath: string): DataPayload {
  const current = loadData()
  const raw = JSON.parse(readFileSync(sourcePath, 'utf-8'))
  const parsed = dataFileSchema.parse(raw)

  const projectId = randomUUID()
  const now = new Date().toISOString()
  const dateLabel = new Date().toLocaleDateString('ru-RU')
  const idMap = new Map<string, string>()

  for (const task of parsed.data.tasks) idMap.set(task.id, randomUUID())
  for (const tag of parsed.data.tags) idMap.set(tag.id, randomUUID())
  for (const item of parsed.data.checklistItems) idMap.set(item.id, randomUUID())
  for (const item of parsed.data.reminders) idMap.set(item.id, randomUUID())

  const newProject = {
    id: projectId,
    name: `Импорт ${dateLabel}`,
    color: '#3b82f6',
    sortOrder: current.projects.length,
    archived: false
  }

  const importedTasks = parsed.data.tasks.map((task) => ({
    ...task,
    id: idMap.get(task.id)!,
    projectId,
    parentId: task.parentId ? idMap.get(task.parentId) ?? null : null,
    createdAt: now,
    updatedAt: now
  }))

  const importedChecklist = parsed.data.checklistItems.map((item) => ({
    ...item,
    id: idMap.get(item.id)!,
    taskId: idMap.get(item.taskId)!
  }))

  const importedReminders = parsed.data.reminders.map((item) => ({
    ...item,
    id: idMap.get(item.id)!,
    taskId: idMap.get(item.taskId)!
  }))

  const importedTags = parsed.data.tags.map((tag) => ({
    ...tag,
    id: idMap.get(tag.id)!
  }))

  const importedTaskTags = parsed.data.taskTags.map((link) => ({
    taskId: idMap.get(link.taskId)!,
    tagId: idMap.get(link.tagId)!
  }))

  const merged: DataPayload = {
    projects: [...current.projects, newProject],
    tags: [...current.tags, ...importedTags],
    tasks: [...current.tasks, ...importedTasks],
    taskTags: [...current.taskTags, ...importedTaskTags],
    checklistItems: [...current.checklistItems, ...importedChecklist],
    reminders: [...current.reminders, ...importedReminders]
  }

  saveData(merged)
  return merged
}