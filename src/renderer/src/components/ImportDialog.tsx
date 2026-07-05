import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import type { ImportPreview } from '../../../shared/import'
import { useAppStore } from '../store/useAppStore'
import clsx from 'clsx'

interface ImportDialogProps {
  preview: ImportPreview
  onClose: () => void
}

type ImportMode = 'replace' | 'new-project' | 'merge'

export default function ImportDialog({ preview, onClose }: ImportDialogProps): JSX.Element {
  const { load, setActiveView } = useAppStore()
  const [mode, setMode] = useState<ImportMode>('new-project')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportedDate = preview.exportedAt
    ? new Date(preview.exportedAt).toLocaleString('ru-RU')
    : 'неизвестно'

  const handleImport = async (): Promise<void> => {
    if (!preview.valid) return
    setImporting(true)
    setError(null)
    try {
      const result = await window.tododesk.importFile(preview.filePath, mode)
      if (!result.ok) {
        setError(result.error ?? 'Ошибка импорта')
        return
      }
      await load()
      if (mode === 'new-project') setActiveView('all')
      onClose()
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-surface-border bg-surface-elevated p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Импорт данных</h3>
        <p className="mt-1 text-sm text-gray-400">Файл: {preview.filePath.split(/[/\\]/).pop()}</p>
        <p className="text-sm text-gray-400">Экспортирован: {exportedDate}</p>

        {preview.errors.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-800/50 bg-red-950/30 p-3 text-sm text-red-300">
            <p className="mb-1 flex items-center gap-1 font-medium">
              <AlertTriangle size={14} /> Ошибки ({preview.errors.length})
            </p>
            <ul className="list-inside list-disc space-y-1 text-xs">
              {preview.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {preview.warnings.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-800/50 bg-amber-950/20 p-3 text-sm text-amber-200">
            <p className="mb-1 font-medium">Предупреждения ({preview.warnings.length})</p>
            <ul className="list-inside list-disc space-y-1 text-xs">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {preview.valid && (
          <div className="mt-4 rounded-lg border border-surface-border bg-surface p-3 text-sm text-gray-300">
            <p>{preview.projectCount} проект(ов)</p>
            <p>{preview.taskCount} задач ({preview.doneCount} выполнено)</p>
            <p>{preview.tagCount} тег(ов)</p>
            <p>{preview.templateCount} шаблон(ов)</p>
          </div>
        )}

        {preview.valid && (
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
                <p className="text-xs text-gray-400">Текущие данные сохранятся</p>
              </div>
            </label>
            <label
              className={clsx(
                'flex cursor-pointer gap-3 rounded-lg border p-3 transition',
                mode === 'merge' ? 'border-accent bg-accent-muted' : 'border-surface-border'
              )}
            >
              <input
                type="radio"
                name="import-mode"
                checked={mode === 'merge'}
                onChange={() => setMode('merge')}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium">Объединить</p>
                <p className="text-xs text-gray-400">
                  Добавить данные, проекты с одинаковым именем объединятся
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
                <p className="text-xs text-gray-400">Текущие задачи будут удалены</p>
              </div>
            </label>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-surface-border px-4 py-2 text-sm text-gray-300">
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={importing || !preview.valid}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {importing ? 'Импорт...' : 'Импортировать'}
          </button>
        </div>
      </div>
    </div>
  )
}