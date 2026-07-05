import { v4 as uuidv4 } from 'uuid'
import type { DataPayload, Recurrence, Task } from '../../../shared/schema'
import { syncReminder } from './taskHelpers'

export function nextDueDate(dueDate: string, recurrence: Recurrence): string {
  const date = new Date(`${dueDate}T12:00:00`)
  if (recurrence === 'daily') date.setDate(date.getDate() + 1)
  if (recurrence === 'weekly') date.setDate(date.getDate() + 7)
  if (recurrence === 'monthly') date.setMonth(date.getMonth() + 1)
  return date.toISOString().slice(0, 10)
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
    const newDue = nextDueDate(task.dueDate, task.recurrence)
    const newTask: Task = {
      id: uuidv4(),
      projectId: task.projectId,
      parentId: task.parentId,
      title: task.title,
      description: task.description,
      status: 'todo',
      priority: task.priority,
      dueDate: newDue,
      completedAt: null,
      recurrence: task.recurrence,
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