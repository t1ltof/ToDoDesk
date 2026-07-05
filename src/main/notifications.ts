import { Notification } from 'electron'
import type { DataPayload } from '../shared/schema'

const REMINDER_HOUR = 9

function todayKey(): string {
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

function isDueTodayOrOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return dueDate <= todayKey()
}

export function checkDueTasks(data: DataPayload): void {
  if (!Notification.isSupported()) return

  const dueTasks = data.tasks.filter(
    (task) => task.status === 'todo' && isDueTodayOrOverdue(task.dueDate)
  )

  if (dueTasks.length === 0) return

  const overdue = dueTasks.filter((task) => task.dueDate && task.dueDate < todayKey())
  const today = dueTasks.filter((task) => task.dueDate === todayKey())

  if (overdue.length > 0) {
    new Notification({
      title: 'ToDoDesk — просроченные задачи',
      body: `${overdue.length} задач(и) просрочено`
    }).show()
  } else if (today.length > 0) {
    new Notification({
      title: 'ToDoDesk — задачи на сегодня',
      body: `${today.length} задач(и) на сегодня`
    }).show()
  }
}

export function scheduleDailyReminder(callback: () => void): NodeJS.Timeout {
  const tick = (): void => {
    const now = new Date()
    if (now.getHours() === REMINDER_HOUR && now.getMinutes() === 0) {
      callback()
    }
  }

  return setInterval(tick, 60_000)
}