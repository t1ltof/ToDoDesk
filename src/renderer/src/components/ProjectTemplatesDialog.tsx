import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  applyProjectTemplate,
  createProjectTemplate,
  deleteProjectTemplate
} from '../utils/projectTemplateHelpers'
import { useAppStore } from '../store/useAppStore'

interface ProjectTemplatesDialogProps {
  onClose: () => void
}

export default function ProjectTemplatesDialog({
  onClose
}: ProjectTemplatesDialogProps): JSX.Element {
  const { data, persist, setActiveView } = useAppStore()
  const [name, setName] = useState('')
  const [taskTitle, setTaskTitle] = useState('')

  const handleCreate = async (): Promise<void> => {
    if (!name.trim()) return
    const tasks = taskTitle.trim()
      ? [{ title: taskTitle.trim(), description: '', priority: 'normal' as const, checklistTexts: [] }]
      : []

    await persist(
      createProjectTemplate(data, {
        name: name.trim(),
        description: '',
        projectColor: '#3b82f6',
        projectIcon: '',
        tasks
      })
    )
    setName('')
    setTaskTitle('')
  }

  const handleApply = async (templateId: string): Promise<void> => {
    const next = applyProjectTemplate(data, templateId)
    await persist(next)
    const project = next.projects[next.projects.length - 1]
    if (project) setActiveView(`project:${project.id}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-surface-border bg-surface-elevated p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Шаблоны проектов</h3>
        <p className="mt-1 text-sm text-gray-400">
          Применение создаёт проект и задачи из шаблона
        </p>

        <div className="mt-4 space-y-2">
          {data.projectTemplates.length === 0 ? (
            <p className="text-sm text-gray-500">Шаблонов проектов пока нет</p>
          ) : (
            data.projectTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between rounded-lg border border-surface-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {tpl.projectIcon ? `${tpl.projectIcon} ` : ''}
                    {tpl.name}
                  </p>
                  <p className="text-xs text-gray-500">{tpl.tasks.length} задач(и)</p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => void handleApply(tpl.id)}
                    className="rounded px-2 py-1 text-xs text-blue-300 hover:bg-accent-muted"
                  >
                    Применить
                  </button>
                  <button
                    type="button"
                    onClick={() => void persist(deleteProjectTemplate(data, tpl.id))}
                    className="rounded p-1 text-gray-500 hover:text-red-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 space-y-2 border-t border-surface-border pt-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название шаблона / проекта"
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
          />
          <input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Первая задача (необязательно)"
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-sm text-white"
          >
            <Plus size={14} /> Создать шаблон
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg border border-surface-border px-4 py-2 text-sm">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}