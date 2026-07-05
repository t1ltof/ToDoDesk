import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface BoardInputDialogProps {
  open: boolean
  title: string
  label: string
  defaultValue?: string
  placeholder?: string
  submitLabel?: string
  onClose: () => void
  onSubmit: (value: string) => void
}

export default function BoardInputDialog({
  open,
  title,
  label,
  defaultValue = '',
  placeholder,
  submitLabel = 'Создать',
  onClose,
  onSubmit
}: BoardInputDialogProps): JSX.Element | null {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue(defaultValue)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, defaultValue])

  if (!open) return null

  const handleSubmit = (): void => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <h3 className="font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-surface-border">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1.5 block text-xs text-gray-400">{label}</label>
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
                if (e.key === 'Escape') onClose()
              }}
              placeholder={placeholder}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-surface-border"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!value.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}