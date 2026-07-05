import { useState } from 'react'
import type { ImportPreview } from '../../../shared/import'
import { useAppStore } from '../store/useAppStore'
import clsx from 'clsx'

interface ImportDialogProps {
  preview: ImportPreview
  onClose: () => void
}

type ImportMode = 'replace' | 'new-project'

export default function ImportDialog({ preview, onClose }: ImportDialogProps): JSX.Element {
  const { load, setActiveView } = useAppStore()
  const [mode, setMode] = useState<ImportMode>('new-project')
  const [importing, setImporting] = useState(false)

  const exportedDate = new Date(preview.exportedAt).toLocaleString('ru-RU')

  const handleImport = async (): Promise<void> => {
    setImporting(true)
    try {
      await window.tododesk.importFile(preview.filePath, mode)
      await load()
      if (mode === 'new-project') setActiveView('all')
      onClose()
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface-elevated p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Импорт данных</h3>
        <p className="mt-1 text-sm text-gray-400">Файл: {preview.filePath.split(/[/\\]/).pop()}</p>
        <p className="text-sm text-gray-400">Экспортирован: {exportedDate}</p>

        <div className="mt-4 rounded-lg border border-surface-border bg-surface p-3 text-sm text-gray-300">
          <p>{preview.projectCount} проект(ов)</p>
          <p>{preview.taskCount} задач ({preview.doneCount} выполнено)</p>
          <p>{preview.tagCount} тег(ов)</p>
        </div>

        <div className="mt-4 space-y-2">
          <label
            className={clsx(
              'flex cursor-pointer gap-3 rounded-lg border p-3 transition',
              mode === 'new-project' ? 'border-accent bg-accent-muted' : 'border-surface-border'
            )}
          >
            <input
              type="radio"
              name="import-mode"
              checked={mode === 'new-project'}
              onChange={() => setMode('new-project')}
              className="mt-1"
            />
            <div>
              <p className="text-sm font-medium">Импортировать как новый проект</p>
              <p className="text-xs text-gray-400">
                Текущие данные сохранятся, задачи из файла попадут в новый проект
              </p>
            </div>
          </label>

          <label
            className={clsx(
              'flex cursor-pointer gap-3 rounded-lg border p-3 transition',
              mode === 'replace' ? 'border-red-500/60 bg-red-950/30' : 'border-surface-border'
            )}
          >
            <input
              type="radio"
              name="import-mode"
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
              className="mt-1"
            />
            <div>
              <p className="text-sm font-medium">Заменить все данные</p>
              <p className="text-xs text-gray-400">
                Текущие задачи будут удалены и заменены содержимым файла
              </p>
            </div>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="rounded-lg border border-surface-border px-4 py-2 text-sm text-gray-300 hover:bg-surface"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={importing}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {importing ? 'Импорт...' : 'Импортировать'}
          </button>
        </div>
      </div>
    </div>
  )
}