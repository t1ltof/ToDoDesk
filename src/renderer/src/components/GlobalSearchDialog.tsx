import { FileText, LayoutDashboard, ListTodo, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DataPayload } from '../../../shared/schema'
import { useAppStore } from '../store/useAppStore'
import clsx from 'clsx'

interface GlobalSearchDialogProps {
  open: boolean
  onClose: () => void
  onSelectTask: (taskId: string) => void
  onSelectNote: (noteId: string) => void
  onSelectBoardNode: (nodeId: string) => void
}

interface SearchResult {
  id: string
  type: 'task' | 'note' | 'board'
  title: string
  subtitle: string
}

function searchData(data: DataPayload, query: string): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const results: SearchResult[] = []

  for (const task of data.tasks) {
    if (task.title.toLowerCase().includes(q) || task.description.toLowerCase().includes(q)) {
      results.push({
        id: task.id,
        type: 'task',
        title: task.title,
        subtitle: task.status === 'done' ? 'Выполнена' : 'Задача'
      })
    }
  }

  for (const note of data.notes) {
    if (note.title.toLowerCase().includes(q) || note.content.toLowerCase().includes(q)) {
      results.push({
        id: note.id,
        type: 'note',
        title: note.title,
        subtitle: 'Заметка'
      })
    }
  }

  for (const node of data.boardNodes) {
    if (node.title.toLowerCase().includes(q) || node.notes.toLowerCase().includes(q)) {
      results.push({
        id: node.id,
        type: 'board',
        title: node.title,
        subtitle: node.kind === 'idea' ? 'Идея на доске' : 'Узел на доске'
      })
    }
  }

  return results.slice(0, 50)
}

function resultIcon(type: SearchResult['type']) {
  if (type === 'task') return ListTodo
  if (type === 'note') return FileText
  return LayoutDashboard
}

export default function GlobalSearchDialog({
  open,
  onClose,
  onSelectTask,
  onSelectNote,
  onSelectBoardNode
}: GlobalSearchDialogProps): JSX.Element | null {
  const { data } = useAppStore()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => searchData(data, query), [data, query])

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

  const handleSelect = (result: SearchResult): void => {
    if (result.type === 'task') onSelectTask(result.id)
    if (result.type === 'note') onSelectNote(result.id)
    if (result.type === 'board') onSelectBoardNode(result.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-surface-border bg-surface-elevated shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3">
          <Search size={18} className="text-gray-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose()
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex((index) => Math.max(index - 1, 0))
              }
              if (event.key === 'Enter' && results[activeIndex]) {
                event.preventDefault()
                handleSelect(results[activeIndex])
              }
            }}
            placeholder="Поиск задач, заметок и доски..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <span className="text-xs text-gray-500">Ctrl+F</span>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim() === '' ? (
            <p className="px-3 py-6 text-center text-sm text-gray-500">
              Введите запрос для поиска
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-500">Ничего не найдено</p>
          ) : (
            results.map((result, index) => {
              const Icon = resultIcon(result.type)
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onClick={() => handleSelect(result)}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition',
                    index === activeIndex
                      ? 'bg-accent-muted text-blue-200'
                      : 'text-gray-300 hover:bg-surface-border/60'
                  )}
                >
                  <Icon size={16} className="shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{result.title}</p>
                    <p className="truncate text-xs text-gray-500">{result.subtitle}</p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}