interface UpgradeDialogProps {
  onStayLocal: () => void
  onOpenCloud: () => void
}

export default function UpgradeDialog({ onStayLocal, onOpenCloud }: UpgradeDialogProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-surface-border bg-surface-elevated p-6 shadow-xl">
        <h3 className="text-lg font-semibold">ToDoDesk 2.0</h3>
        <p className="mt-2 text-sm text-gray-400">
          Локальные данные остались на этом компьютере. Облако включается отдельно: общий проект,
          исполнители и живая доска появятся после входа.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onStayLocal}
            className="rounded-lg border border-surface-border px-4 py-2 text-sm text-gray-200"
          >
            Остаться локально
          </button>
          <button
            type="button"
            onClick={onOpenCloud}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white"
          >
            Войти в облако
          </button>
        </div>
      </div>
    </div>
  )
}
