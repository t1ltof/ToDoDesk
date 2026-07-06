import { Download } from 'lucide-react'
import { useMemo } from 'react'
import { getStats, useAppStore } from '../store/useAppStore'
import { getHeatmapDays, getWeekDays, getWeekKey, localDateKey } from '../utils/calendarUtils'
import { buildWeeklyReport, downloadTextReport } from '../utils/reportExport'
import { getWeeklyGoalsProgress } from '../utils/weeklyGoalsHelpers'
import clsx from 'clsx'

function heatColor(count: number, max: number): string {
  if (count === 0) return 'bg-surface-border/40'
  const ratio = count / Math.max(max, 1)
  if (ratio < 0.25) return 'bg-green-900/60'
  if (ratio < 0.5) return 'bg-green-700/70'
  if (ratio < 0.75) return 'bg-green-500/80'
  return 'bg-green-400'
}

export default function StatsView(): JSX.Element {
  const { data } = useAppStore()
  const stats = useMemo(() => getStats(data), [data])
  const weekKey = getWeekKey()
  const goalsProgress = useMemo(() => getWeeklyGoalsProgress(data, weekKey), [data, weekKey])

  const heatmapDays = useMemo(() => getHeatmapDays(12), [])
  const heatmapData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const day of heatmapDays) counts.set(day, 0)
    for (const task of data.tasks) {
      if (task.status !== 'done' || !task.completedAt) continue
      const key = task.completedAt.slice(0, 10)
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return heatmapDays.map((day) => ({ day, count: counts.get(day) ?? 0 }))
  }, [data.tasks, heatmapDays])

  const heatMax = Math.max(...heatmapData.map((d) => d.count), 1)

  const cards = [
    { label: 'Активных задач', value: stats.active, color: 'text-blue-300' },
    { label: 'На сегодня', value: stats.today, color: 'text-amber-300' },
    { label: 'Просрочено', value: stats.overdue, color: 'text-red-300' },
    { label: 'Выполнено за неделю', value: stats.doneWeek, color: 'text-green-300' },
    { label: 'Выполнено за месяц', value: stats.doneMonth, color: 'text-green-400' },
    {
      label: 'Цели недели',
      value:
        goalsProgress.total === 0
          ? '—'
          : `${goalsProgress.completed}/${goalsProgress.total} (${goalsProgress.percent}%)`,
      color: 'text-amber-300'
    },
    { label: 'Всего задач', value: stats.total, color: 'text-gray-300' }
  ]

  const last7 = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const key = localDateKey(d)
      const count = data.tasks.filter(
        (t) => t.completedAt && t.completedAt.slice(0, 10) === key
      ).length
      return { label: d.toLocaleDateString('ru-RU', { weekday: 'short' }), count }
    })
  }, [data.tasks])

  const max = Math.max(...last7.map((d) => d.count), 1)

  const weekComparison = useMemo(() => {
    const thisWeekDays = getWeekDays()
    const thisWeekStart = thisWeekDays[0]
    const lastWeekStart = new Date(`${thisWeekStart}T12:00:00`)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const lastWeekDays = getWeekDays(lastWeekStart)
    const lastWeekStartKey = lastWeekDays[0]
    const lastWeekEndKey = lastWeekDays[6]

    const countInRange = (start: string, end: string): number =>
      data.tasks.filter(
        (task) =>
          task.status === 'done' &&
          task.completedAt &&
          task.completedAt.slice(0, 10) >= start &&
          task.completedAt.slice(0, 10) <= end
      ).length

    const thisWeek = countInRange(thisWeekStart, thisWeekDays[6])
    const lastWeek = countInRange(lastWeekStartKey, lastWeekEndKey)
    const delta = thisWeek - lastWeek

    return { thisWeek, lastWeek, delta }
  }, [data.tasks])

  const loadForecast = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() + index)
      const key = localDateKey(date)
      const count = data.tasks.filter(
        (task) =>
          task.status === 'todo' &&
          !task.archived &&
          task.dueDate === key
      ).length
      return {
        label: date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' }),
        count,
        key
      }
    })
  }, [data.tasks])

  const forecastMax = Math.max(...loadForecast.map((day) => day.count), 1)

  const handleExport = (): void => {
    const report = buildWeeklyReport(data)
    const filename = `tododesk-otchet-${localDateKey()}.txt`
    downloadTextReport(report, filename)
  }

  const weeks = 12
  const daysPerWeek = 7

  return (
    <section className="flex h-full flex-1 flex-col overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Статистика</h2>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-elevated px-4 py-2 text-sm hover:bg-surface-border/60"
        >
          <Download size={16} />
          Экспорт отчёта
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-surface-border bg-surface-elevated p-4"
          >
            <p className="text-sm text-gray-400">{card.label}</p>
            <p className={clsx('mt-1 text-3xl font-bold', card.color)}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-surface-border bg-surface-elevated p-6">
        <h3 className="mb-4 font-medium">Тепловая карта (12 недель)</h3>
        <p className="mb-3 text-xs text-gray-500">Выполненные задачи по дням — чем ярче, тем больше</p>
        <div className="overflow-x-auto">
          <div className="inline-flex flex-col gap-1">
            <div className="flex gap-1 pl-8">
              {Array.from({ length: weeks }, (_, wi) => (
                <div key={wi} className="w-3 text-center text-[9px] text-gray-600">
                  {wi % 4 === 0 ? `${weeks - wi}н` : ''}
                </div>
              ))}
            </div>
            {Array.from({ length: daysPerWeek }, (_, dow) => (
              <div key={dow} className="flex items-center gap-1">
                <span className="w-6 text-right text-[10px] text-gray-500">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][dow]}
                </span>
                {Array.from({ length: weeks }, (_, wi) => {
                  const idx = wi * daysPerWeek + dow
                  const cell = heatmapData[idx]
                  if (!cell) return <div key={wi} className="h-3 w-3" />
                  return (
                    <div
                      key={wi}
                      title={`${cell.day}: ${cell.count} выполнено`}
                      className={clsx('h-3 w-3 rounded-sm', heatColor(cell.count, heatMax))}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <span>Меньше</span>
          <div className="flex gap-0.5">
            <div className="h-3 w-3 rounded-sm bg-surface-border/40" />
            <div className="h-3 w-3 rounded-sm bg-green-900/60" />
            <div className="h-3 w-3 rounded-sm bg-green-700/70" />
            <div className="h-3 w-3 rounded-sm bg-green-500/80" />
            <div className="h-3 w-3 rounded-sm bg-green-400" />
          </div>
          <span>Больше</span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-surface-border bg-surface-elevated p-6">
          <h3 className="mb-4 font-medium">Сравнение недель</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Эта неделя</p>
              <p className="mt-1 text-3xl font-bold text-green-300">{weekComparison.thisWeek}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Прошлая неделя</p>
              <p className="mt-1 text-3xl font-bold text-gray-300">{weekComparison.lastWeek}</p>
            </div>
          </div>
          <p
            className={clsx(
              'mt-4 text-sm',
              weekComparison.delta > 0
                ? 'text-green-300'
                : weekComparison.delta < 0
                  ? 'text-red-300'
                  : 'text-gray-400'
            )}
          >
            {weekComparison.delta > 0 && `+${weekComparison.delta} к прошлой неделе`}
            {weekComparison.delta < 0 && `${weekComparison.delta} к прошлой неделе`}
            {weekComparison.delta === 0 && 'Без изменений к прошлой неделе'}
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-elevated p-6">
          <h3 className="mb-4 font-medium">Прогноз нагрузки (7 дней)</h3>
          <p className="mb-3 text-xs text-gray-500">Активные задачи со сроком на каждый день</p>
          <div className="flex h-32 items-end gap-2">
            {loadForecast.map((day) => (
              <div key={day.key} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-amber-500/80 transition-all"
                  style={{
                    height: `${(day.count / forecastMax) * 100}%`,
                    minHeight: day.count > 0 ? 8 : 2
                  }}
                />
                <span className="text-[10px] text-gray-500">{day.label}</span>
                <span className="text-[10px] text-gray-400">{day.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-surface-border bg-surface-elevated p-6">
        <h3 className="mb-4 font-medium">Выполнено за 7 дней</h3>
        <div className="flex h-40 items-end gap-3">
          {last7.map((day) => (
            <div key={day.label} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t bg-accent transition-all"
                style={{ height: `${(day.count / max) * 100}%`, minHeight: day.count > 0 ? 8 : 2 }}
              />
              <span className="text-xs text-gray-500">{day.label}</span>
              <span className="text-xs text-gray-400">{day.count}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}