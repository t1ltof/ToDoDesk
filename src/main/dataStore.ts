import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, copyFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import {
  createEmptyData,
  dataFileSchema,
  migratePayload,
  type DataFile,
  type DataPayload,
  FORMAT_VERSION
} from '../shared/schema'
import { getBackupFilePath, getBackupsDirectory, getDataDirectory, getDataFilePath } from './paths'
import { validateImportFile } from './importValidator'
import type { ImportPreview } from '../shared/import'

const APP_VERSION = '0.5.0'

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
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    copyFileSync(dataPath, join(getBackupsDirectory(), `${stamp}.tododesk`))
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
    const parsed = dataFileSchema.parse({
      ...raw,
      data: migratePayload((raw as DataFile).data)
    })
    return parsed.data
  } catch {
    const backupPath = getBackupFilePath()
    if (existsSync(backupPath)) {
      try {
        const raw = JSON.parse(readFileSync(backupPath, 'utf-8'))
        const parsed = dataFileSchema.parse({
          ...raw,
          data: migratePayload((raw as DataFile).data)
        })
        return parsed.data
      } catch {
        // fall through
      }
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

export function peekImportFile(sourcePath: string): ImportPreview {
  return validateImportFile(sourcePath)
}

export function importFromPath(sourcePath: string, mode: 'replace' | 'new-project'): DataPayload {
  const validation = validateImportFile(sourcePath)
  if (!validation.valid) throw new Error(validation.errors.join('; '))

  if (mode === 'replace') return importReplace(sourcePath)
  return importAsNewProject(sourcePath)
}

export function importReplace(sourcePath: string): DataPayload {
  const raw = JSON.parse(readFileSync(sourcePath, 'utf-8'))
  const parsed = dataFileSchema.parse({
    ...raw,
    data: migratePayload((raw as DataFile).data)
  })
  writeAtomic(parsed)
  return parsed.data
}

export function importAsNewProject(sourcePath: string): DataPayload {
  const current = loadData()
  const raw = JSON.parse(readFileSync(sourcePath, 'utf-8'))
  const parsed = dataFileSchema.parse({
    ...raw,
    data: migratePayload((raw as DataFile).data)
  })

  const projectId = randomUUID()
  const now = new Date().toISOString()
  const dateLabel = new Date().toLocaleDateString('ru-RU')
  const idMap = new Map<string, string>()

  for (const task of parsed.data.tasks) idMap.set(task.id, randomUUID())
  for (const tag of parsed.data.tags) idMap.set(tag.id, randomUUID())
  for (const item of parsed.data.checklistItems) idMap.set(item.id, randomUUID())
  for (const item of parsed.data.reminders) idMap.set(item.id, randomUUID())
  for (const tpl of parsed.data.templates) idMap.set(tpl.id, randomUUID())

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

  const importedTemplates = parsed.data.templates.map((tpl) => ({
    ...tpl,
    id: idMap.get(tpl.id)!,
    projectId: tpl.projectId ? projectId : null,
    tagIds: tpl.tagIds.map((id) => idMap.get(id) ?? id)
  }))

  const merged: DataPayload = {
    projects: [...current.projects, newProject],
    tags: [...current.tags, ...importedTags],
    tasks: [...current.tasks, ...importedTasks],
    taskTags: [...current.taskTags, ...importedTaskTags],
    checklistItems: [...current.checklistItems, ...importedChecklist],
    reminders: [...current.reminders, ...importedReminders],
    templates: [...current.templates, ...importedTemplates],
    settings: current.settings
  }

  saveData(merged)
  return merged
}