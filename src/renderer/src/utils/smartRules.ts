import { v4 as uuidv4 } from 'uuid'
import type { DataPayload } from '../../../shared/schema'
import { todayKey } from './calendarUtils'
import { createTag } from './taskHelpers'

function overdueDays(dueDate: string): number {
  const today = todayKey()
  if (dueDate >= today) return 0
  const due = new Date(`${dueDate}T12:00:00`).getTime()
  const now = new Date(`${today}T12:00:00`).getTime()
  return Math.floor((now - due) / 86_400_000)
}

export function applySmartRules(data: DataPayload): DataPayload {
  const today = todayKey()
  let next: DataPayload = { ...data, tasks: [...data.tasks] }

  for (const rule of data.smartRules) {
    if (!rule.enabled || rule.condition !== 'overdue_days') continue

    for (const task of next.tasks) {
      if (task.status !== 'todo' || !task.dueDate || task.dueDate >= today) continue
      if (overdueDays(task.dueDate) < rule.days) continue

      if (rule.action === 'move_inbox' && task.projectId !== null) {
        next = {
          ...next,
          tasks: next.tasks.map((item) =>
            item.id === task.id ? { ...item, projectId: null, updatedAt: new Date().toISOString() } : item
          )
        }
      }

      if (rule.action === 'add_tag' && rule.tagId) {
        const exists = next.taskTags.some(
          (link) => link.taskId === task.id && link.tagId === rule.tagId
        )
        if (!exists) {
          next = {
            ...next,
            taskTags: [...next.taskTags, { taskId: task.id, tagId: rule.tagId! }]
          }
        }
      }
    }
  }

  return next
}

export function ensureOverdueSmartRule(data: DataPayload): DataPayload {
  if (data.smartRules.length > 0) return data

  let next = createTag(data, 'просрочено')
  const tag = next.tags.find((item) => item.name.toLowerCase() === 'просрочено')

  return {
    ...next,
    smartRules: [
      {
        id: uuidv4(),
        name: 'Просроченные во входящие',
        enabled: false,
        condition: 'overdue_days',
        days: 7,
        action: 'move_inbox'
      },
      ...(tag
        ? [
            {
              id: uuidv4(),
              name: 'Метка просроченных',
              enabled: false,
              condition: 'overdue_days' as const,
              days: 3,
              action: 'add_tag' as const,
              tagId: tag.id
            }
          ]
        : [])
    ]
  }
}