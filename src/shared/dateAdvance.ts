/** YYYY-MM-DD in local timezone. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function advanceMonthlyDueDate(dueDate: string): string {
  const date = new Date(`${dueDate}T12:00:00`)
  const day = date.getDate()
  date.setMonth(date.getMonth() + 1)
  if (date.getDate() < day) date.setDate(0)
  return localDateKey(date)
}