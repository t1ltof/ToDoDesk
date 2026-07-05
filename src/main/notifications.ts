import { Notification, type BrowserWindow } from 'electron'
import type { DataPayload, Settings, Task } from '../shared/schema'

const firedReminders = new Set<string>()

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function parseDueDateTime(dueDate: string, hour: number, minute: number): Date {
  return new Date(dueDate + `T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`)
}

function showNotification(
  title: string,
  body: string,
  taskId: string | null,
  getWindow: () => BrowserWindow | null
): void {
  if (!Notification.isSupported()) return

  const notification = new Notification({ title, body })
  notification.on('click', () => {
    const window = getWindow()
    if (!window) return
    if (!window.isVisible()) window.show()
    if (window.isMinimized()) window.restore()
    window.focus()
    if (taskId) window.webContents.send('app:open-task', taskId)
  })
  notification.show()
}

function collectReminders(data: DataPayload, settings: Settings, now: Date): Task[] {
  const due: Task[] = []
  const todoTasks = data.tasks.filter((task) => task.status === 'todo' && task.dueDate)

  for (const task of todoTasks) {
    if (!task.dueDate) continue
    const dueAt = parseDueDateTime(task.dueDate, settings.notificationHour, settings.notificationMinute)

    if (settings.remindDayBefore) {
      const dayBefore = new Date(dueAt)
      dayBefore.setDate(dayBefore.getDate() - 1)
      if (Math.abs(now.getTime() - dayBefore.getTime()) < 60_000) due.push(task)
    }

    if (settings.remindHourBefore) {
      const hourBefore = new Date(dueAt.getTime() - 3_600_000)
      if (Math.abs(now.getTime() - hourBefore.getTime()) < 60_000) due.push(task)
    }

    if (task.dueDate <= todayKey()) {
      if (now.getHours() === settings.notificationHour && now.getMinutes() === settings.notificationMinute) {
        due.push(task)
      }
    }
  }

  return due
}

export function checkDueTasks(
  data: DataPayload,
  getWindow: () => BrowserWindow | null
): void {
  const settings = data.settings
  const now = new Date()
  const reminders = collectReminders(data, settings, now)

  for (const task of reminders) {
    const key = `${task.id}-${now.toISOString().slice(0, 16)}`
    if (firedReminders.has(key)) continue
    firedReminders.add(key)

    const isOverdue = task.dueDate && task.dueDate < todayKey()
    showNotification(
      isOverdue ? 'ToDoDesk — просрочено' : 'ToDoDesk — напоминание',
      task.title,
      task.id,
      getWindow
    )
  }

  if (reminders.length === 0) {
    const today = todayKey()
    const overdue = data.tasks.filter(
      (task) => task.status === 'todo' && task.dueDate && task.dueDate < today
    )
    if (overdue.length > 0 && now.getHours() === settings.notificationHour && now.getMinutes() === settings.notificationMinute) {
      const key = `overdue-summary-${today}`
      if (!firedReminders.has(key)) {
        firedReminders.add(key)
        showNotification(
          'ToDoDesk — просроченные задачи',
          `${overdue.length} задач(и) просрочено`,
          overdue[0]?.id ?? null,
          getWindow
        )
      }
    }
  }
}

export function scheduleReminders(
  getData: () => DataPayload,
  getWindow: () => BrowserWindow | null
): NodeJS.Timeout {
  return setInterval(() => checkDueTasks(getData(), getWindow), 60_000)
}