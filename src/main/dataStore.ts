import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  existsSync,
  copyFileSync,
  readdirSync,
  unlinkSync,
  statSync
} from 'fs'
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
import { encrypt, getDataPassword } from './encryption'
import { readDataFileContent } from './dataFileIO'
import { markSyncWrite } from './syncWatcher'
import type { BoardLink, BoardNode } from '../shared/schema'

const APP_VERSION = '0.8.1'

export class DataLoadError extends Error {
  readonly needsPassword: boolean

  constructor(message: string, needsPassword = false) {
    super(message)
    this.name = 'DataLoadError'
    this.needsPassword = needsPassword
  }
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildTasksCsv(data: DataPayload): string {
  const projectMap = new Map(data.projects.map((p) => [p.id, p.name]))
  const tagMap = new Map(data.tags.map((t) => [t.id, t.name]))
  const header = 'title,status,dueDate,project,tags,priority'
  const lines = data.tasks.map((task) => {
    const project = task.projectId ? (projectMap.get(task.projectId) ?? '') : ''
    const tags = data.taskTags
      .filter((link) => link.taskId === task.id)
      .map((link) => tagMap.get(link.tagId) ?? '')
      .filter(Boolean)
      .join('; ')
    return [task.title, task.status, task.dueDate ?? '', project, tags, task.priority]
      .map(escapeCsvField)
      .join(',')
  })
  return [header, ...lines].join('\r\n')
}

export function exportCsvToFile(targetPath: string): { path: string; rowCount: number } {
  const data = loadData()
  const csv = buildTasksCsv(data)
  writeFileSync(targetPath, csv, 'utf-8')
  return { path: targetPath, rowCount: data.tasks.length }
}

export interface ExportReport {
  exportedAt: string
  appVersion: string
  formatVersion: string
  projectCount: number
  taskCount: number
  doneCount: number
  tagCount: number
  templateCount: number
  projectTemplateCount: number
  noteCount: number
  boardNodeCount: number
  activityLogCount: number
}

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

function pruneBackups(maxVersions: number): void {
  const dir = getBackupsDirectory()
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.tododesk'))
    .map((f) => ({ name: f, path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)

  if (files.length <= maxVersions) return

  for (const file of files.slice(maxVersions)) {
    try {
      unlinkSync(file.path)
    } catch {
      // ignore
    }
  }
}

function writeAtomic(file: DataFile, data: DataPayload): void {
  ensureDataDirectory()
  const dataPath = getDataFilePath()
  const tempPath = `${dataPath}.tmp`
  const content = JSON.stringify(file, null, 2)

  if (existsSync(dataPath)) {
    writeFileSync(getBackupFilePath(), readFileSync(dataPath))
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    copyFileSync(dataPath, join(getBackupsDirectory(), `${stamp}.tododesk`))
    pruneBackups(data.settings.autoBackupEnabled ? data.settings.autoBackupMaxVersions : 10)
  }

  if (data.settings.dataPasswordEnabled && !getDataPassword()) {
    throw new Error('Пароль не задан — невозможно сохранить зашифрованные данные')
  }

  const toWrite =
    data.settings.dataPasswordEnabled && getDataPassword()
      ? encrypt(content, getDataPassword()!)
      : content

  writeFileSync(tempPath, toWrite, 'utf-8')
  renameSync(tempPath, dataPath)
  markSyncWrite()
}

function parseDataFile(rawText: string): DataPayload {
  const raw = JSON.parse(rawText)
  const parsed = dataFileSchema.parse({
    ...raw,
    data: migratePayload((raw as DataFile).data)
  })
  return parsed.data
}

export function loadFromExternalPath(sourcePath: string): DataPayload {
  return parseDataFile(readDataFileContent(sourcePath))
}

function loadDataFromPath(dataPath: string): DataPayload {
  return parseDataFile(readDataFileContent(dataPath))
}

function isPasswordError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('парол') || error.message.includes('зашифрован'))
  )
}

export function loadData(): DataPayload {
  ensureDataDirectory()
  const dataPath = getDataFilePath()

  if (!existsSync(dataPath)) {
    const empty = buildDataFile(createEmptyData())
    writeAtomic(empty, empty.data)
    return empty.data
  }

  try {
    return loadDataFromPath(dataPath)
  } catch (primaryError) {
    const backupPath = getBackupFilePath()
    if (existsSync(backupPath)) {
      try {
        return loadDataFromPath(backupPath)
      } catch {
        // fall through
      }
    }

    const message =
      primaryError instanceof Error ? primaryError.message : 'Не удалось загрузить данные'
    throw new DataLoadError(message, isPasswordError(primaryError))
  }
}

export function saveData(data: DataPayload): void {
  writeAtomic(buildDataFile(data), data)
}

export function buildExportReport(data: DataPayload): ExportReport {
  return {
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    formatVersion: FORMAT_VERSION,
    projectCount: data.projects.length,
    taskCount: data.tasks.length,
    doneCount: data.tasks.filter((t) => t.status === 'done').length,
    tagCount: data.tags.length,
    templateCount: data.templates.length,
    projectTemplateCount: data.projectTemplates.length,
    noteCount: data.notes.length,
    boardNodeCount: data.boardNodes.length,
    activityLogCount: data.activityLogs.length
  }
}

export function exportToFile(targetPath: string, mergeWithCurrent = false): { data: DataPayload; report: ExportReport } {
  const data = loadData()
  let exportData = data

  if (mergeWithCurrent && existsSync(targetPath)) {
    try {
      const validation = validateImportFile(targetPath)
      if (validation.valid) {
        const raw = JSON.parse(readDataFileContent(targetPath)) as DataFile
        const parsed = dataFileSchema.parse({
          ...raw,
          data: migratePayload(raw.data)
        })
        exportData = mergePayloads(data, parsed.data)
      }
    } catch {
      // export current only
    }
  }

  writeFileSync(targetPath, JSON.stringify(buildDataFile(exportData), null, 2), 'utf-8')
  return { data: exportData, report: buildExportReport(exportData) }
}

export function peekImportFile(sourcePath: string): ImportPreview {
  return validateImportFile(sourcePath)
}

export type ImportMode = 'replace' | 'new-project' | 'merge'

export function importFromPath(sourcePath: string, mode: ImportMode): DataPayload {
  const validation = validateImportFile(sourcePath)
  if (!validation.valid) throw new Error(validation.errors.join('; '))

  if (mode === 'replace') return importReplace(sourcePath)
  if (mode === 'merge') return importMerge(sourcePath)
  return importAsNewProject(sourcePath)
}

function parseImportFile(sourcePath: string): DataFile {
  const raw = JSON.parse(readDataFileContent(sourcePath)) as DataFile
  return dataFileSchema.parse({
    ...raw,
    data: migratePayload(raw.data)
  })
}

export function importReplace(sourcePath: string): DataPayload {
  const parsed = parseImportFile(sourcePath)
  writeAtomic(parsed, parsed.data)
  return parsed.data
}

function collectExistingIds(data: DataPayload): Set<string> {
  const ids = new Set<string>()
  for (const p of data.projects) ids.add(p.id)
  for (const t of data.tags) ids.add(t.id)
  for (const t of data.tasks) ids.add(t.id)
  for (const c of data.checklistItems) ids.add(c.id)
  for (const r of data.reminders) ids.add(r.id)
  for (const t of data.templates) ids.add(t.id)
  for (const t of data.projectTemplates) ids.add(t.id)
  for (const n of data.notes) ids.add(n.id)
  for (const l of data.activityLogs) ids.add(l.id)
  for (const g of data.weeklyGoals) ids.add(g.id)
  for (const n of data.boardNodes) ids.add(n.id)
  for (const l of data.boardLinks) ids.add(l.id)
  for (const g of data.boardGroups) ids.add(g.id)
  for (const a of data.taskAttachments) ids.add(a.id)
  for (const s of data.sprints) ids.add(s.id)
  for (const s of data.boardSnapshots) ids.add(s.id)
  for (const r of data.smartRules) ids.add(r.id)
  for (const h of data.boardHistory) ids.add(h.id)
  return ids
}

function remapBoardNodes(
  nodes: BoardNode[],
  mapId: (id: string | null) => string | null
): BoardNode[] {
  return nodes.map((node) => ({
    ...node,
    id: mapId(node.id)!,
    taskId: mapId(node.taskId),
    groupId: mapId(node.groupId)
  }))
}

function remapBoardLinks(
  links: BoardLink[],
  mapId: (id: string | null) => string | null
): BoardLink[] {
  return links.map((link) => ({
    ...link,
    id: mapId(link.id)!,
    fromNodeId: mapId(link.fromNodeId)!,
    toNodeId: mapId(link.toNodeId)!
  }))
}

function ensureId(id: string, idMap: Map<string, string>, existing: Set<string>): string {
  if (idMap.has(id)) return idMap.get(id)!
  if (!existing.has(id)) return id
  const newId = randomUUID()
  idMap.set(id, newId)
  return newId
}

function remapImportedPayload(
  imported: DataPayload,
  idMap: Map<string, string>,
  existing: Set<string>,
  projectIdOverride?: string
): DataPayload {
  for (const item of imported.projects) ensureId(item.id, idMap, existing)
  for (const item of imported.tags) ensureId(item.id, idMap, existing)
  for (const item of imported.tasks) ensureId(item.id, idMap, existing)
  for (const item of imported.checklistItems) ensureId(item.id, idMap, existing)
  for (const item of imported.reminders) ensureId(item.id, idMap, existing)
  for (const item of imported.templates) ensureId(item.id, idMap, existing)
  for (const item of imported.projectTemplates) ensureId(item.id, idMap, existing)
  for (const item of imported.notes) ensureId(item.id, idMap, existing)
  for (const item of imported.activityLogs) ensureId(item.id, idMap, existing)
  for (const item of imported.weeklyGoals) ensureId(item.id, idMap, existing)
  for (const item of imported.boardNodes) ensureId(item.id, idMap, existing)
  for (const item of imported.boardLinks) ensureId(item.id, idMap, existing)
  for (const item of imported.boardGroups) ensureId(item.id, idMap, existing)
  for (const item of imported.taskAttachments) ensureId(item.id, idMap, existing)
  for (const item of imported.sprints) ensureId(item.id, idMap, existing)
  for (const item of imported.boardSnapshots) ensureId(item.id, idMap, existing)
  for (const item of imported.smartRules) ensureId(item.id, idMap, existing)
  for (const item of imported.boardHistory) ensureId(item.id, idMap, existing)

  const mapId = (id: string | null): string | null => {
    if (!id) return null
    return idMap.get(id) ?? id
  }

  return {
    projects: imported.projects.map((p) => ({
      ...p,
      id: mapId(p.id)!,
      sortOrder: p.sortOrder
    })),
    tags: imported.tags.map((t) => ({ ...t, id: mapId(t.id)! })),
    tasks: imported.tasks.map((t) => ({
      ...t,
      id: mapId(t.id)!,
      projectId: projectIdOverride ?? mapId(t.projectId),
      parentId: mapId(t.parentId),
      dependsOnTaskId: mapId(t.dependsOnTaskId)
    })),
    taskTags: imported.taskTags.map((l) => ({
      taskId: mapId(l.taskId)!,
      tagId: mapId(l.tagId)!
    })),
    checklistItems: imported.checklistItems.map((c) => ({
      ...c,
      id: mapId(c.id)!,
      taskId: mapId(c.taskId)!
    })),
    reminders: imported.reminders.map((r) => ({
      ...r,
      id: mapId(r.id)!,
      taskId: mapId(r.taskId)!
    })),
    templates: imported.templates.map((t) => ({
      ...t,
      id: mapId(t.id)!,
      projectId: mapId(t.projectId),
      tagIds: t.tagIds.map((id) => mapId(id) ?? id)
    })),
    projectTemplates: imported.projectTemplates.map((t) => ({
      ...t,
      id: mapId(t.id)!
    })),
    notes: imported.notes.map((n) => ({
      ...n,
      id: mapId(n.id)!
    })),
    activityLogs: imported.activityLogs.map((l) => ({
      ...l,
      id: mapId(l.id)!,
      entityId: mapId(l.entityId)
    })),
    weeklyGoals: imported.weeklyGoals.map((g) => ({
      ...g,
      id: mapId(g.id)!
    })),
    boardNodes: imported.boardNodes.map((n) => ({
      ...n,
      id: mapId(n.id)!,
      taskId: mapId(n.taskId),
      groupId: mapId(n.groupId)
    })),
    boardLinks: imported.boardLinks.map((l) => ({
      ...l,
      id: mapId(l.id)!,
      fromNodeId: mapId(l.fromNodeId)!,
      toNodeId: mapId(l.toNodeId)!
    })),
    boardGroups: imported.boardGroups.map((g) => ({
      ...g,
      id: mapId(g.id)!
    })),
    taskAttachments: imported.taskAttachments.map((attachment) => ({
      ...attachment,
      id: mapId(attachment.id)!,
      taskId: mapId(attachment.taskId)!
    })),
    sprints: imported.sprints.map((sprint) => ({
      ...sprint,
      id: mapId(sprint.id)!,
      taskIds: sprint.taskIds.map((id) => mapId(id) ?? id)
    })),
    boardSnapshots: imported.boardSnapshots.map((snapshot) => ({
      ...snapshot,
      id: mapId(snapshot.id)!,
      nodes: remapBoardNodes(snapshot.nodes, mapId),
      links: remapBoardLinks(snapshot.links, mapId)
    })),
    smartRules: imported.smartRules.map((rule) => ({
      ...rule,
      id: mapId(rule.id)!,
      tagId: rule.tagId ? (mapId(rule.tagId) ?? undefined) : undefined
    })),
    drafts: imported.drafts.map((draft) => ({
      ...draft,
      entityId: mapId(draft.entityId)!
    })),
    boardHistory: imported.boardHistory.map((entry) => ({
      ...entry,
      id: mapId(entry.id)!,
      nodes: remapBoardNodes(entry.nodes, mapId),
      links: remapBoardLinks(entry.links, mapId)
    })),
    settings: imported.settings
  }
}

function dedupeByName<T extends { id: string; name: string }>(
  current: T[],
  imported: T[],
  idMap: Map<string, string>
): T[] {
  const nameToId = new Map(current.map((item) => [item.name.toLowerCase(), item.id]))
  const result = [...current]

  for (const item of imported) {
    const existingId = nameToId.get(item.name.toLowerCase())
    if (existingId) {
      idMap.set(item.id, existingId)
    } else {
      const newId = idMap.get(item.id) ?? item.id
      nameToId.set(item.name.toLowerCase(), newId)
      result.push({ ...item, id: newId, sortOrder: result.length } as T)
    }
  }

  return result
}

export function mergePayloads(current: DataPayload, imported: DataPayload): DataPayload {
  const idMap = new Map<string, string>()
  const existing = collectExistingIds(current)

  const projectNameMap = new Map(current.projects.map((p) => [p.name.toLowerCase(), p.id]))
  for (const proj of imported.projects) {
    const existingId = projectNameMap.get(proj.name.toLowerCase())
    if (existingId) {
      idMap.set(proj.id, existingId)
    } else {
      const newId = ensureId(proj.id, idMap, existing)
      projectNameMap.set(proj.name.toLowerCase(), newId)
    }
  }

  const tagNameMap = new Map(current.tags.map((t) => [t.name.toLowerCase(), t.id]))
  for (const tag of imported.tags) {
    const existingId = tagNameMap.get(tag.name.toLowerCase())
    if (existingId) {
      idMap.set(tag.id, existingId)
    } else {
      ensureId(tag.id, idMap, existing)
    }
  }

  const remapped = remapImportedPayload(imported, idMap, existing)

  const mergedProjects = dedupeByName(current.projects, remapped.projects, idMap)
  const mergedTags = dedupeByName(current.tags, remapped.tags, idMap)

  const existingTaskIds = new Set(current.tasks.map((t) => t.id))
  const existingNoteIds = new Set(current.notes.map((n) => n.id))
  const existingBoardNodeIds = new Set(current.boardNodes.map((n) => n.id))

  const mapId = (id: string | null): string | null => {
    if (!id) return null
    return idMap.get(id) ?? id
  }

  return {
    projects: mergedProjects,
    tags: mergedTags,
    tasks: [
      ...current.tasks,
      ...remapped.tasks
        .filter((t) => !existingTaskIds.has(t.id))
        .map((t) => ({ ...t, projectId: mapId(t.projectId), parentId: mapId(t.parentId) }))
    ],
    taskTags: [
      ...current.taskTags,
      ...remapped.taskTags.filter(
        (l) =>
          !current.taskTags.some((c) => c.taskId === l.taskId && c.tagId === l.tagId)
      )
    ],
    checklistItems: [...current.checklistItems, ...remapped.checklistItems],
    reminders: [...current.reminders, ...remapped.reminders],
    templates: [...current.templates, ...remapped.templates],
    projectTemplates: [...current.projectTemplates, ...remapped.projectTemplates],
    notes: [
      ...current.notes,
      ...remapped.notes.filter((n) => !existingNoteIds.has(n.id))
    ],
    activityLogs: [...current.activityLogs, ...remapped.activityLogs].slice(-500),
    weeklyGoals: [...current.weeklyGoals, ...remapped.weeklyGoals],
    boardNodes: [
      ...current.boardNodes,
      ...remapped.boardNodes.filter((n) => !existingBoardNodeIds.has(n.id))
    ],
    boardLinks: [...current.boardLinks, ...remapped.boardLinks],
    boardGroups: [...current.boardGroups, ...remapped.boardGroups],
    taskAttachments: [
      ...current.taskAttachments,
      ...remapped.taskAttachments.filter(
        (attachment) =>
          !current.taskAttachments.some((existing) => existing.id === attachment.id)
      )
    ],
    sprints: [
      ...current.sprints,
      ...remapped.sprints.filter(
        (sprint) => !current.sprints.some((existing) => existing.id === sprint.id)
      )
    ],
    boardSnapshots: [
      ...current.boardSnapshots,
      ...remapped.boardSnapshots.filter(
        (snapshot) => !current.boardSnapshots.some((existing) => existing.id === snapshot.id)
      )
    ],
    smartRules: [
      ...current.smartRules,
      ...remapped.smartRules.filter(
        (rule) => !current.smartRules.some((existing) => existing.id === rule.id)
      )
    ],
    drafts: [
      ...current.drafts.filter(
        (draft) => !remapped.drafts.some((imported) => imported.entityId === draft.entityId)
      ),
      ...remapped.drafts
    ],
    boardHistory: [...current.boardHistory, ...remapped.boardHistory].slice(-20),
    settings: current.settings
  }
}

export function importMerge(sourcePath: string): DataPayload {
  const current = loadData()
  const parsed = parseImportFile(sourcePath)
  const merged = mergePayloads(current, parsed.data)
  saveData(merged)
  return merged
}

export function importAsNewProject(sourcePath: string): DataPayload {
  const current = loadData()
  const parsed = parseImportFile(sourcePath)

  const projectId = randomUUID()
  const now = new Date().toISOString()
  const dateLabel = new Date().toLocaleDateString('ru-RU')
  const idMap = new Map<string, string>()
  const existing = collectExistingIds(current)

  for (const task of parsed.data.tasks) ensureId(task.id, idMap, existing)
  for (const tag of parsed.data.tags) ensureId(tag.id, idMap, existing)
  for (const item of parsed.data.checklistItems) ensureId(item.id, idMap, existing)
  for (const item of parsed.data.reminders) ensureId(item.id, idMap, existing)
  for (const tpl of parsed.data.templates) ensureId(tpl.id, idMap, existing)
  for (const node of parsed.data.boardNodes) ensureId(node.id, idMap, existing)
  for (const link of parsed.data.boardLinks) ensureId(link.id, idMap, existing)
  for (const group of parsed.data.boardGroups) ensureId(group.id, idMap, existing)
  for (const attachment of parsed.data.taskAttachments) ensureId(attachment.id, idMap, existing)
  for (const sprint of parsed.data.sprints) ensureId(sprint.id, idMap, existing)
  for (const snapshot of parsed.data.boardSnapshots) ensureId(snapshot.id, idMap, existing)
  for (const rule of parsed.data.smartRules) ensureId(rule.id, idMap, existing)
  for (const entry of parsed.data.boardHistory) ensureId(entry.id, idMap, existing)

  const remapped = remapImportedPayload(parsed.data, idMap, existing, projectId)

  const newProject = {
    id: projectId,
    name: `Импорт ${dateLabel}`,
    color: '#3b82f6',
    icon: '',
    sortOrder: current.projects.length,
    archived: false
  }

  const importedTasks = remapped.tasks.map((task) => ({
    ...task,
    createdAt: now,
    updatedAt: now
  }))

  const merged: DataPayload = {
    projects: [...current.projects, newProject],
    tags: [...current.tags, ...remapped.tags],
    tasks: [...current.tasks, ...importedTasks],
    taskTags: [...current.taskTags, ...remapped.taskTags],
    checklistItems: [...current.checklistItems, ...remapped.checklistItems],
    reminders: [...current.reminders, ...remapped.reminders],
    templates: [...current.templates, ...remapped.templates],
    projectTemplates: [...current.projectTemplates, ...remapped.projectTemplates],
    notes: [...current.notes, ...remapped.notes],
    activityLogs: [...current.activityLogs, ...remapped.activityLogs].slice(-500),
    weeklyGoals: [...current.weeklyGoals, ...remapped.weeklyGoals],
    boardNodes: [...current.boardNodes, ...remapped.boardNodes],
    boardLinks: [...current.boardLinks, ...remapped.boardLinks],
    boardGroups: [...current.boardGroups, ...remapped.boardGroups],
    taskAttachments: [...current.taskAttachments, ...remapped.taskAttachments],
    sprints: [...current.sprints, ...remapped.sprints],
    boardSnapshots: [...current.boardSnapshots, ...remapped.boardSnapshots],
    smartRules: [...current.smartRules, ...remapped.smartRules],
    drafts: [...current.drafts, ...remapped.drafts],
    boardHistory: [...current.boardHistory, ...remapped.boardHistory].slice(-20),
    settings: current.settings
  }

  saveData(merged)
  return merged
}