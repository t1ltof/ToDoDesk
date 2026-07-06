import { useEffect, useState } from 'react'
import type { ViewId } from '../../../shared/schema'
import { todayKey } from '../utils/calendarUtils'
import { createRootTask } from '../utils/taskHelpers'
import { useAppStore } from '../store/useAppStore'

interface PasteTasksDialogProps {
  open: boolean
  onClose: () => void
  view: ViewId
}

function getContextForView(view: ViewId): { projectId: string | null; dueDate: string | null } {
  if (view.startsWith('project:')) {
    return { projectId: view.replace('project:', ''), dueDate: null }
  }
  if (view === 'today') {
    return { projectId: null, dueDate: todayKey() }
  }
  if (view === 'inbox') {
    return { projectId: null, dueDate: null }
  }
  return { projectId: null, dueDate: null }
}

export default function PasteTasksDialog({
  open,
  onClose,
  view
}: PasteTasksDialogProps): JSX.Element | null {
  const { data, persist } = useAppStore()
  const [text, setText] = useState('')

  useEffect(() => {
    if (!open) return
    void navigator.clipboard.readText().then((clip) => setText(clip)).catch(() => setText(''))
  }, [open])

  if (!open) return null

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const handleSubmit = async (): Promise<void> => {
    if (lines.length === 0) {
      onClose()
      return
    }

    const context = getContextForView(view)
    let next = useAppStore.getState().data
    for (const title of lines) {
      next = createRootTask(next, { title, ...context })
    }
    await persist(next)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-surface-border bg-surface-elevated p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Вставить список задач</h3>
        <p className="mt-1 text-sm text-gray-400">
          Каждая непустая строка станет отдельной задачей в текущем контексте.
        </p>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
          placeholder="Строка 1&#10;Строка 2&#10;..."
          className="mt-4 w-full resize-none rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />

        <p className="mt-2 text-xs text-gray-500">Будет создано задач: {lines.length}</p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-surface-border px-4 py-2 text-sm text-gray-300"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={lines.length === 0}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Создать {lines.length > 0 ? `(${lines.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}