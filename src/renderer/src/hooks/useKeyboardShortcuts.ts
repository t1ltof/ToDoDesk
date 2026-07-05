import { useEffect } from 'react'
import type { ViewId } from '../../../shared/schema'
import { deleteTaskTree } from '../utils/taskHelpers'
import { useAppStore } from '../store/useAppStore'

const VIEW_SHORTCUTS: ViewId[] = [
  'today',
  'inbox',
  'all',
  'completed',
  'calendar',
  'board',
  'stats'
]

export function useKeyboardShortcuts(
  onQuickAdd: () => void,
  onGlobalSearch: () => void,
  onCommandPalette: () => void,
  onPasteTasks?: () => void
): void {
  const { undo, selectedTaskId, persist, setSelectedTaskId, setActiveView } = useAppStore()

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

      if (event.ctrlKey && (event.key === 'n' || event.key === 'N')) {
        event.preventDefault()
        onQuickAdd()
        return
      }

      if (event.ctrlKey && (event.key === 'f' || event.key === 'F')) {
        event.preventDefault()
        onGlobalSearch()
        return
      }

      if (event.ctrlKey && (event.key === 'k' || event.key === 'K')) {
        event.preventDefault()
        onCommandPalette()
        return
      }

      if (event.ctrlKey && event.shiftKey && (event.key === 'v' || event.key === 'V')) {
        event.preventDefault()
        onPasteTasks?.()
        return
      }

      if (event.ctrlKey && event.key >= '1' && event.key <= '7') {
        event.preventDefault()
        setActiveView(VIEW_SHORTCUTS[Number(event.key) - 1])
        return
      }

      if (typing) return

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
  }, [
    undo,
    selectedTaskId,
    persist,
    setSelectedTaskId,
    setActiveView,
    onQuickAdd,
    onGlobalSearch,
    onCommandPalette,
    onPasteTasks
  ])
}