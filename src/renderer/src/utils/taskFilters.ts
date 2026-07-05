import type { DataPayload, QuickFilter, Task } from '../../../shared/schema'
import { todayKey } from '../store/useAppStore'

export function applyQuickFilter(tasks: Task[], filter: QuickFilter): Task[] {
  if (filter === 'none' || filter === 'archived') return tasks

  const today = todayKey()

  switch (filter) {
    case 'overdue':
      return tasks.filter((task) => task.status === 'todo' && task.dueDate !== null && task.dueDate < today)
    case 'no-due':
      return tasks.filter((task) => task.dueDate === null)
    case 'no-project':
      return tasks.filter((task) => task.projectId === null)
    case 'important':
      return tasks.filter((task) => task.priority === 'important')
    default:
      return tasks
  }
}

export function sortTasksWithPins(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return a.sortOrder - b.sortOrder
  })
}

export function isTaskBlocked(data: DataPayload, taskId: string): boolean {
  const task = data.tasks.find((item) => item.id === taskId)
  if (!task?.dependsOnTaskId) return false

  const dependency = data.tasks.find((item) => item.id === task.dependsOnTaskId)
  return !dependency || dependency.status !== 'done'
}

export function canCompleteTask(data: DataPayload, taskId: string): boolean {
  return !isTaskBlocked(data, taskId)
}