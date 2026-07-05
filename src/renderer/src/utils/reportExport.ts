import type { DataPayload } from '../../../shared/schema'
import { getStats } from '../store/useAppStore'
import { getWeekKey, todayKey } from './calendarUtils'

function formatDateRu(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

export function buildWeeklyReport(data: DataPayload): string {
  const stats = getStats(data)
  const today = todayKey()
  const weekKey = getWeekKey(new Date())
  const weekGoals = data.weeklyGoals.filter((g) => g.weekKey === weekKey)
  const goalsDone = weekGoals.filter((g) => g.completed).length

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const completedThisWeek = data.tasks
    .filter((t) => t.status === 'done' && t.completedAt && new Date(t.completedAt) >= weekAgo)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))

  const overdue = data.tasks.filter(
    (t) => t.status === 'todo' && t.dueDate && t.dueDate < today
  )

  const lines: string[] = [
    '═══════════════════════════════════════',
    '       ОТЧЁТ ToDoDesk',
    `       ${formatDateRu(today)}`,
    '═══════════════════════════════════════',
    '',
    '── Сводка ──',
    `Активных задач: ${stats.active}`,
    `На сегодня: ${stats.today}`,
    `Просрочено: ${stats.overdue}`,
    `Выполнено за неделю: ${stats.doneWeek}`,
    `Выполнено за месяц: ${stats.doneMonth}`,
    `Всего задач: ${stats.total}`,
    '',
    '── Цели недели ──',
    weekGoals.length === 0
      ? 'Цели не заданы'
      : `${goalsDone} из ${weekGoals.length} выполнено (${Math.round((goalsDone / weekGoals.length) * 100)}%)`
  ]

  if (weekGoals.length > 0) {
    for (const goal of weekGoals) {
      lines.push(`  ${goal.completed ? '✓' : '○'} ${goal.text}`)
    }
  }

  lines.push('', '── Выполнено за 7 дней ──')
  if (completedThisWeek.length === 0) {
    lines.push('Нет выполненных задач')
  } else {
    for (const task of completedThisWeek.slice(0, 30)) {
      const project = data.projects.find((p) => p.id === task.projectId)
      const projectLabel = project ? ` [${project.name}]` : ''
      const date = task.completedAt
        ? new Date(task.completedAt).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })
        : ''
      lines.push(`  • ${task.title}${projectLabel} — ${date}`)
    }
    if (completedThisWeek.length > 30) {
      lines.push(`  ... и ещё ${completedThisWeek.length - 30}`)
    }
  }

  if (overdue.length > 0) {
    lines.push('', '── Просроченные задачи ──')
    for (const task of overdue.slice(0, 15)) {
      lines.push(`  ! ${task.title} (срок: ${task.dueDate})`)
    }
    if (overdue.length > 15) {
      lines.push(`  ... и ещё ${overdue.length - 15}`)
    }
  }

  lines.push('', '═══════════════════════════════════════', 'Сгенерировано ToDoDesk')
  return lines.join('\n')
}

export function downloadTextReport(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}