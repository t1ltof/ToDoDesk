import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Tag } from '../../../shared/schema'
import { deleteTag, renameTag } from '../utils/tagHelpers'
import { useAppStore } from '../store/useAppStore'

interface TagManageDialogProps {
  tag: Tag
  onClose: () => void
}

export default function TagManageDialog({ tag, onClose }: TagManageDialogProps): JSX.Element {
  const { data, persist, activeView, setActiveView } = useAppStore()
  const [name, setName] = useState(tag.name)

  const handleSave = async (): Promise<void> => {
    const current = useAppStore.getState().data
    await persist(renameTag(current, tag.id, name))
    onClose()
  }

  const handleDelete = async (): Promise<void> => {
    if (!confirm(`Удалить тег #${tag.name}?`)) return
    const current = useAppStore.getState().data
    await persist(deleteTag(current, tag.id))
    if (activeView === `tag:${tag.id}`) setActiveView('all')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-elevated p-6 shadow-xl">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Pencil size={18} /> Редактировать тег
        </h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-4 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
        />
        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="inline-flex items-center gap-1 rounded-lg border border-red-800/50 px-3 py-2 text-sm text-red-300"
          >
            <Trash2 size={14} /> Удалить
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-surface-border px-4 py-2 text-sm">
              Отмена
            </button>
            <button type="button" onClick={() => void handleSave()} className="rounded-lg bg-accent px-4 py-2 text-sm text-white">
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}