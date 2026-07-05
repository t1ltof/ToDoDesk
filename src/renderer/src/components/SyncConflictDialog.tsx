import type { SyncConflictPayload, SyncConflictChoice } from '../../../shared/sync'

interface SyncConflictDialogProps {
  conflict: SyncConflictPayload
  onResolve: (choice: SyncConflictChoice) => void
}

function formatSummary(label: string, summary: SyncConflictPayload['local']): JSX.Element {
  return (
    <div className="rounded-lg border border-surface-border bg-surface p-3 text-sm">
      <p className="mb-2 font-medium">{label}</p>
      <ul className="space-y-1 text-gray-400">
        <li>Задач: {summary.taskCount}</li>
        <li>Проектов: {summary.projectCount}</li>
        <li>Блоков доски: {summary.boardNodeCount}</li>
        <li>Заметок: {summary.noteCount}</li>
        {summary.lastUpdated && (
          <li>
            Обновлено:{' '}
            {new Date(summary.lastUpdated).toLocaleString('ru-RU', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </li>
        )}
      </ul>
    </div>
  )
}

export default function SyncConflictDialog({
  conflict,
  onResolve
}: SyncConflictDialogProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-amber-700/50 bg-surface-elevated p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-amber-200">Конфликт синхронизации</h3>
        <p className="mt-2 text-sm text-gray-400">
          Внешний файл данных изменился, пока в приложении есть несохранённые правки. Выберите,
          какую версию оставить.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {formatSummary('Локальная копия', conflict.local)}
          {formatSummary('Внешняя копия', conflict.external)}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onResolve('cancel')}
            className="rounded-lg border border-surface-border px-4 py-2 text-sm text-gray-300 hover:bg-surface"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => onResolve('external')}
            className="rounded-lg border border-surface-border px-4 py-2 text-sm text-gray-200 hover:bg-surface"
          >
            Использовать внешнюю
          </button>
          <button
            type="button"
            onClick={() => onResolve('local')}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white"
          >
            Оставить локальную
          </button>
        </div>
      </div>
    </div>
  )
}