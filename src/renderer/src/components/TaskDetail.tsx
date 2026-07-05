import { Archive, Bell, Pin, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Priority, Recurrence } from '../../../shared/schema'
import { createTemplate } from '../utils/templateHelpers'
import {
  addChecklistItem,
  addReminderInHours,
  createSubtask,
  createTag,
  deleteTaskTree,
  removeChecklistItem,
  toggleChecklistItem,
  toggleTaskTag,
  updateTask
} from '../utils/taskHelpers'
import { getChildTasks, getTaskTags, sortProjects, useAppStore } from '../store/useAppStore'
import clsx from 'clsx'

interface TaskDetailProps {
  onSaveAsTemplate: () => void
}

export default function TaskDetail({ onSaveAsTemplate }: TaskDetailProps): JSX.Element | null {
  const { data, selectedTaskId, setSelectedTaskId, persist } = useAppStore()
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const [checklistText, setChecklistText] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const task = data.tasks.find((item) => item.id === selectedTaskId)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description)
    }
  }, [task?.id, task?.title, task?.description])
  const projects = sortProjects(data.projects)

  const checklist = useMemo(
    () =>
      data.checklistItems
        .filter((item) => item.taskId === selectedTaskId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [data.checklistItems, selectedTaskId]
  )

  const children = task ? getChildTasks(data, task.id) : []
  const taskTagNames = task ? getTaskTags(data, task.id) : []

  const dependencyOptions = useMemo(
    () =>
      data.tasks.filter(
        (item) => item.id !== selectedTaskId && item.status === 'todo' && item.parentId === null
      ),
    [data.tasks, selectedTaskId]
  )

  if (!task) return null

  const save = async (next: typeof data): Promise<void> => {
    await persist(next)
  }

  const handleField = async (
    patch: Partial<{
      title: string
      description: string
      dueDate: string | null
      dueTime: string | null
      dependsOnTaskId: string | null
      pinned: boolean
      archived: boolean
      priority: Priority
      projectId: string | null
      recurrence: Recurrence
    }>
  ): Promise<void> => {
    const current = useAppStore.getState().data
    await save(updateTask(current, task.id, patch))
  }

  const handleDelete = async (): Promise<void> => {
    if (!confirm('Удалить задачу и все подзадачи?')) return
    const next = deleteTaskTree(data, task.id)
    await save(next)
    setSelectedTaskId(null)
  }

  const handleAddSubtask = async (): Promise<void> => {
    const title = subtaskTitle.trim()
    if (!title) return
    await save(createSubtask(data, task, title))
    setSubtaskTitle('')
  }

  const handleAddChecklist = async (): Promise<void> => {
    const text = checklistText.trim()
    if (!text) return
    await save(addChecklistItem(data, task.id, text))
    setChecklistText('')
  }

  const handleAddTag = async (): Promise<void> => {
    const name = newTagName.trim()
    if (!name) return
    let next = createTag(data, name)
    const tag = next.tags.find((item) => item.name.toLowerCase() === name.toLowerCase())
    if (tag) next = toggleTaskTag(next, task.id, tag.id)
    await save(next)
    setNewTagName('')
  }

  return (
    <aside className="flex h-full w-96 flex-col border-l border-surface-border bg-surface-elevated">
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <h3 className="font-medium">Детали задачи</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="rounded p-1.5 text-gray-400 hover:bg-red-950/40 hover:text-red-300"
            title="Удалить"
          >
            <Trash2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => setSelectedTaskId(null)}
            className="rounded p-1.5 text-gray-400 hover:bg-surface-border/60 hover:text-gray-200"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Название</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              if (title.trim() && title !== task.title) void handleField({ title: title.trim() })
            }}
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">Описание</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => {
              if (description !== task.description) void handleField({ description })
            }}
            rows={4}
            placeholder="Добавьте описание..."
            className="w-full resize-none rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Срок</label>
            <input
              type="date"
              value={task.dueDate ?? ''}
              onChange={(event) =>
                void handleField({ dueDate: event.target.value || null })
              }
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Время</label>
            <input
              type="time"
              value={task.dueTime ?? ''}
              onChange={(event) =>
                void handleField({ dueTime: event.target.value || null })
              }
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Приоритет</label>
            <select
              value={task.priority}
              onChange={(event) =>
                void handleField({ priority: event.target.value as Priority })
              }
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="normal">Обычный</option>
              <option value="important">Важный</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Зависит от</label>
            <select
              value={task.dependsOnTaskId ?? ''}
              onChange={(event) =>
                void handleField({ dependsOnTaskId: event.target.value || null })
              }
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">Нет зависимости</option>
              {dependencyOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleField({ pinned: !task.pinned })}
            className={clsx(
              'inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm transition',
              task.pinned
                ? 'border-amber-700/50 bg-amber-950/30 text-amber-300'
                : 'border-surface-border text-gray-400 hover:text-gray-200'
            )}
          >
            <Pin size={14} /> {task.pinned ? 'Закреплена' : 'Закрепить'}
          </button>
          <button
            type="button"
            onClick={() => void handleField({ archived: !task.archived })}
            className={clsx(
              'inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm transition',
              task.archived
                ? 'border-gray-600 bg-surface text-gray-200'
                : 'border-surface-border text-gray-400 hover:text-gray-200'
            )}
          >
            <Archive size={14} /> {task.archived ? 'В архиве' : 'В архив'}
          </button>
          <button
            type="button"
            onClick={async () => {
              const raw = prompt('Напомнить через сколько часов?', '2')
              if (!raw?.trim()) return
              const hours = Number(raw)
              if (!Number.isFinite(hours) || hours <= 0) {
                alert('Введите положительное число часов')
                return
              }
              await save(addReminderInHours(data, task.id, hours))
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-surface-border px-3 py-2 text-sm text-gray-300 hover:bg-surface"
          >
            <Bell size={14} /> Напомнить через N часов
          </button>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">Повторение</label>
          <select
            value={task.recurrence}
            onChange={(event) =>
              void handleField({ recurrence: event.target.value as Recurrence })
            }
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="none">Не повторять</option>
            <option value="daily">Ежедневно</option>
            <option value="weekly">Еженедельно</option>
            <option value="monthly">Ежемесячно</option>
          </select>
          {task.recurrenceExceptions.length > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              Исключений повторения: {task.recurrenceExceptions.length}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">Проект</label>
          <select
            value={task.projectId ?? ''}
            onChange={(event) =>
              void handleField({ projectId: event.target.value || null })
            }
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">Входящие</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs text-gray-500">Теги</label>
          <div className="flex flex-wrap gap-2">
            {data.tags.map((tag) => {
              const active = data.taskTags.some(
                (link) => link.taskId === task.id && link.tagId === tag.id
              )
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => void save(toggleTaskTag(data, task.id, tag.id))}
                  className={clsx(
                    'rounded-full px-2.5 py-1 text-xs transition',
                    active
                      ? 'bg-accent-muted text-blue-300'
                      : 'bg-surface border border-surface-border text-gray-400'
                  )}
                >
                  #{tag.name}
                </button>
              )
            })}
          </div>
          {taskTagNames.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">Выбрано: {taskTagNames.join(', ')}</p>
          )}
          <div className="mt-2 flex gap-2">
            <input
              value={newTagName}
              onChange={(event) => setNewTagName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleAddTag()
              }}
              placeholder="Новый тег"
              className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => void handleAddTag()}
              className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-gray-300"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs text-gray-500">Чеклист</label>
          <div className="space-y-1">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => void save(toggleChecklistItem(data, item.id))}
                />
                <span
                  className={clsx(
                    'flex-1 text-sm',
                    item.completed && 'text-gray-500 line-through'
                  )}
                >
                  {item.text}
                </span>
                <button
                  type="button"
                  onClick={() => void save(removeChecklistItem(data, item.id))}
                  className="text-gray-500 hover:text-red-300"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={checklistText}
              onChange={(event) => setChecklistText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleAddChecklist()
              }}
              placeholder="Пункт чеклиста"
              className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => void handleAddChecklist()}
              className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-gray-300"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            const name = prompt('Название шаблона', task.title)
            if (!name?.trim()) return
            const tagIds = data.taskTags
              .filter((l) => l.taskId === task.id)
              .map((l) => l.tagId)
            const checklistTexts = checklist.map((c) => c.text)
            await save(
              createTemplate(data, {
                name: name.trim(),
                title: task.title,
                description: task.description,
                priority: task.priority,
                projectId: task.projectId,
                tagIds,
                checklistTexts
              })
            )
            onSaveAsTemplate()
          }}
          className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-gray-300 hover:bg-surface"
        >
          Сохранить как шаблон
        </button>

        <div>
          <label className="mb-2 block text-xs text-gray-500">Подзадачи</label>
          {children.length === 0 ? (
            <p className="text-xs text-gray-500">Подзадач пока нет</p>
          ) : (
            <div className="space-y-1">
              {children.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => useAppStore.getState().setSelectedTaskId(child.id)}
                  className="flex w-full items-center rounded-lg border border-surface-border px-3 py-2 text-left text-sm hover:bg-surface"
                >
                  <span className={clsx(child.status === 'done' && 'line-through text-gray-500')}>
                    {child.title}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <input
              value={subtaskTitle}
              onChange={(event) => setSubtaskTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleAddSubtask()
              }}
              placeholder="Новая подзадача"
              className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => void handleAddSubtask()}
              className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-gray-300"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}