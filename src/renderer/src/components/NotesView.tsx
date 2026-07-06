import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Note } from '../../../shared/schema'
import MarkdownContent from './MarkdownContent'
import { filterNotes } from '../utils/calendarFilters'
import { createNote, deleteNote, updateNote } from '../utils/noteHelpers'
import { useAppStore } from '../store/useAppStore'
import clsx from 'clsx'

export default function NotesView(): JSX.Element {
  const { data, persist } = useAppStore()
  const [selectedId, setSelectedId] = useState<string | null>(data.notes[0]?.id ?? null)
  const [newTitle, setNewTitle] = useState('')
  const [contentMode, setContentMode] = useState<'edit' | 'preview'>('edit')
  const [notesSearch, setNotesSearch] = useState('')

  const notes = useMemo(() => {
    const filtered = filterNotes(data, notesSearch)
    return [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [data, notesSearch])

  const selected = notes.find((n) => n.id === selectedId) ?? null

  const handleCreate = async (): Promise<void> => {
    const title = newTitle.trim() || 'Без названия'
    const current = useAppStore.getState().data
    const next = createNote(current, title)
    await persist(next)
    setSelectedId(next.notes[0]?.id ?? null)
    setNewTitle('')
  }

  const handleUpdate = async (patch: Partial<Pick<Note, 'title' | 'content'>>): Promise<void> => {
    if (!selected) return
    const current = useAppStore.getState().data
    await persist(updateNote(current, selected.id, patch))
  }

  const handleDelete = async (): Promise<void> => {
    if (!selected) return
    if (!confirm(`Удалить заметку «${selected.title}»?`)) return
    const current = useAppStore.getState().data
    const next = deleteNote(current, selected.id)
    await persist(next)
    setSelectedId(next.notes[0]?.id ?? null)
  }

  return (
    <section className="flex h-full flex-1 overflow-hidden">
      <div className="flex w-72 flex-col border-r border-surface-border bg-surface-elevated">
        <div className="border-b border-surface-border p-4">
          <h2 className="text-lg font-semibold">Заметки</h2>
          <input
            data-testid="notes-search"
            value={notesSearch}
            onChange={(e) => setNotesSearch(e.target.value)}
            placeholder="Поиск по названию и тексту..."
            className="mt-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="mt-3 flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate()
              }}
              placeholder="Новая заметка"
              className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              className="rounded-lg bg-accent px-3 py-2 text-white"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {notes.length === 0 ? (
            <p className="px-2 py-4 text-sm text-gray-500">Заметок пока нет</p>
          ) : (
            notes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => setSelectedId(note.id)}
                className={clsx(
                  'mb-1 w-full rounded-lg px-3 py-2 text-left transition',
                  selectedId === note.id
                    ? 'bg-accent-muted text-blue-300'
                    : 'text-gray-300 hover:bg-surface-border/60'
                )}
              >
                <p className="truncate text-sm font-medium">{note.title}</p>
                <p className="truncate text-xs text-gray-500">
                  {new Date(note.updatedAt).toLocaleString('ru-RU')}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        {selected ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-4">
              <input
                value={selected.title}
                onChange={(e) => void handleUpdate({ title: e.target.value })}
                className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-lg font-semibold outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="rounded-lg border border-red-800/50 p-2 text-red-300 hover:bg-red-950/30"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setContentMode((mode) => (mode === 'edit' ? 'preview' : 'edit'))}
                className="text-xs text-blue-300 hover:underline"
              >
                {contentMode === 'edit' ? 'Просмотр' : 'Редактирование'}
              </button>
            </div>
            {contentMode === 'edit' ? (
              <textarea
                value={selected.content}
                onChange={(e) => void handleUpdate({ content: e.target.value })}
                placeholder="Текст заметки... Поддерживается Markdown"
                className="min-h-0 flex-1 resize-none rounded-xl border border-surface-border bg-surface-elevated p-4 text-sm leading-relaxed outline-none focus:border-accent"
              />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-surface-border bg-surface-elevated p-4">
                {selected.content.trim() ? (
                  <MarkdownContent text={selected.content} />
                ) : (
                  <p className="text-sm text-gray-500">Заметка пустая</p>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-500">
            Выберите заметку или создайте новую
          </div>
        )}
      </div>
    </section>
  )
}