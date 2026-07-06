import { Download, X } from 'lucide-react'
import type { UpdateInfo } from '../../../shared/api'
import { useAppStore } from '../store/useAppStore'

interface UpdateBannerProps {
  info: UpdateInfo
  onDismiss: () => void
}

export default function UpdateBanner({ info, onDismiss }: UpdateBannerProps): JSX.Element {
  const { persist } = useAppStore()

  const dismiss = async (): Promise<void> => {
    if (info.latestVersion) {
      const current = useAppStore.getState().data
      await persist({
        ...current,
        settings: {
          ...current.settings,
          dismissedUpdateVersion: info.latestVersion,
          lastUpdateCheck: new Date().toISOString()
        }
      })
    }
    onDismiss()
  }

  return (
    <div className="flex items-center justify-between border-b border-accent/40 bg-accent-muted/30 px-4 py-2 text-sm">
      <span>
        Доступна новая версия <strong>{info.latestVersion}</strong> (у вас {info.currentVersion})
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => info.url && void window.tododesk.openUpdateUrl(info.url)}
          className="inline-flex items-center gap-1 rounded bg-accent px-3 py-1 text-white"
        >
          <Download size={14} /> Скачать
        </button>
        <button type="button" onClick={() => void dismiss()} className="rounded p-1 text-gray-400 hover:text-white">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}