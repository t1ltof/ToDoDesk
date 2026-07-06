import { useEffect, useRef, useState } from 'react'
import { todayKey } from '../utils/calendarUtils'
import { createRootTask } from '../utils/taskHelpers'
import { useAppStore } from '../store/useAppStore'

interface QuickAddDialogProps {
  open: boolean
  onClose: () => void
}

export default function QuickAddDialog({ open, onClose }: QuickAddDialogProps): JSX.Element | null {
  const { data, persist } = useAppStore()
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTitle('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  if (!open) return null

  const handleSubmit = async (): Promise<void> => {
    const trimmed = title.trim()
    if (!trimmed) {
      onClose()
      return
    }

    const today = todayKey()
    const current = useAppStore.getState().data
    const next = createRootTask(current, {
      title: trimmed,
      projectId: null,
      dueDate: today
    })

    await persist(next)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-surface-border bg-surface-elevated p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Быстрое добавление</h3>
        <p className="mt-1 text-sm text-gray-400">
          Задача попадёт во «Входящие» с датой на сегодня. Хоткей: Ctrl+Shift+T
        </p>

        <input
          ref={inputRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleSubmit()
            if (event.key === 'Escape') onClose()
          }}
          placeholder="Что нужно сделать?"
          className="mt-4 w-full rounded-lg border border-surface-border bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
        />

        <div className="mt-4 flex justify-end gap-2">
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
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}