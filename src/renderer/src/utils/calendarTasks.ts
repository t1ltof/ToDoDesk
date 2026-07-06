import type { DataPayload, Recurrence, Task } from '../../../shared/schema'
import { addDaysToDateKey, localDateKey, parseLocalDate } from './calendarUtils'

function isWeekendDate(dateKey: string): boolean {
  const day = parseLocalDate(dateKey).getDay()
  return day === 0 || day === 6
}

function matchesRecurrence(dateKey: string, anchor: string, recurrence: Recurrence): boolean {
  if (recurrence === 'none') return dateKey === anchor
  if (dateKey < anchor) return false

  const anchorDate = parseLocalDate(anchor)
  const target = parseLocalDate(dateKey)
  const diffDays = Math.round((target.getTime() - anchorDate.getTime()) / 86_400_000)

  if (recurrence === 'daily') return diffDays >= 0
  if (recurrence === 'weekly') return diffDays >= 0 && diffDays % 7 === 0
  if (recurrence === 'monthly') {
    return target.getDate() === anchorDate.getDate() && target >= anchorDate
  }
  if (recurrence === 'weekdays') return diffDays >= 0 && !isWeekendDate(dateKey)
  if (recurrence === 'weekends') return diffDays >= 0 && isWeekendDate(dateKey)
  return false
}

export function buildCalendarTasksByDate(
  data: DataPayload,
  rangeStart: string,
  rangeEnd: string
): Map<string, Task[]> {
  const map = new Map<string, Task[]>()

  const add = (dateKey: string, task: Task): void => {
    if (dateKey < rangeStart || dateKey > rangeEnd) return
    const list = map.get(dateKey) ?? []
    if (list.some((t) => t.id === task.id)) return
    list.push(task)
    map.set(dateKey, list)
  }

  for (const task of data.tasks) {
    if (task.status !== 'todo' || !task.dueDate) continue

    if (task.recurrence === 'none') {
      if (task.dueDateEnd && task.dueDateEnd > task.dueDate) {
        let cursor = task.dueDate
        while (cursor <= task.dueDateEnd) {
          add(cursor, task)
          cursor = addDaysToDateKey(cursor, 1)
        }
      } else {
        add(task.dueDate, task)
      }
      continue
    }

    let cursor = rangeStart < task.dueDate ? task.dueDate : rangeStart
    const exceptions = new Set(task.recurrenceExceptions)
    let guard = 0

    while (cursor <= rangeEnd && guard < 400) {
      if (!exceptions.has(cursor) && matchesRecurrence(cursor, task.dueDate, task.recurrence)) {
        add(cursor, task)
      }
      cursor = addDaysToDateKey(cursor, 1)
      guard += 1
    }
  }

  for (const [, list] of map) {
    list.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  return map
}

export function getCalendarRangeStartEnd(
  mode: 'day' | 'week' | 'month',
  opts: {
    displayDate: string
    weekDays: string[]
    monthCells: { date: string }[]
  }
): { start: string; end: string } {
  if (mode === 'day') return { start: opts.displayDate, end: opts.displayDate }
  if (mode === 'week') {
    return { start: opts.weekDays[0], end: opts.weekDays[6] }
  }
  const dates = opts.monthCells.map((c) => c.date)
  return { start: dates[0], end: dates[dates.length - 1] }
}