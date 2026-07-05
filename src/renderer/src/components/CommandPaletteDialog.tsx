import {
  CalendarDays,
  ClipboardList,
  Command,
  Focus,
  GanttChart,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Plus,
  Search,
  Settings,
  Sparkles,
  Timer,
  type LucideIcon
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ViewId } from '../../../shared/schema'
import { useAppStore } from '../store/useAppStore'
import clsx from 'clsx'

interface CommandPaletteDialogProps {
  open: boolean
  onClose: () => void
  onSelectView: (view: ViewId) => void
  onSelectTask: (taskId: string) => void
  onQuickAdd: () => void
  onOpenSettings: () => void
  onGlobalSearch: () => void
}

interface CommandItem {
  id: string
  label: string
  keywords: string
  category: 'view' | 'action' | 'recent'
  icon: LucideIcon
  action: () => void
}

function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase()
  const t = text.toLowerCase()
  if (!q) return 1

  let qi = 0
  let score = 0
  let consecutive = 0

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 1 + consecutive
      consecutive += 1
      qi += 1
    } else {
      consecutive = 0
    }
  }

  return qi === q.length ? score : -1
}

const categoryLabels: Record<CommandItem['category'], string> = {
  view: 'Представления',
  action: 'Действия',
  recent: 'Недавние задачи'
}

export default function CommandPaletteDialog({
  open,
  onClose,
  onSelectView,
  onSelectTask,
  onQuickAdd,
  onOpenSettings,
  onGlobalSearch
}: CommandPaletteDialogProps): JSX.Element | null {
  const { data } = useAppStore()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands = useMemo((): CommandItem[] => {
    const viewCommands: CommandItem[] = [
      {
        id: 'view-today',
        label: 'Сегодня',
        keywords: 'сегодня today',
        category: 'view',
        icon: CalendarDays,
        action: () => onSelectView('today')
      },
      {
        id: 'view-inbox',
        label: 'Входящие',
        keywords: 'входящие inbox',
        category: 'view',
        icon: Inbox,
        action: () => onSelectView('inbox')
      },
      {
        id: 'view-board',
        label: 'Доска',
        keywords: 'доска board',
        category: 'view',
        icon: LayoutDashboard,
        action: () => onSelectView('board')
      },
      {
        id: 'view-calendar',
        label: 'Календарь',
        keywords: 'календарь calendar',
        category: 'view',
        icon: CalendarDays,
        action: () => onSelectView('calendar')
      },
      {
        id: 'view-timeline',
        label: 'Timeline',
        keywords: 'timeline таймлайн',
        category: 'view',
        icon: GanttChart,
        action: () => onSelectView('timeline')
      },
      {
        id: 'view-sprint',
        label: 'Спринты',
        keywords: 'спринты sprint',
        category: 'view',
        icon: Sparkles,
        action: () => onSelectView('sprint')
      },
      {
        id: 'view-focus',
        label: 'Фокус',
        keywords: 'фокус focus pomodoro',
        category: 'view',
        icon: Focus,
        action: () => onSelectView('focus')
      },
      {
        id: 'view-stats',
        label: 'Статистика',
        keywords: 'статистика stats',
        category: 'view',
        icon: Timer,
        action: () => onSelectView('stats')
      },
      {
        id: 'view-weekly-review',
        label: 'Еженедельный обзор',
        keywords: 'еженедельный обзор weekly review',
        category: 'view',
        icon: ClipboardList,
        action: () => onSelectView('weekly-review')
      },
      {
        id: 'view-next',
        label: 'Следующая задача',
        keywords: 'следующая задача next',
        category: 'view',
        icon: ListTodo,
        action: () => onSelectView('next')
      }
    ]

    const actionCommands: CommandItem[] = [
      {
        id: 'action-new-task',
        label: 'Новая задача',
        keywords: 'новая задача create add',
        category: 'action',
        icon: Plus,
        action: onQuickAdd
      },
      {
        id: 'action-settings',
        label: 'Настройки',
        keywords: 'настройки settings',
        category: 'action',
        icon: Settings,
        action: onOpenSettings
      },
      {
        id: 'action-search',
        label: 'Глобальный поиск',
        keywords: 'глобальный поиск search find',
        category: 'action',
        icon: Search,
        action: onGlobalSearch
      }
    ]

    const recentCommands: CommandItem[] = data.settings.recentTaskIds
      .map((taskId) => data.tasks.find((task) => task.id === taskId))
      .filter((task): task is NonNullable<typeof task> => Boolean(task))
      .map((task) => ({
        id: `recent-${task.id}`,
        label: task.title,
        keywords: `${task.title} ${task.description}`,
        category: 'recent' as const,
        icon: ListTodo,
        action: () => onSelectTask(task.id)
      }))

    return [...viewCommands, ...actionCommands, ...recentCommands]
  }, [data, onGlobalSearch, onOpenSettings, onQuickAdd, onSelectTask, onSelectView])

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return commands

    return commands
      .map((command) => ({
        command,
        score: Math.max(
          fuzzyScore(q, command.label),
          fuzzyScore(q, command.keywords)
        )
      }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.command)
  }, [commands, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  if (!open) return null

  const runCommand = (command: CommandItem): void => {
    command.action()
    onClose()
  }

  let lastCategory: CommandItem['category'] | null = null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-surface-border bg-surface-elevated shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3">
          <Command size={18} className="text-gray-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose()
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex((index) => Math.max(index - 1, 0))
              }
              if (event.key === 'Enter' && filtered[activeIndex]) {
                event.preventDefault()
                runCommand(filtered[activeIndex])
              }
            }}
            placeholder="Команда или представление..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <span className="text-xs text-gray-500">Ctrl+K</span>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-500">Ничего не найдено</p>
          ) : (
            filtered.map((command, index) => {
              const Icon = command.icon
              const showCategory = command.category !== lastCategory
              lastCategory = command.category

              return (
                <div key={command.id}>
                  {showCategory && (
                    <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                      {categoryLabels[command.category]}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => runCommand(command)}
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition',
                      index === activeIndex
                        ? 'bg-accent-muted text-blue-200'
                        : 'text-gray-300 hover:bg-surface-border/60'
                    )}
                  >
                    <Icon size={16} className="shrink-0 text-gray-400" />
                    <span className="truncate text-sm">{command.label}</span>
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}