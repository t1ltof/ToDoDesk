import { useEffect, useState } from 'react'
import { resolveDesktopLayout, type DesktopLayout } from '../utils/desktopLayout'
import { useAppStore } from '../store/useAppStore'

function readWidth(): number {
  return typeof window === 'undefined' ? 1920 : window.innerWidth
}

export function useDesktopLayout(): DesktopLayout & { width: number } {
  const [width, setWidth] = useState(readWidth)
  const detailOpen = Boolean(useAppStore((state) => state.selectedTaskId))
  const userSidebarCompact = useAppStore((state) => state.data.settings.sidebarCompact)

  useEffect(() => {
    const onResize = (): void => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return {
    width,
    ...resolveDesktopLayout({ width, detailOpen, userSidebarCompact })
  }
}
