import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Project } from '../../../shared/schema'
import { deleteProject, updateProject } from '../utils/projectHelpers'
import { useAppStore } from '../store/useAppStore'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4']

interface ProjectDialogProps {
  onClose: () => void
  project?: Project
}

export default function ProjectDialog({ onClose, project }: ProjectDialogProps): JSX.Element {
  const { data, persist, setActiveView, activeView } = useAppStore()
  const isEdit = Boolean(project)
  const [name, setName] = useState(project?.name ?? '')
  const [color, setColor] = useState(project?.color ?? COLORS[0])
  const [icon, setIcon] = useState(project?.icon ?? '')

  useEffect(() => {
    if (project) {
      setName(project.name)
      setColor(project.color)
      setIcon(project.icon ?? '')
    }
  }, [project])

  const handleSave = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) return

    if (isEdit && project) {
      await persist(updateProject(data, project.id, { name: trimmed, color, icon: icon.trim() }))
    } else {
      const created = {
        id: uuidv4(),
        name: trimmed,
        color,
        icon: icon.trim(),
        sortOrder: data.projects.length,
        archived: false
      }
      await persist({ ...data, projects: [...data.projects, created] })
      setActiveView(`project:${created.id}`)
    }

    onClose()
  }

  const handleDelete = async (): Promise<void> => {
    if (!project) return
    if (!confirm(`Удалить проект «${project.name}»? Задачи переместятся во Входящие.`)) return

    await persist(deleteProject(data, project.id))
    if (activeView === `project:${project.id}`) setActiveView('inbox')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-elevated p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{isEdit ? 'Редактировать проект' : 'Новый проект'}</h3>

        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleSave()
          }}
          placeholder="Название проекта"
          autoFocus
          className="mt-4 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />

        <div className="mt-3">
          <p className="mb-1 text-xs text-gray-500">Иконка (эмодзи)</p>
          <input
            value={icon}
            onChange={(event) => setIcon(event.target.value)}
            placeholder="📁"
            maxLength={4}
            className="w-20 rounded-lg border border-surface-border bg-surface px-3 py-2 text-center text-lg"
          />
        </div>

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

        <div className="mt-6 flex justify-between gap-2">
          {isEdit ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="rounded-lg border border-red-800/60 px-4 py-2 text-sm text-red-300 hover:bg-red-950/40"
            >
              Удалить
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-surface-border px-4 py-2 text-sm text-gray-300"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              {isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}