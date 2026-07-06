import { useEffect, useRef, useState } from 'react'
import type { UpdateInfo } from '../../preload/index'
import type { SyncConflictPayload } from '../../shared/sync'
import type { ViewId } from '../../shared/schema'
import CalendarView from './components/CalendarView'
import FocusView from './components/FocusView'
import NextTaskView from './components/NextTaskView'
import NotesView from './components/NotesView'
import SprintView from './components/SprintView'
import TimelineView from './components/TimelineView'
import PasteTasksDialog from './components/PasteTasksDialog'
import WeeklyReviewDialog from './components/WeeklyReviewDialog'
import ProjectTemplatesDialog from './components/ProjectTemplatesDialog'
import QuickAddDialog from './components/QuickAddDialog'
import SettingsDialog from './components/SettingsDialog'
import Sidebar from './components/Sidebar'
import StatsView from './components/StatsView'
import TaskDetail from './components/TaskDetail'
import TaskPanel from './components/TaskPanel'
import TemplatesDialog from './components/TemplatesDialog'
import UpdateBanner from './components/UpdateBanner'
import BoardView from './components/BoardView'
import CommandPaletteDialog from './components/CommandPaletteDialog'
import GlobalSearchDialog from './components/GlobalSearchDialog'
import KanbanView from './components/KanbanView'
import SyncConflictDialog from './components/SyncConflictDialog'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAppStore } from './store/useAppStore'
import { applyAccentColor } from './utils/accentColor'
import { playNotificationBeep } from './utils/notificationSound'
import { applySmartRules, ensureOverdueSmartRule } from './utils/smartRules'
import clsx from 'clsx'

export default function App(): JSX.Element {
  const { loading, load, setData, setSelectedTaskId, setActiveView, activeView, selectedTaskId, data, persist } =
    useAppStore()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [weeklyReviewOpen, setWeeklyReviewOpen] = useState(false)
  const [pasteTasksOpen, setPasteTasksOpen] = useState(false)
  const previousViewRef = useRef<ViewId>('today')
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [projectTemplatesOpen, setProjectTemplatesOpen] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [syncConflict, setSyncConflict] = useState<SyncConflictPayload | null>(null)

  const theme = data.settings.theme
  const fontSize = data.settings.fontSize
  const accentColor = data.settings.accentColor
  useKeyboardShortcuts(
    () => setQuickAddOpen(true),
    () => setGlobalSearchOpen(true),
    () => setCommandPaletteOpen(true),
    () => setPasteTasksOpen(true)
  )

  useEffect(() => {
    void load()
  }, [load])

  const smartRulesBootstrapped = useRef(false)

  useEffect(() => {
    if (loading || smartRulesBootstrapped.current) return

    const timeout = window.setTimeout(() => {
      if (smartRulesBootstrapped.current) return
      smartRulesBootstrapped.current = true

      const currentData = useAppStore.getState().data
      const withRules = ensureOverdueSmartRule(currentData)
      const applied = applySmartRules(withRules)
      if (JSON.stringify(applied) !== JSON.stringify(currentData)) {
        useAppStore.getState().setData(applied)
      } else if (withRules.smartRules.length !== currentData.smartRules.length) {
        useAppStore.getState().setData(withRules)
      }
    }, 1500)

    const interval = window.setInterval(() => {
      if (!smartRulesBootstrapped.current) return
      const current = useAppStore.getState().data
      const next = applySmartRules(current)
      if (JSON.stringify(next) !== JSON.stringify(current)) {
        useAppStore.getState().setData(next)
      }
    }, 60_000)

    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [loading])

  useEffect(() => {
    if (activeView === 'weekly-review') {
      if (previousViewRef.current !== 'weekly-review') {
        setWeeklyReviewOpen(true)
      }
      return
    }
    previousViewRef.current = activeView
  }, [activeView])

  useEffect(() => {
    if (!selectedTaskId) return
    if (!data.tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null)
    }
  }, [selectedTaskId, data.tasks, setSelectedTaskId])

  useEffect(() => {
    const unsubData = window.tododesk.onDataUpdated((updated) => {
      useAppStore.setState({ data: updated, undoSnapshot: null })
      void window.tododesk.setUnsavedChanges(false)
    })
    const unsubLoadFailed = window.tododesk.onDataLoadFailed((payload) => {
      if (payload.needsPassword) {
        setSettingsOpen(true)
      }
      console.error(payload.message)
    })
    const unsubQuickAdd = window.tododesk.onQuickAdd(() => setQuickAddOpen(true))
    const unsubOpenTask = window.tododesk.onOpenTask((taskId) => setSelectedTaskId(taskId))
    const unsubUpdate = window.tododesk.onUpdateAvailable((info) => setUpdateInfo(info))
    const unsubSync = window.tododesk.onSyncConflict((payload) => setSyncConflict(payload))
    const unsubNotification = window.tododesk.onNotification(() => {
      if (useAppStore.getState().data.settings.notificationSound) {
        playNotificationBeep()
      }
    })

    return () => {
      unsubData()
      unsubLoadFailed()
      unsubQuickAdd()
      unsubOpenTask()
      unsubUpdate()
      unsubSync()
      unsubNotification()
    }
  }, [setData, setSelectedTaskId])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-amoled', 'theme-light')
    root.classList.add(`theme-${theme}`)
    root.classList.remove('font-size-compact', 'font-size-normal', 'font-size-large')
    root.classList.add(`font-size-${fontSize}`)
    applyAccentColor(accentColor)
  }, [theme, fontSize, accentColor])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center overflow-hidden text-gray-400">
        Загрузка...
      </div>
    )
  }

  const renderMain = (): JSX.Element => {
    if (activeView === 'calendar') return <CalendarView />
    if (activeView === 'stats') return <StatsView />
    if (activeView === 'board') return <BoardView />
    if (activeView === 'notes') return <NotesView />
    if (activeView === 'focus') return <FocusView />
    if (activeView === 'timeline') return <TimelineView />
    if (activeView === 'sprint') return <SprintView />
    if (activeView === 'next') return <NextTaskView />
    if (activeView === 'weekly-review') {
      return <TaskPanel onPasteTasks={() => setPasteTasksOpen(true)} />
    }
    if (activeView.startsWith('kanban:')) return <KanbanView view={activeView} />
    return <TaskPanel onPasteTasks={() => setPasteTasksOpen(true)} />
  }

  return (
    <div className={clsx('flex h-screen flex-col overflow-hidden', `theme-${theme}`, `font-size-${fontSize}`)}>
      {updateInfo?.hasUpdate && (
        <UpdateBanner info={updateInfo} onDismiss={() => setUpdateInfo(null)} />
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          {renderMain()}
          {selectedTaskId && <TaskDetail onSaveAsTemplate={() => setTemplatesOpen(true)} />}
        </div>
      </div>
      <QuickAddDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      <CommandPaletteDialog
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectView={(view) => {
          setActiveView(view)
          setCommandPaletteOpen(false)
        }}
        onSelectTask={(taskId) => {
          setSelectedTaskId(taskId)
          setCommandPaletteOpen(false)
        }}
        onQuickAdd={() => {
          setCommandPaletteOpen(false)
          setQuickAddOpen(true)
        }}
        onOpenSettings={() => {
          setCommandPaletteOpen(false)
          setSettingsOpen(true)
        }}
        onGlobalSearch={() => {
          setCommandPaletteOpen(false)
          setGlobalSearchOpen(true)
        }}
      />
      <GlobalSearchDialog
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        onSelectTask={(taskId) => {
          setSelectedTaskId(taskId)
          setGlobalSearchOpen(false)
        }}
        onSelectNote={() => {
          setActiveView('notes')
          setGlobalSearchOpen(false)
        }}
        onSelectBoardNode={() => {
          setActiveView('board')
          setGlobalSearchOpen(false)
        }}
      />
      {settingsOpen && (
        <SettingsDialog
          onClose={() => setSettingsOpen(false)}
          onOpenTemplates={() => setTemplatesOpen(true)}
          onOpenProjectTemplates={() => setProjectTemplatesOpen(true)}
        />
      )}
      {templatesOpen && <TemplatesDialog onClose={() => setTemplatesOpen(false)} />}
      {projectTemplatesOpen && (
        <ProjectTemplatesDialog onClose={() => setProjectTemplatesOpen(false)} />
      )}
      {syncConflict && (
        <SyncConflictDialog
          conflict={syncConflict}
          onResolve={async (choice) => {
            const resolved = await window.tododesk.resolveSyncConflict(choice)
            if (resolved) setData(resolved)
            setSyncConflict(null)
          }}
        />
      )}
      <PasteTasksDialog
        open={pasteTasksOpen}
        onClose={() => setPasteTasksOpen(false)}
        view={activeView}
      />
      <WeeklyReviewDialog
        open={weeklyReviewOpen}
        onClose={() => {
          setWeeklyReviewOpen(false)
          if (activeView === 'weekly-review') {
            setActiveView(
              previousViewRef.current === 'weekly-review' ? 'today' : previousViewRef.current
            )
          }
        }}
      />
    </div>
  )
}