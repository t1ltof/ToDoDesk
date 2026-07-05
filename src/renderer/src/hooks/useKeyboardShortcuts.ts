import { useEffect } from 'react'
import { deleteTaskTree } from '../utils/taskHelpers'
import { useAppStore } from '../store/useAppStore'

export function useKeyboardShortcuts(onQuickAdd: () => void): void {
  const { undo, selectedTaskId, persist, setSelectedTaskId, setSearchQuery } = useAppStore()

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement
      const typing =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'

      if (event.ctrlKey && event.key === 'z') {
        event.preventDefault()
        void undo()
        return
      }

      if (typing) return

      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault()
        onQuickAdd()
      }
      if (event.key === '/') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('input[placeholder="Поиск..."]')?.focus()
      }
      if (event.key === 'Escape') {
        setSelectedTaskId(null)
      }
      if (event.key === 'Delete' && selectedTaskId) {
        const data = useAppStore.getState().data
        if (confirm('Удалить задачу?')) {
          void persist(deleteTaskTree(data, selectedTaskId))
          setSelectedTaskId(null)
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, selectedTaskId, persist, setSelectedTaskId, setSearchQuery, onQuickAdd])
}