import {
  Archive,
  Calendar,
  CheckSquare,
  Columns3,
  List,
  Pin,
  Plus,
  ClipboardPaste,
  Search,
  Tag,
  Trash2,
  X
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { QuickFilter, ViewId } from '../../../shared/schema'
import {
  bulkAddTag,
  bulkArchive,
  bulkDelete,
  bulkMoveToProject,
  bulkPin,
  bulkSetDueDate
} from '../utils/bulkActions'
import { clearCompletedTasks, createRootTask, reorderTasks, toggleTaskTag } from '../utils/taskHelpers'
import { filterTasksForView, sortProjects, useAppStore } from '../store/useAppStore'
import { todayKey } from '../utils/calendarUtils'
import ProjectDialog from './ProjectDialog'
import TaskItem from './TaskItem'
import clsx from 'clsx'

const viewTitles: Record<string, string> = {
  today: 'Сегодня',
  inbox: 'Входящие',
  all: 'Все задачи',
  completed: 'Выполненные задачи'
}

const quickFilters: Array<{ id: QuickFilter; label: string }> = [
  { id: 'none', label: 'Все' },
  { id: 'overdue', label: 'Просрочено' },
  { id: 'no-due', label: 'Без срока' },
  { id: 'no-project', label: 'Без проекта' },
  { id: 'important', label: 'Важные' },
  { id: 'archived', label: 'Архив' }
]

function getViewTitle(view: ViewId, data: ReturnType<typeof useAppStore.getState>['data']): string {
  if (view.startsWith('project:')) {
    return data.projects.find((p) => p.id === view.replace('project:', ''))?.name ?? 'Проект'
  }
  if (view.startsWith('tag:')) {
    const tag = data.tags.find((t) => t.id === view.replace('tag:', ''))
    return tag ? `#${tag.name}` : 'Тег'
  }
  return viewTitles[view] ?? 'Задачи'
}

interface TaskPanelProps {
  onPasteTasks?: () => void
}

export default function TaskPanel({ onPasteTasks }: TaskPanelProps = {}): JSX.Element {
  const {
    data,
    activeView,
    searchQuery,
    quickFilter,
    bulkSelectedTaskIds,
    setSearchQuery,
    setQuickFilter,
    persist,
    setActiveView,
    toggleBulkSelectedTaskId,
    clearBulkSelection
  } = useAppStore()
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [dragOverEnd, setDragOverEnd] = useState(false)
  const newTaskInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setBulkMode(false)
  }, [activeView])

  const tasks = useMemo(
    () => filterTasksForView(data, activeView, searchQuery, quickFilter),
    [data, activeView, searchQuery, quickFilter]
  )

  const isCompletedView = activeView === 'completed'
  const isProject = activeView.startsWith('project:')
  const canDrag = !isCompletedView && quickFilter !== 'archived'
  const projects = sortProjects(data.projects)
  const hasBulkSelection = bulkSelectedTaskIds.length > 0

  const focusNewTaskInput = (): void => {
    requestAnimationFrame(() => {
      window.focus()
      newTaskInputRef.current?.focus()
    })
  }

  const addTask = async (): Promise<void> => {
    const title = newTaskTitle.trim()
    if (!title || isCompletedView) return

    const projectId = activeView.startsWith('project:')
      ? activeView.replace('project:', '')
      : activeView.startsWith('tag:')
        ? null
        : null

    const dueDate = activeView === 'today' ? todayKey() : null
    const current = useAppStore.getState().data
    let next = createRootTask(current, { title, projectId, dueDate })
    if (activeView.startsWith('tag:')) {
      const tagId = activeView.replace('tag:', '')
      const createdTask = next.tasks[next.tasks.length - 1]
      next = toggleTaskTag(next, createdTask.id, tagId)
    }
    await persist(next)
    setNewTaskTitle('')
  }

  const handleClearCompleted = async (): Promise<void> => {
    const count = data.tasks.filter((t) => t.status === 'done').length
    if (!count || !confirm(`Удалить ${count} выполненных задач?`)) return
    const current = useAppStore.getState().data
    await persist(clearCompletedTasks(current))
  }

  const handleDrop = async (
    targetId: string,
    dropPosition: 'before' | 'after'
  ): Promise<void> => {
    if (!draggingId || draggingId === targetId) return
    const ids = tasks.map((t) => t.id)
    const from = ids.indexOf(draggingId)
    if (from < 0) return

    const reordered = [...ids]
    reordered.splice(from, 1)

    const to = reordered.indexOf(targetId)
    if (to < 0) return

    const insertAt = dropPosition === 'after' ? to + 1 : to
    reordered.splice(insertAt, 0, draggingId)

    const current = useAppStore.getState().data
    await persist(reorderTasks(current, reordered))
    setDraggingId(null)
  }

  const handleDropAtEnd = async (): Promise<void> => {
    if (!draggingId) return
    const ids = tasks.map((t) => t.id)
    const from = ids.indexOf(draggingId)
    if (from < 0) return

    const reordered = [...ids]
    reordered.splice(from, 1)
    reordered.push(draggingId)

    const current = useAppStore.getState().data
    await persist(reorderTasks(current, reordered))
    setDraggingId(null)
  }

  const runBulkAction = async (
    action: (current: ReturnType<typeof useAppStore.getState>['data']) => ReturnType<typeof bulkDelete>
  ): Promise<void> => {
    if (!hasBulkSelection) return
    await persist(action(useAppStore.getState().data))
    clearBulkSelection()
    setBulkMode(false)
    focusNewTaskInput()
  }

  const handleBulkMove = async (): Promise<void> => {
    const projectName = prompt(
      `Проект (${projects.map((project) => project.name).join(', ') || 'нет проектов'}, пусто = входящие):`
    )
    if (projectName === null) return
    const trimmed = projectName.trim()
    const project = trimmed
      ? projects.find((item) => item.name.toLowerCase() === trimmed.toLowerCase())
      : null
    if (trimmed && !project) {
      alert('Проект не найден')
      return
    }
    await runBulkAction((current) =>
      bulkMoveToProject(current, bulkSelectedTaskIds, project?.id ?? null)
    )
  }

  const handleBulkTag = async (): Promise<void> => {
    if (data.tags.length === 0) {
      alert('Сначала создайте тег')
      return
    }
    const tagName = prompt(`Тег (${data.tags.map((tag) => tag.name).join(', ')}):`)
    if (!tagName?.trim()) return
    const tag = data.tags.find((item) => item.name.toLowerCase() === tagName.trim().toLowerCase())
    if (!tag) {
      alert('Тег не найден')
      return
    }
    await runBulkAction((current) => bulkAddTag(current, bulkSelectedTaskIds, tag.id))
  }

  const handleBulkDueDate = async (): Promise<void> => {
    const dueDate = prompt('Новая дата (ГГГГ-ММ-ДД, пусто = без срока):', '')
    if (dueDate === null) return
    const resolved = dueDate.trim() || null
    await runBulkAction((current) => bulkSetDueDate(current, bulkSelectedTaskIds, resolved))
  }

  const handleBulkArchive = async (): Promise<void> => {
    const archived = quickFilter !== 'archived'
    await runBulkAction((current) => bulkArchive(current, bulkSelectedTaskIds, archived))
  }

  const handleBulkDelete = async (): Promise<void> => {
    if (!confirm(`Удалить ${bulkSelectedTaskIds.length} задач?`)) return
    await runBulkAction((current) => bulkDelete(current, bulkSelectedTaskIds))
  }

  const handleBulkPin = async (): Promise<void> => {
    await runBulkAction((current) => bulkPin(current, bulkSelectedTaskIds, true))
  }

  const exitBulkMode = (): void => {
    setBulkMode(false)
    clearBulkSelection()
    focusNewTaskInput()
  }

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-surface-border px-6 py-4">
        <div>
          <h2 className="text-xl font-semibold">{getViewTitle(activeView, data)}</h2>
          <p className="text-sm text-gray-400">{tasks.length} задач</p>
        </div>
        <div className="flex items-center gap-2">
          {isProject && (
            <div className="flex rounded-lg border border-surface-border">
              <button
                type="button"
                onClick={() => setActiveView(activeView)}
                className={clsx('p-2', activeView.startsWith('project:') && 'bg-accent-muted text-blue-300')}
              >
                <List size={16} />
              </button>
              <button
                type="button"
                onClick={() => setActiveView(`kanban:${activeView.replace('project:', '')}`)}
                className="p-2 text-gray-400 hover:text-gray-200"
              >
                <Columns3 size={16} />
              </button>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск..."
              className="rounded-lg border border-surface-border bg-surface-elevated py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          {!isCompletedView && (
            <button
              type="button"
              onClick={() => onPasteTasks?.()}
              className="inline-flex items-center gap-1 rounded-lg border border-surface-border px-3 py-2 text-sm text-gray-300"
              title="Ctrl+Shift+V"
            >
              <ClipboardPaste size={16} /> Вставить список
            </button>
          )}
          {!isCompletedView && (
            <button
              type="button"
              onClick={() => (bulkMode ? exitBulkMode() : setBulkMode(true))}
              className={clsx(
                'inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm',
                bulkMode
                  ? 'border-accent bg-accent-muted text-blue-300'
                  : 'border-surface-border text-gray-300'
              )}
            >
              <CheckSquare size={16} /> Выбрать
            </button>
          )}
          {isCompletedView ? (
            <button
              type="button"
              onClick={() => void handleClearCompleted()}
              className="inline-flex items-center gap-1 rounded-lg border border-red-800/50 px-3 py-2 text-sm text-red-300"
            >
              <Trash2 size={16} /> Очистить
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowProjectDialog(true)}
              className="rounded-lg border border-surface-border px-3 py-2 text-sm text-gray-300"
            >
              + Проект
            </button>
          )}
        </div>
      </header>

      {!isCompletedView && (
        <div className="border-b border-surface-border px-6 py-3">
          <div className="mb-3 flex flex-wrap gap-2">
            {quickFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setQuickFilter(filter.id)}
                className={clsx(
                  'rounded-full px-3 py-1 text-xs transition',
                  quickFilter === filter.id
                    ? 'bg-accent-muted text-blue-300'
                    : 'border border-surface-border text-gray-400 hover:text-gray-200'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              ref={newTaskInputRef}
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void addTask()}
              placeholder="Новая задача..."
              className="flex-1 rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => void addTask()}
              className="inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              <Plus size={16} /> Добавить
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border px-6 py-12 text-center text-gray-400">
            {isCompletedView ? 'Выполненных задач нет' : 'Задач нет — добавьте первую'}
          </div>
        ) : (
          <>
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                view={activeView}
                draggable={canDrag}
                bulkMode={bulkMode}
                bulkSelected={bulkSelectedTaskIds.includes(task.id)}
                onBulkToggle={toggleBulkSelectedTaskId}
                onDragStart={setDraggingId}
                onDrop={(id, position) => void handleDrop(id, position)}
              />
            ))}
            {canDrag && (
              <div
                onDragOver={(event) => {
                  if (!draggingId) return
                  event.preventDefault()
                  setDragOverEnd(true)
                }}
                onDragLeave={() => setDragOverEnd(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragOverEnd(false)
                  void handleDropAtEnd()
                }}
                className={clsx(
                  'h-6 rounded-lg border border-dashed transition-all duration-200',
                  dragOverEnd
                    ? 'border-accent bg-accent-muted/30'
                    : 'border-transparent'
                )}
              />
            )}
          </>
        )}
      </div>

      {hasBulkSelection && (
        <div className="flex flex-wrap items-center gap-2 border-t border-surface-border bg-surface-elevated px-6 py-3">
          <span className="text-sm text-gray-300">Выбрано: {bulkSelectedTaskIds.length}</span>
          <button
            type="button"
            onClick={() => void handleBulkMove()}
            className="inline-flex items-center gap-1 rounded-lg border border-surface-border px-3 py-1.5 text-xs text-gray-300"
          >
            <List size={14} /> В проект
          </button>
          <button
            type="button"
            onClick={() => void handleBulkTag()}
            className="inline-flex items-center gap-1 rounded-lg border border-surface-border px-3 py-1.5 text-xs text-gray-300"
          >
            <Tag size={14} /> Тег
          </button>
          <button
            type="button"
            onClick={() => void handleBulkDueDate()}
            className="inline-flex items-center gap-1 rounded-lg border border-surface-border px-3 py-1.5 text-xs text-gray-300"
          >
            <Calendar size={14} /> Срок
          </button>
          <button
            type="button"
            onClick={() => void handleBulkPin()}
            className="inline-flex items-center gap-1 rounded-lg border border-surface-border px-3 py-1.5 text-xs text-gray-300"
          >
            <Pin size={14} /> Закрепить
          </button>
          <button
            type="button"
            onClick={() => void handleBulkArchive()}
            className="inline-flex items-center gap-1 rounded-lg border border-surface-border px-3 py-1.5 text-xs text-gray-300"
          >
            <Archive size={14} /> {quickFilter === 'archived' ? 'Разархивировать' : 'Архив'}
          </button>
          <button
            type="button"
            onClick={() => void handleBulkDelete()}
            className="inline-flex items-center gap-1 rounded-lg border border-red-800/50 px-3 py-1.5 text-xs text-red-300"
          >
            <Trash2 size={14} /> Удалить
          </button>
          <button
            type="button"
            onClick={clearBulkSelection}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:text-gray-300"
          >
            <X size={14} /> Сбросить
          </button>
        </div>
      )}

      {showProjectDialog && <ProjectDialog onClose={() => setShowProjectDialog(false)} />}
    </section>
  )
}