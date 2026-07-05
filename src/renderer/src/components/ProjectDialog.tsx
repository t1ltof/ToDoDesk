import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useAppStore } from '../store/useAppStore'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4']

interface ProjectDialogProps {
  onClose: () => void
}

export default function ProjectDialog({ onClose }: ProjectDialogProps): JSX.Element {
  const { data, persist, setActiveView } = useAppStore()
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])

  const handleCreate = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) return

    const project = {
      id: uuidv4(),
      name: trimmed,
      color,
      sortOrder: data.projects.length,
      archived: false
    }

    await persist({ ...data, projects: [...data.projects, project] })
    setActiveView(`project:${project.id}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-elevated p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Новый проект</h3>

        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleCreate()
          }}
          placeholder="Название проекта"
          autoFocus
          className="mt-4 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />

        <div className="mt-4 flex gap-2">
          {COLORS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setColor(value)}
              className="h-7 w-7 rounded-full border-2 transition"
              style={{
                backgroundColor: value,
                borderColor: color === value ? '#fff' : 'transparent'
              }}
            />
          ))}
        </div>

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
            onClick={() => void handleCreate()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  )
}