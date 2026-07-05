import { useState } from 'react'
import type { FontSize, Settings, Theme } from '../../../shared/schema'
import { useAppStore } from '../store/useAppStore'
import ActivityLogDialog from './ActivityLogDialog'
import clsx from 'clsx'

interface SettingsDialogProps {
  onClose: () => void
  onOpenTemplates: () => void
  onOpenProjectTemplates: () => void
}

const themes: Array<{ id: Theme; label: string }> = [
  { id: 'dark', label: 'Тёмная' },
  { id: 'amoled', label: 'AMOLED' },
  { id: 'light', label: 'Светлая' }
]

const fontSizes: Array<{ id: FontSize; label: string }> = [
  { id: 'compact', label: 'Компактный' },
  { id: 'normal', label: 'Обычный' },
  { id: 'large', label: 'Крупный' }
]

export default function SettingsDialog({
  onClose,
  onOpenTemplates,
  onOpenProjectTemplates
}: SettingsDialogProps): JSX.Element {
  const { data, persist } = useAppStore()
  const settings = data.settings
  const [activityLogOpen, setActivityLogOpen] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')

  const update = async (patch: Partial<Settings>): Promise<void> => {
    await persist({
      ...data,
      settings: { ...settings, ...patch }
    })
  }

  const handlePasswordToggle = async (enabled: boolean): Promise<void> => {
    if (enabled) {
      const pwd = passwordInput.trim()
      if (!pwd) {
        alert('Введите пароль для шифрования')
        return
      }
      await window.tododesk.setDataPassword(pwd)
      await update({ dataPasswordEnabled: true })
    } else {
      await window.tododesk.setDataPassword(null)
      await update({ dataPasswordEnabled: false })
      setPasswordInput('')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-surface-border bg-surface-elevated p-6 shadow-xl">
          <h3 className="text-lg font-semibold">Настройки</h3>

          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-sm text-gray-400">Тема</p>
              <div className="flex gap-2">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void update({ theme: t.id })}
                    className={clsx(
                      'rounded-lg border px-3 py-1.5 text-sm transition',
                      settings.theme === t.id
                        ? 'border-accent bg-accent-muted text-blue-300'
                        : 'border-surface-border text-gray-300'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm text-gray-400">Размер шрифта</p>
              <div className="flex gap-2">
                {fontSizes.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => void update({ fontSize: f.id })}
                    className={clsx(
                      'rounded-lg border px-3 py-1.5 text-sm transition',
                      settings.fontSize === f.id
                        ? 'border-accent bg-accent-muted text-blue-300'
                        : 'border-surface-border text-gray-300'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

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

            <div>
              <p className="mb-2 text-sm text-gray-400">Тихие часы (без уведомлений)</p>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={settings.quietHoursStart ?? '23:00'}
                  onChange={(e) => void update({ quietHoursStart: e.target.value })}
                  className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
                />
                <span className="text-gray-500">—</span>
                <input
                  type="time"
                  value={settings.quietHoursEnd ?? '08:00'}
                  onChange={(e) => void update({ quietHoursEnd: e.target.value })}
                  className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
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

            <div className="rounded-lg border border-surface-border p-3">
              <p className="mb-2 text-sm font-medium">Автобэкап</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.autoBackupEnabled}
                  onChange={(e) => void update({ autoBackupEnabled: e.target.checked })}
                />
                Включить автоматические копии
              </label>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-gray-400">Хранить версий:</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.autoBackupMaxVersions}
                  onChange={(e) =>
                    void update({ autoBackupMaxVersions: Number(e.target.value) })
                  }
                  className="w-16 rounded-lg border border-surface-border bg-surface px-2 py-1"
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm text-gray-400">Папка синхронизации</p>
              <input
                type="text"
                value={settings.syncFolderPath ?? ''}
                onChange={(e) =>
                  void update({ syncFolderPath: e.target.value.trim() || null })
                }
                placeholder="C:\Users\...\Sync"
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Следит за data.tododesk в указанной папке
              </p>
            </div>

            <div className="rounded-lg border border-surface-border p-3">
              <p className="mb-2 text-sm font-medium">Шифрование данных</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.dataPasswordEnabled}
                  onChange={(e) => void handlePasswordToggle(e.target.checked)}
                />
                Защитить файл паролем (AES-256)
              </label>
              {!settings.dataPasswordEnabled && (
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Пароль"
                  className="mt-2 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
                />
              )}
            </div>

            <div className="rounded-lg border border-surface-border p-3">
              <p className="mb-2 text-sm font-medium">Помодоро</p>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  Работа (мин):
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={settings.pomodoroWorkMinutes}
                    onChange={(e) =>
                      void update({ pomodoroWorkMinutes: Number(e.target.value) })
                    }
                    className="w-16 rounded-lg border border-surface-border bg-surface px-2 py-1"
                  />
                </label>
                <label className="flex items-center gap-2">
                  Перерыв (мин):
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={settings.pomodoroBreakMinutes}
                    onChange={(e) =>
                      void update({ pomodoroBreakMinutes: Number(e.target.value) })
                    }
                    className="w-16 rounded-lg border border-surface-border bg-surface px-2 py-1"
                  />
                </label>
              </div>
            </div>

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
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenProjectTemplates()
              }}
              className="w-full rounded-lg border border-surface-border px-4 py-2 text-sm text-gray-300 hover:bg-surface"
            >
              Управление шаблонами проектов
            </button>
            <button
              type="button"
              onClick={() => setActivityLogOpen(true)}
              className="w-full rounded-lg border border-surface-border px-4 py-2 text-sm text-gray-300 hover:bg-surface"
            >
              Журнал активности
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

      {activityLogOpen && <ActivityLogDialog onClose={() => setActivityLogOpen(false)} />}
    </>
  )
}