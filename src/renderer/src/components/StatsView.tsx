import { useMemo } from 'react'
import { getStats, useAppStore } from '../store/useAppStore'

export default function StatsView(): JSX.Element {
  const { data } = useAppStore()
  const stats = useMemo(() => getStats(data), [data])

  const cards = [
    { label: 'Активных задач', value: stats.active, color: 'text-blue-300' },
    { label: 'На сегодня', value: stats.today, color: 'text-amber-300' },
    { label: 'Просрочено', value: stats.overdue, color: 'text-red-300' },
    { label: 'Выполнено за неделю', value: stats.doneWeek, color: 'text-green-300' },
    { label: 'Выполнено за месяц', value: stats.doneMonth, color: 'text-green-400' },
    { label: 'Всего задач', value: stats.total, color: 'text-gray-300' }
  ]

  const last7 = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const key = d.toISOString().slice(0, 10)
      const count = data.tasks.filter(
        (t) => t.completedAt && t.completedAt.slice(0, 10) === key
      ).length
      return { label: d.toLocaleDateString('ru-RU', { weekday: 'short' }), count }
    })
  }, [data.tasks])

  const max = Math.max(...last7.map((d) => d.count), 1)

  return (
    <section className="flex h-full flex-1 flex-col overflow-y-auto p-6">
      <h2 className="mb-6 text-xl font-semibold">Статистика</h2>

      <div className="grid grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-surface-border bg-surface-elevated p-4"
          >
            <p className="text-sm text-gray-400">{card.label}</p>
            <p className={`mt-1 text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
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