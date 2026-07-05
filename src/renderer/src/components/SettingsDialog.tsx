import type { Settings } from '../../../shared/schema'
import { useAppStore } from '../store/useAppStore'

interface SettingsDialogProps {
  onClose: () => void
  onOpenTemplates: () => void
}

export default function SettingsDialog({
  onClose,
  onOpenTemplates
}: SettingsDialogProps): JSX.Element {
  const { data, persist } = useAppStore()
  const settings = data.settings

  const update = async (patch: Partial<Settings>): Promise<void> => {
    await persist({
      ...data,
      settings: { ...settings, ...patch }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-surface-border bg-surface-elevated p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Настройки</h3>

        <div className="mt-4 space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.autostart}
              onChange={(e) => void update({ autostart: e.target.checked })}
            />
            Запускать при старте Windows
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.startMinimized}
              onChange={(e) => void update({ startMinimized: e.target.checked })}
            />
            Запускать свёрнутым в трей
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.checkUpdates}
              onChange={(e) => void update({ checkUpdates: e.target.checked })}
            />
            Проверять обновления при запуске
          </label>

          <div>
            <p className="mb-2 text-sm text-gray-400">Время утреннего напоминания</p>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={23}
                value={settings.notificationHour}
                onChange={(e) => void update({ notificationHour: Number(e.target.value) })}
                className="w-20 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
              />
              <span className="self-center text-gray-500">:</span>
              <input
                type="number"
                min={0}
                max={59}
                value={settings.notificationMinute}
                onChange={(e) => void update({ notificationMinute: Number(e.target.value) })}
                className="w-20 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.remindDayBefore}
              onChange={(e) => void update({ remindDayBefore: e.target.checked })}
            />
            Напоминать за день до срока
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.remindHourBefore}
              onChange={(e) => void update({ remindHourBefore: e.target.checked })}
            />
            Напоминать за час до срока
          </label>

          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenTemplates()
            }}
            className="w-full rounded-lg border border-surface-border px-4 py-2 text-sm text-gray-300 hover:bg-surface"
          >
            Управление шаблонами задач
          </button>
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