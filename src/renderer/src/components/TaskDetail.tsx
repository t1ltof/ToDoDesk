import { Archive, Bell, FolderKanban, Paperclip, Pin, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Priority, Recurrence } from '../../../shared/schema'
import MarkdownContent from './MarkdownContent'
import { addTaskAttachment, getTaskAttachments, removeTaskAttachment } from '../utils/attachmentHelpers'
import { createProjectFromTaskBranch } from '../utils/projectBranchHelpers'
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
import {
  getTaskDraft,
  removeTaskDraft,
  upsertTaskDraft
} from '../utils/draftHelpers'
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
  const [descriptionMode, setDescriptionMode] = useState<'edit' | 'preview'>('edit')
  const [dragOver, setDragOver] = useState(false)
  const [showDraftBanner, setShowDraftBanner] = useState(false)
  const [dueTimeDraft, setDueTimeDraft] = useState('')
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [reminderHours, setReminderHours] = useState('2')
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const task = data.tasks.find((item) => item.id === selectedTaskId)
  const draft = task ? getTaskDraft(data, task.id) : null

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description)
      setDueTimeDraft(task.dueTime ?? '')
      const existingDraft = getTaskDraft(data, task.id)
      setShowDraftBanner(
        Boolean(
          existingDraft &&
            (existingDraft.title !== task.title || existingDraft.description !== task.description) &&
            existingDraft.updatedAt > task.updatedAt
        )
      )
    }
  }, [task?.id, task?.title, task?.description, task?.dueTime, task?.updatedAt, data.drafts])
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
  const attachments = task ? getTaskAttachments(data, task.id) : []

  const dependencyOptions = useMemo(
    () =>
      data.tasks.filter(
        (item) => item.id !== selectedTaskId && item.status === 'todo' && item.parentId === null
      ),
    [data.tasks, selectedTaskId]
  )

  useEffect(() => {
    if (!task) return

    const hasUnsaved = title.trim() !== task.title || description !== task.description
    void window.tododesk.setUnsavedChanges(hasUnsaved)

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    if (!hasUnsaved) return

    draftTimerRef.current = setTimeout(() => {
      const current = useAppStore.getState().data
      const currentTask = current.tasks.find((item) => item.id === task.id)
      if (!currentTask) return
      if (title.trim() === currentTask.title && description === currentTask.description) return
      void persist(
        upsertTaskDraft(current, task.id, title.trim() || currentTask.title, description),
        { clearUnsaved: false }
      )
    }, 2000)

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [task, title, description, persist])

  if (!task) return null

  const save = async (next: typeof data): Promise<void> => {
    await persist(next, { clearUnsaved: true })
  }

  const handleField = async (
    patch: Partial<{
      title: string
      description: string
      dueDate: string | null
      dueDateEnd: string | null
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
    let next = updateTask(current, task.id, patch)
    if (patch.title !== undefined || patch.description !== undefined) {
      next = removeTaskDraft(next, task.id)
      setShowDraftBanner(false)
    }
    await save(next)
    void window.tododesk.setUnsavedChanges(false)
  }

  const restoreDraft = (): void => {
    if (!draft) return
    setTitle(draft.title)
    setDescription(draft.description)
    setShowDraftBanner(false)
  }

  const discardDraft = async (): Promise<void> => {
    if (!task) return
    const current = useAppStore.getState().data
    await save(removeTaskDraft(current, task.id))
    setShowDraftBanner(false)
  }

  const handleDelete = async (): Promise<void> => {
    if (!confirm('Удалить задачу и все подзадачи?')) return
    const current = useAppStore.getState().data
    const next = deleteTaskTree(current, task.id)
    await save(next)
    setSelectedTaskId(null)
  }

  const handleAddSubtask = async (): Promise<void> => {
    const title = subtaskTitle.trim()
    if (!title) return
    const current = useAppStore.getState().data
    const currentTask = current.tasks.find((item) => item.id === task.id) ?? task
    await save(createSubtask(current, currentTask, title))
    setSubtaskTitle('')
  }

  const handleAddChecklist = async (): Promise<void> => {
    const text = checklistText.trim()
    if (!text) return
    const current = useAppStore.getState().data
    await save(addChecklistItem(current, task.id, text))
    setChecklistText('')
  }

  const handleAttachFile = async (sourcePath: string, fileName?: string): Promise<void> => {
    const stored = await window.tododesk.copyAttachmentFile(sourcePath, fileName)
    const current = useAppStore.getState().data
    await save(addTaskAttachment(current, task.id, stored.fileName, stored.filePath))
  }

  const handlePickAttachment = async (): Promise<void> => {
    const picked = await window.tododesk.pickAttachmentFile()
    if (!picked) return
    const current = useAppStore.getState().data
    await save(addTaskAttachment(current, task.id, picked.fileName, picked.filePath))
  }

  const handleAddTag = async (): Promise<void> => {
    const name = newTagName.trim()
    if (!name) return
    const current = useAppStore.getState().data
    let next = createTag(current, name)
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
        {showDraftBanner && draft && (
          <div className="rounded-lg border border-amber-700/40 bg-amber-950/30 p-3 text-sm">
            <p className="text-amber-200">Найден черновик от {new Date(draft.updatedAt).toLocaleString('ru-RU')}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={restoreDraft}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs text-white"
              >
                Восстановить
              </button>
              <button
                type="button"
                onClick={() => void discardDraft()}
                className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-gray-300"
              >
                Отклонить
              </button>
            </div>
          </div>
        )}

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
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs text-gray-500">Описание</label>
            <button
              type="button"
              onClick={() =>
                setDescriptionMode((mode) => (mode === 'edit' ? 'preview' : 'edit'))
              }
              className="text-xs text-blue-300 hover:underline"
            >
              {descriptionMode === 'edit' ? 'Просмотр' : 'Редактирование'}
            </button>
          </div>
          {descriptionMode === 'edit' ? (
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={() => {
                if (description !== task.description) void handleField({ description })
              }}
              rows={4}
              placeholder="Добавьте описание... Поддерживается **жирный**, *курсив*, `код`, списки"
              className="w-full resize-none rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
          ) : (
            <div className="min-h-[6rem] rounded-lg border border-surface-border bg-surface px-3 py-2">
              {description.trim() ? (
                <MarkdownContent text={description} />
              ) : (
                <p className="text-sm text-gray-500">Описание пустое</p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs text-gray-500">Вложения</label>
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragOver(false)
              const files = Array.from(event.dataTransfer.files)
              for (const file of files) {
                const electronFile = file as File & { path?: string }
                if (electronFile.path) {
                  void handleAttachFile(electronFile.path, electronFile.name)
                }
              }
            }}
            className={clsx(
              'rounded-lg border border-dashed px-3 py-4 transition',
              dragOver
                ? 'border-accent bg-accent-muted/30'
                : 'border-surface-border bg-surface/40'
            )}
          >
            <button
              type="button"
              onClick={() => void handlePickAttachment()}
              className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm text-gray-300 hover:bg-surface"
            >
              <Paperclip size={14} /> Прикрепить файл
            </button>
            <p className="mt-2 text-xs text-gray-500">Или перетащите файл сюда</p>
          </div>

          {attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 rounded-lg border border-surface-border px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => void window.tododesk.openAttachmentPath(attachment.filePath)}
                    className="flex-1 truncate text-left text-sm text-blue-300 hover:underline"
                  >
                    {attachment.fileName}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const current = useAppStore.getState().data
                      void save(removeTaskAttachment(current, attachment.id))
                    }}
                    className="text-gray-500 hover:text-red-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
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
            <label className="mb-1 block text-xs text-gray-500">Конец срока (необязательно)</label>
            <input
              type="date"
              value={task.dueDateEnd ?? ''}
              onChange={(event) =>
                void handleField({ dueDateEnd: event.target.value || null })
              }
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">Время</label>
          <input
            type="time"
            value={dueTimeDraft}
            onChange={(event) => setDueTimeDraft(event.target.value)}
            onBlur={() => {
              const value = dueTimeDraft || null
              if (value !== task.dueTime) void handleField({ dueTime: value })
            }}
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
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
            onClick={() => setShowReminderForm((value) => !value)}
            className={clsx(
              'inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm transition',
              showReminderForm
                ? 'border-accent bg-accent-muted/30 text-blue-300'
                : 'border-surface-border text-gray-300 hover:bg-surface'
            )}
          >
            <Bell size={14} /> Напомнить через N часов
          </button>
        </div>

        {showReminderForm && (
          <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface/40 px-3 py-2">
            <label className="shrink-0 text-xs text-gray-500">Через</label>
            <input
              type="number"
              min={1}
              step={1}
              value={reminderHours}
              onChange={(event) => setReminderHours(event.target.value)}
              className="w-20 rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
            <span className="text-xs text-gray-500">ч.</span>
            <button
              type="button"
              onClick={async () => {
                const hours = Number(reminderHours)
                if (!Number.isFinite(hours) || hours <= 0) {
                  alert('Введите положительное число часов')
                  return
                }
                const remindAt = new Date(Date.now() + hours * 3_600_000)
                const current = useAppStore.getState().data
                await save(addReminderInHours(current, task.id, hours))
                alert(
                  `Напоминание добавлено на ${remindAt.toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}`
                )
                setShowReminderForm(false)
              }}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs text-white"
            >
              Добавить
            </button>
            <button
              type="button"
              onClick={() => setShowReminderForm(false)}
              className="rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:text-gray-300"
            >
              Отмена
            </button>
          </div>
        )}

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
            <option value="weekdays">По будням</option>
            <option value="weekends">По выходным</option>
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
                  onClick={() => {
                    const current = useAppStore.getState().data
                    void save(toggleTaskTag(current, task.id, tag.id))
                  }}
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
                  onChange={() => {
                    const current = useAppStore.getState().data
                    void save(toggleChecklistItem(current, item.id))
                  }}
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
                  onClick={() => {
                    const current = useAppStore.getState().data
                    void save(removeChecklistItem(current, item.id))
                  }}
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
            const name = prompt('Название проекта', `${task.title}`)
            if (!name?.trim()) return
            const current = useAppStore.getState().data
            const next = createProjectFromTaskBranch(current, task.id, name.trim())
            const project = next.projects[next.projects.length - 1]
            await save(next)
            if (project) useAppStore.getState().setActiveView(`project:${project.id}`)
          }}
          className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-gray-300 hover:bg-surface"
        >
          <span className="inline-flex items-center gap-2">
            <FolderKanban size={14} /> Создать проект из ветки
          </span>
        </button>

        {showTemplateDialog ? (
          <div className="rounded-lg border border-surface-border bg-surface/40 p-3">
            <label className="mb-1 block text-xs text-gray-500">Название шаблона</label>
            <input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.form?.requestSubmit()
              }}
              placeholder={task.title}
              className="mb-2 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  const name = templateName.trim() || task.title
                  if (!name) return
                  const current = useAppStore.getState().data
                  const tagIds = current.taskTags
                    .filter((l) => l.taskId === task.id)
                    .map((l) => l.tagId)
                  const checklistTexts = checklist.map((c) => c.text)
                  await save(
                    createTemplate(current, {
                      name,
                      title: task.title,
                      description: task.description,
                      priority: task.priority,
                      projectId: task.projectId,
                      tagIds,
                      checklistTexts
                    })
                  )
                  setShowTemplateDialog(false)
                  setTemplateName('')
                  alert('Шаблон сохранён. Откройте Настройки → Шаблоны задач')
                  onSaveAsTemplate()
                }}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs text-white"
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTemplateDialog(false)
                  setTemplateName('')
                }}
                className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-gray-300"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setTemplateName(task.title)
              setShowTemplateDialog(true)
            }}
            className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-gray-300 hover:bg-surface"
          >
            Сохранить как шаблон
          </button>
        )}

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