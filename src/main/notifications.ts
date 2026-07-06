import { Notification, type BrowserWindow } from 'electron'
import type { DataPayload, Reminder, Settings, Task } from '../shared/schema'

const firedReminders = new Set<string>()

function pruneFiredReminders(now: Date): void {
  if (firedReminders.size < 500) return
  const today = todayKey()
  const datePrefix = now.toISOString().slice(0, 10)
  for (const key of firedReminders) {
    if (!key.includes(today) && !key.includes(datePrefix)) {
      firedReminders.delete(key)
    }
  }
}

function todayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDueDateTime(dueDate: string, hour: number, minute: number): Date {
  return new Date(dueDate + `T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`)
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function isQuietHours(settings: Settings, now: Date): boolean {
  if (settings.quietHoursEnabled === false) return false
  const start = settings.quietHoursStart
  const end = settings.quietHoursEnd
  if (!start || !end) return false

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const startMin = parseTimeToMinutes(start)
  const endMin = parseTimeToMinutes(end)

  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin < endMin
  }
  return nowMin >= startMin || nowMin < endMin
}

function showNotification(
  title: string,
  body: string,
  taskId: string | null,
  getWindow: () => BrowserWindow | null,
  playSound: boolean
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

  if (playSound) {
    getWindow()?.webContents.send('app:notification')
  }
}

function getTaskDueDateTime(task: Task, settings: Settings): Date {
  if (task.dueTime) {
    const [hour, minute] = task.dueTime.split(':').map(Number)
    return parseDueDateTime(task.dueDate!, hour, minute)
  }
  return parseDueDateTime(task.dueDate!, settings.notificationHour, settings.notificationMinute)
}

function collectDueDateReminders(data: DataPayload, settings: Settings, now: Date): Task[] {
  const due: Task[] = []
  const todoTasks = data.tasks.filter((task) => task.status === 'todo' && task.dueDate)

  for (const task of todoTasks) {
    if (!task.dueDate) continue
    const dueAt = getTaskDueDateTime(task, settings)

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

function collectCustomReminders(data: DataPayload, now: Date): Array<{ task: Task; reminder: Reminder }> {
  const result: Array<{ task: Task; reminder: Reminder }> = []
  const nowMs = now.getTime()

  for (const reminder of data.reminders) {
    const remindAt = new Date(reminder.remindAt).getTime()
    if (remindAt > nowMs) continue
    if (nowMs - remindAt >= 300_000) continue

    const task = data.tasks.find((t) => t.id === reminder.taskId && t.status === 'todo')
    if (task) result.push({ task, reminder })
  }

  return result
}

function checkDailyDigest(
  data: DataPayload,
  settings: Settings,
  now: Date,
  getWindow: () => BrowserWindow | null
): void {
  if (!settings.dailyDigestEnabled) return
  if (now.getHours() !== settings.dailyDigestHour || now.getMinutes() !== 0) return

  const today = todayKey()
  const key = `digest-${today}`
  if (firedReminders.has(key)) return
  firedReminders.add(key)

  const todayCount = data.tasks.filter(
    (task) => task.status === 'todo' && task.dueDate && task.dueDate <= today
  ).length
  const overdueCount = data.tasks.filter(
    (task) => task.status === 'todo' && task.dueDate && task.dueDate < today
  ).length

  showNotification(
    'ToDoDesk — сводка дня',
    `На сегодня: ${todayCount} задач. Просрочено: ${overdueCount}.`,
    null,
    getWindow,
    settings.notificationSound
  )
}

export function checkDueTasks(
  data: DataPayload,
  getWindow: () => BrowserWindow | null
): void {
  const settings = data.settings
  const now = new Date()
  pruneFiredReminders(now)

  if (!isQuietHours(settings, now)) {
    const dueDateReminders = collectDueDateReminders(data, settings, now)
    const customReminders = collectCustomReminders(data, now)

    for (const task of dueDateReminders) {
      const key = `due-${task.id}-${now.toISOString().slice(0, 16)}`
      if (firedReminders.has(key)) continue
      firedReminders.add(key)

      const isOverdue = task.dueDate && task.dueDate < todayKey()
      showNotification(
        isOverdue ? 'ToDoDesk — просрочено' : 'ToDoDesk — напоминание',
        task.title,
        task.id,
        getWindow,
        settings.notificationSound
      )
    }

    for (const { task, reminder } of customReminders) {
      const key = `custom-${reminder.id}`
      if (firedReminders.has(key)) continue
      firedReminders.add(key)

      showNotification(
        'ToDoDesk — напоминание',
        task.title,
        task.id,
        getWindow,
        settings.notificationSound
      )
    }

    if (dueDateReminders.length === 0 && customReminders.length === 0) {
      const today = todayKey()
      const overdue = data.tasks.filter(
        (task) => task.status === 'todo' && task.dueDate && task.dueDate < today
      )
      if (
        overdue.length > 0 &&
        now.getHours() === settings.notificationHour &&
        now.getMinutes() === settings.notificationMinute
      ) {
        const key = `overdue-summary-${today}`
        if (!firedReminders.has(key)) {
          firedReminders.add(key)
          showNotification(
            'ToDoDesk — просроченные задачи',
            `${overdue.length} задач(и) просрочено`,
            overdue[0]?.id ?? null,
            getWindow,
            settings.notificationSound
          )
        }
      }
    }
  }

  checkDailyDigest(data, settings, now, getWindow)
}

export function scheduleReminders(
  getData: () => DataPayload,
  getWindow: () => BrowserWindow | null
): NodeJS.Timeout {
  return setInterval(() => checkDueTasks(getData(), getWindow), 60_000)
}