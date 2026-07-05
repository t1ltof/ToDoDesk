import type { ActivityLog } from '../../../shared/schema'
import { useAppStore } from '../store/useAppStore'

interface ActivityLogDialogProps {
  onClose: () => void
}

export default function ActivityLogDialog({ onClose }: ActivityLogDialogProps): JSX.Element {
  const { data } = useAppStore()

  const logs = [...data.activityLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-surface-border bg-surface-elevated p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Журнал активности</h3>
        <p className="mt-1 text-sm text-gray-400">Последние {logs.length} записей</p>

        <div className="mt-4 space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500">Записей пока нет</p>
          ) : (
            logs.map((log: ActivityLog) => (
              <div
                key={log.id}
                className="rounded-lg border border-surface-border px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-200">{log.summary}</span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {new Date(log.timestamp).toLocaleString('ru-RU')}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {log.action} · {log.entityType}
                  {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}