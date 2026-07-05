export const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

export interface CalendarCell {
  date: string
  day: number
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getWeekDays(baseDate = new Date()): string[] {
  const day = baseDate.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(baseDate)
  monday.setDate(baseDate.getDate() + mondayOffset)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

export function getMonthGrid(year: number, month: number): CalendarCell[] {
  const today = todayKey()
  const first = new Date(year, month, 1)
  const startDay = first.getDay()
  const mondayOffset = startDay === 0 ? -6 : 1 - startDay
  const start = new Date(year, month, 1)
  start.setDate(1 + mondayOffset)

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const date = d.toISOString().slice(0, 10)
    const dow = d.getDay()
    return {
      date,
      day: d.getDate(),
      isCurrentMonth: d.getMonth() === month,
      isToday: date === today,
      isWeekend: dow === 0 || dow === 6
    }
  })
}

export function formatMonthYear(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`
}

export function formatDayLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
}

/** Monday date of the week containing the given date (YYYY-MM-DD). */
export function getWeekKey(date = new Date()): string {
  const day = date.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + mondayOffset)
  return monday.toISOString().slice(0, 10)
}

export function getHeatmapDays(weeks = 12): string[] {
  const today = new Date()
  const day = today.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const endMonday = new Date(today)
  endMonday.setDate(today.getDate() + mondayOffset)

  const startMonday = new Date(endMonday)
  startMonday.setDate(endMonday.getDate() - (weeks - 1) * 7)

  const days: string[] = []
  const cursor = new Date(startMonday)
  const end = new Date(endMonday)
  end.setDate(end.getDate() + 6)

  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}