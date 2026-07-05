import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { applyTemplate, createTemplate, deleteTemplate } from '../utils/templateHelpers'
import { useAppStore } from '../store/useAppStore'

interface TemplatesDialogProps {
  onClose: () => void
}

export default function TemplatesDialog({ onClose }: TemplatesDialogProps): JSX.Element {
  const { data, persist } = useAppStore()
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')

  const handleCreate = async (): Promise<void> => {
    if (!name.trim() || !title.trim()) return
    await persist(
      createTemplate(data, {
        name: name.trim(),
        title: title.trim(),
        description: '',
        priority: 'normal',
        projectId: null,
        tagIds: [],
        checklistTexts: []
      })
    )
    setName('')
    setTitle('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface-elevated p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Шаблоны задач</h3>

        <div className="mt-4 space-y-2">
          {data.templates.length === 0 ? (
            <p className="text-sm text-gray-500">Шаблонов пока нет</p>
          ) : (
            data.templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between rounded-lg border border-surface-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{tpl.name}</p>
                  <p className="text-xs text-gray-500">{tpl.title}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => void persist(applyTemplate(data, tpl.id))}
                    className="rounded px-2 py-1 text-xs text-blue-300 hover:bg-accent-muted"
                  >
                    Применить
                  </button>
                  <button
                    type="button"
                    onClick={() => void persist(deleteTemplate(data, tpl.id))}
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
            placeholder="Название шаблона"
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок задачи"
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