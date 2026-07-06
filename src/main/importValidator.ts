import { dataFileSchema, migratePayload } from '../shared/schema'
import type { ImportPreview } from '../shared/import'
import { readDataFileContent } from './dataFileIO'

export function validateImportFile(sourcePath: string): ImportPreview {
  const base: ImportPreview = {
    filePath: sourcePath,
    exportedAt: '',
    projectCount: 0,
    taskCount: 0,
    doneCount: 0,
    tagCount: 0,
    templateCount: 0,
    valid: false,
    errors: [],
    warnings: []
  }

  let raw: unknown
  try {
    raw = JSON.parse(readDataFileContent(sourcePath))
  } catch {
    return { ...base, errors: ['Файл не является корректным JSON'] }
  }

  if (!raw || typeof raw !== 'object') {
    return { ...base, errors: ['Файл пуст или имеет неверную структуру'] }
  }

  const file = raw as Record<string, unknown>

  if (file.format !== 'tododesk-backup') {
    base.errors.push(`Неверный формат файла: ожидается "tododesk-backup", получено "${String(file.format)}"`)
  }

  if (!file.data || typeof file.data !== 'object') {
    base.errors.push('Отсутствует раздел data с данными')
    return base
  }

  const data = file.data as Record<string, unknown>

  for (const key of [
    'projects',
    'tags',
    'tasks',
    'taskTags',
    'checklistItems',
    'reminders',
    'boardNodes',
    'boardLinks',
    'boardGroups',
    'notes',
    'projectTemplates',
    'activityLogs',
    'weeklyGoals',
    'taskAttachments',
    'sprints',
    'boardSnapshots',
    'smartRules',
    'drafts',
    'boardHistory'
  ]) {
    if (!(key in data)) base.warnings.push(`Отсутствует поле "${key}" — будет создано пустым`)
    else if (!Array.isArray(data[key])) base.errors.push(`Поле "${key}" должно быть массивом`)
  }

  const tasks = Array.isArray(data.tasks) ? (data.tasks as Array<Record<string, unknown>>) : []
  const taskIds = new Set<string>()

  for (const [index, task] of tasks.entries()) {
    if (!task.id) base.errors.push(`Задача #${index + 1}: отсутствует id`)
    else if (taskIds.has(String(task.id))) base.errors.push(`Задача #${index + 1}: дублирующийся id ${task.id}`)
    else taskIds.add(String(task.id))

    if (!task.title) base.errors.push(`Задача #${index + 1}: отсутствует название`)

    if (task.parentId && !taskIds.has(String(task.parentId)) && tasks.every((t) => t.id !== task.parentId)) {
      base.warnings.push(`Задача "${task.title}": parent_id ${task.parentId} не найден в файле`)
    }
  }

  try {
    const parsed = dataFileSchema.parse({
      format: 'tododesk-backup',
      version: String(file.version ?? '1.0'),
      exportedAt: String(file.exportedAt ?? new Date().toISOString()),
      appVersion: String(file.appVersion ?? 'unknown'),
      data: migratePayload(data)
    })

    base.exportedAt = parsed.exportedAt
    base.projectCount = parsed.data.projects.length
    base.taskCount = parsed.data.tasks.length
    base.doneCount = parsed.data.tasks.filter((t) => t.status === 'done').length
    base.tagCount = parsed.data.tags.length
    base.templateCount = parsed.data.templates.length
    base.valid = base.errors.length === 0

    if (file.version && !['1.0', '1.1', '1.2', '1.3', '1.4'].includes(String(file.version))) {
      base.warnings.push(`Версия формата ${file.version} — данные будут мигрированы`)
    }
  } catch (error) {
    base.errors.push(`Ошибка схемы: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`)
  }

  return base
}