import { useEffect, useState } from 'react'
import type { FontSize, ScheduledExportFormat, Settings, Theme } from '../../../shared/schema'
import type { SyncStatusInfo } from '../../../shared/api'
import { useAppStore } from '../store/useAppStore'
import {
  ensureOverdueSmartRule,
  toggleSmartRule,
  updateSmartRuleDays
} from '../utils/smartRules'
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
  const { data, persist, setData } = useAppStore()
  const settings = data.settings
  const [activityLogOpen, setActivityLogOpen] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [syncStatus, setSyncStatus] = useState<SyncStatusInfo | null>(null)

  useEffect(() => {
    void window.tododesk.getSyncStatus().then(setSyncStatus)
    const timer = setInterval(() => {
      void window.tododesk.getSyncStatus().then(setSyncStatus)
    }, 5000)
    return () => clearInterval(timer)
  }, [settings.syncFolderPath, settings.syncAutoPushEnabled, settings.syncLastPushAt])

  const update = async (patch: Partial<Settings>): Promise<void> => {
    const current = useAppStore.getState().data
    await persist({
      ...current,
      settings: { ...current.settings, ...patch }
    })
  }

  const updateSmartRules = async (
    updater: (payload: ReturnType<typeof useAppStore.getState>['data']) => ReturnType<typeof useAppStore.getState>['data']
  ): Promise<void> => {
    const current = useAppStore.getState().data
    const withDefaults = ensureOverdueSmartRule(current)
    await persist(updater(withDefaults))
  }

  const handleSyncPush = async (): Promise<void> => {
    const current = useAppStore.getState().data
    const result = await window.tododesk.syncPushNow(current)
    if (!result.ok) alert(result.error ?? 'Ошибка синхронизации')
    else {
      const reloaded = await window.tododesk.reloadData()
      setData(reloaded)
      void window.tododesk.getSyncStatus().then(setSyncStatus)
      if (result.action === 'pushed') alert('Данные отправлены в папку синхронизации')
      else if (result.action === 'unchanged') alert('Данные уже совпадают')
    }
  }

  const handleSyncPull = async (): Promise<void> => {
    const result = await window.tododesk.syncPullNow()
    if (!result.ok) {
      if (!result.error?.includes('диалоге')) alert(result.error ?? 'Ошибка синхронизации')
      return
    }
    if (result.action === 'pulled') {
      if (result.data) setData(result.data)
      alert('Данные получены из папки синхронизации')
    } else if (result.action === 'unchanged') alert('Данные уже совпадают')
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
      try {
        const reloaded = await window.tododesk.reloadData()
        setData(reloaded)
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Не удалось перезагрузить данные')
      }
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
              <label className="mb-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.quietHoursEnabled ?? true}
                  onChange={(e) => void update({ quietHoursEnabled: e.target.checked })}
                />
                Тихие часы
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={settings.quietHoursStart ?? '23:00'}
                  onChange={(e) => void update({ quietHoursStart: e.target.value })}
                  disabled={!(settings.quietHoursEnabled ?? true)}
                  className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                />
                <span className="text-gray-500">—</span>
                <input
                  type="time"
                  value={settings.quietHoursEnd ?? '08:00'}
                  onChange={(e) => void update({ quietHoursEnd: e.target.value })}
                  disabled={!(settings.quietHoursEnabled ?? true)}
                  className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">Без уведомлений в указанный интервал</p>
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

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.notificationSound}
                onChange={(e) => void update({ notificationSound: e.target.checked })}
              />
              Звук уведомлений
            </label>

            <div className="rounded-lg border border-surface-border p-3">
              <p className="mb-2 text-sm font-medium">Сводка дня</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.dailyDigestEnabled}
                  onChange={(e) => void update({ dailyDigestEnabled: e.target.checked })}
                />
                Ежедневная сводка
              </label>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-gray-400">Час:</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={settings.dailyDigestHour}
                  onChange={(e) => void update({ dailyDigestHour: Number(e.target.value) })}
                  className="w-16 rounded-lg border border-surface-border bg-surface px-2 py-1"
                />
              </div>
            </div>

            <div className="rounded-lg border border-surface-border p-3">
              <p className="mb-2 text-sm font-medium">Интерфейс</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.sidebarCompact}
                  onChange={(e) => void update({ sidebarCompact: e.target.checked })}
                />
                Компактная боковая панель
              </label>
              <div className="mt-3 flex items-center gap-3 text-sm">
                <span className="text-gray-400">Акцентный цвет</span>
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={(e) => void update({ accentColor: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border border-surface-border bg-transparent"
                />
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-gray-400">Лимит «Сегодня» (0 = без лимита):</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={settings.todayOnlyMaxTasks}
                  onChange={(e) => void update({ todayOnlyMaxTasks: Number(e.target.value) })}
                  className="w-16 rounded-lg border border-surface-border bg-surface px-2 py-1"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void window.tododesk.exportCsv()}
              className="w-full rounded-lg border border-surface-border px-4 py-2 text-sm text-gray-300 hover:bg-surface"
            >
              Экспорт CSV
            </button>

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
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.syncAutoPushEnabled}
                  onChange={(e) => void update({ syncAutoPushEnabled: e.target.checked })}
                  disabled={!settings.syncFolderPath}
                />
                Автоотправка по таймеру
              </label>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-gray-400">Интервал (мин):</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={settings.syncAutoPushIntervalMinutes}
                  onChange={(e) =>
                    void update({ syncAutoPushIntervalMinutes: Number(e.target.value) })
                  }
                  disabled={!settings.syncAutoPushEnabled}
                  className="w-16 rounded-lg border border-surface-border bg-surface px-2 py-1 disabled:opacity-50"
                />
              </div>
              {syncStatus && settings.syncFolderPath && (
                <p className="mt-2 text-xs text-gray-500">
                  Статус: {syncStatus.message}
                  {syncStatus.lastPushAt
                    ? ` · ${new Date(syncStatus.lastPushAt).toLocaleString('ru-RU')}`
                    : ''}
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleSyncPush()}
                  disabled={!settings.syncFolderPath}
                  className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-gray-300 hover:bg-surface disabled:opacity-40"
                >
                  Отправить сейчас
                </button>
                <button
                  type="button"
                  onClick={() => void handleSyncPull()}
                  disabled={!settings.syncFolderPath}
                  className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-gray-300 hover:bg-surface disabled:opacity-40"
                >
                  Получить сейчас
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-surface-border p-3">
              <p className="mb-2 text-sm font-medium">Плановый экспорт</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.scheduledExportEnabled}
                  onChange={(e) => void update({ scheduledExportEnabled: e.target.checked })}
                />
                Ежедневный экспорт в папку
              </label>
              <input
                type="text"
                value={settings.scheduledExportPath ?? ''}
                onChange={(e) =>
                  void update({ scheduledExportPath: e.target.value.trim() || null })
                }
                placeholder="C:\Users\...\Backups\export"
                className="mt-2 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-400">Час:</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={settings.scheduledExportHour}
                  onChange={(e) => void update({ scheduledExportHour: Number(e.target.value) })}
                  className="w-16 rounded-lg border border-surface-border bg-surface px-2 py-1"
                />
                <select
                  value={settings.scheduledExportFormat}
                  onChange={(e) =>
                    void update({ scheduledExportFormat: e.target.value as ScheduledExportFormat })
                  }
                  className="rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm"
                >
                  <option value="tododesk">.tododesk</option>
                  <option value="csv">CSV</option>
                  <option value="both">Оба формата</option>
                </select>
              </div>
              {settings.scheduledExportLastRunDate && (
                <p className="mt-2 text-xs text-gray-500">
                  Последний экспорт: {settings.scheduledExportLastRunDate}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-surface-border p-3">
              <p className="mb-2 text-sm font-medium">Умные правила</p>
              <p className="mb-3 text-xs text-gray-500">
                Автоматически применяются при запуске. Изменения сохраняются в настройках.
              </p>
              <div className="space-y-2">
                {ensureOverdueSmartRule(data).smartRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm"
                  >
                    <label className="flex flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) =>
                          void updateSmartRules((next) =>
                            toggleSmartRule(next, rule.id, e.target.checked)
                          )
                        }
                      />
                      <span>{rule.name}</span>
                    </label>
                    <label className="flex items-center gap-1 text-xs text-gray-400">
                      дней:
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={rule.days}
                        onChange={(e) =>
                          void updateSmartRules((next) =>
                            updateSmartRuleDays(next, rule.id, Number(e.target.value))
                          )
                        }
                        className="w-14 rounded border border-surface-border bg-surface-elevated px-1 py-0.5"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-surface-border p-3">
              <p className="mb-2 text-sm font-medium">Горячие клавиши</p>
              <ul className="space-y-1 text-xs text-gray-400">
                <li>Ctrl+Shift+T — быстрое добавление (глобально)</li>
                <li>Ctrl+N — быстрое добавление</li>
                <li>Ctrl+K — командная палитра</li>
                <li>Ctrl+F — глобальный поиск</li>
                <li>Ctrl+Shift+V — вставить задачи из буфера</li>
                <li>Ctrl+Z — отмена · Ctrl+1–7 — виды · / — поиск · Delete — удалить задачу</li>
              </ul>
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