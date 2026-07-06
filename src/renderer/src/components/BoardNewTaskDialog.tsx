import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { sortProjects, useAppStore } from '../store/useAppStore'

interface BoardNewTaskDialogProps {
  onClose: () => void
  onCreate: (title: string, projectId: string | null) => void
  defaultProjectId?: string | null
}

export default function BoardNewTaskDialog({
  onClose,
  onCreate,
  defaultProjectId = null
}: BoardNewTaskDialogProps): JSX.Element {
  const { data } = useAppStore()
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const projects = sortProjects(data.projects)

  useEffect(() => {
    setTitle('')
    setProjectId(defaultProjectId ?? '')
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [defaultProjectId])

  const handleSubmit = (): void => {
    const trimmed = title.trim()
    if (!trimmed) return
    onCreate(trimmed, projectId || null)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <h3 className="font-semibold">Новая задача на доске</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-surface-border">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1.5 block text-xs text-gray-400">Название</label>
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
                if (e.key === 'Escape') onClose()
              }}
              placeholder="Что нужно сделать?"
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-gray-400">Проект</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
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

          <p className="text-xs text-gray-500">
            Задача будет создана в приложении и сразу появится на доске.
          </p>

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
              disabled={!title.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              Создать
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}