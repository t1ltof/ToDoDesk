import { v4 as uuidv4 } from 'uuid'
import type { DataPayload, Recurrence, Task } from '../../../shared/schema'
import { localDateKey } from './calendarUtils'
import { syncReminder } from './taskHelpers'

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function advanceToNextWeekday(date: Date): void {
  do {
    date.setDate(date.getDate() + 1)
  } while (isWeekend(date))
}

function advanceToNextWeekend(date: Date): void {
  do {
    date.setDate(date.getDate() + 1)
  } while (!isWeekend(date))
}

function advanceDueDate(dueDate: string, recurrence: Recurrence): string {
  const date = new Date(`${dueDate}T12:00:00`)
  if (recurrence === 'daily') date.setDate(date.getDate() + 1)
  if (recurrence === 'weekly') date.setDate(date.getDate() + 7)
  if (recurrence === 'monthly') {
    const day = date.getDate()
    date.setMonth(date.getMonth() + 1)
    if (date.getDate() < day) date.setDate(0)
  }
  if (recurrence === 'weekdays') advanceToNextWeekday(date)
  if (recurrence === 'weekends') advanceToNextWeekend(date)
  return localDateKey(date)
}

export function nextDueDate(
  dueDate: string,
  recurrence: Recurrence,
  recurrenceExceptions: string[] = []
): string {
  const exceptions = new Set(recurrenceExceptions)
  let next = advanceDueDate(dueDate, recurrence)
  let guard = 0

  while (exceptions.has(next) && guard < 366) {
    next = advanceDueDate(next, recurrence)
    guard += 1
  }

  return next
}

export function completeTask(data: DataPayload, taskId: string): DataPayload {
  const now = new Date().toISOString()
  const task = data.tasks.find((item) => item.id === taskId)
  if (!task) return data

  const updatedTasks = data.tasks.map((item) =>
    item.id === taskId
      ? { ...item, status: 'done' as const, completedAt: now, updatedAt: now }
      : item
  )

  let next: DataPayload = { ...data, tasks: updatedTasks }

  if (task.recurrence !== 'none' && task.dueDate) {
    const newDue = nextDueDate(task.dueDate, task.recurrence, task.recurrenceExceptions)
    const newTask: Task = {
      id: uuidv4(),
      projectId: task.projectId,
      parentId: task.parentId,
      title: task.title,
      description: task.description,
      status: 'todo',
      priority: task.priority,
      dueDate: newDue,
      dueDateEnd: task.dueDateEnd,
      dueTime: task.dueTime,
      timeOfDay: task.timeOfDay,
      completedAt: null,
      recurrence: task.recurrence,
      recurrenceExceptions: task.recurrenceExceptions,
      dependsOnTaskId: task.dependsOnTaskId,
      pinned: task.pinned,
      archived: false,
      sortOrder: data.tasks.length,
      createdAt: now,
      updatedAt: now
    }

    const taskTags = data.taskTags.filter((link) => link.taskId === taskId)
    next = {
      ...next,
      tasks: [...next.tasks, newTask],
      taskTags: [
        ...next.taskTags,
        ...taskTags.map((link) => ({ taskId: newTask.id, tagId: link.tagId }))
      ]
    }
    next = syncReminder(next, newTask.id, newDue)
  }

  return next
}

export function reopenTask(data: DataPayload, taskId: string): DataPayload {
  const now = new Date().toISOString()
  return {
    ...data,
    tasks: data.tasks.map((item) =>
      item.id === taskId
        ? { ...item, status: 'todo', completedAt: null, updatedAt: now }
        : item
    )
  }
}