import { useEffect, useState } from 'react'
import type { UpdateInfo } from '../../preload/index'
import CalendarView from './components/CalendarView'
import FocusView from './components/FocusView'
import NotesView from './components/NotesView'
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
import GlobalSearchDialog from './components/GlobalSearchDialog'
import KanbanView from './components/KanbanView'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAppStore } from './store/useAppStore'
import clsx from 'clsx'

export default function App(): JSX.Element {
  const { loading, load, setData, setSelectedTaskId, setActiveView, activeView, selectedTaskId, data } =
    useAppStore()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [projectTemplatesOpen, setProjectTemplatesOpen] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)

  const theme = data.settings.theme
  const fontSize = data.settings.fontSize

  useKeyboardShortcuts(() => setQuickAddOpen(true), () => setGlobalSearchOpen(true))

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const unsubData = window.tododesk.onDataUpdated((updated) => setData(updated))
    const unsubQuickAdd = window.tododesk.onQuickAdd(() => setQuickAddOpen(true))
    const unsubOpenTask = window.tododesk.onOpenTask((taskId) => setSelectedTaskId(taskId))
    const unsubUpdate = window.tododesk.onUpdateAvailable((info) => setUpdateInfo(info))

    return () => {
      unsubData()
      unsubQuickAdd()
      unsubOpenTask()
      unsubUpdate()
    }
  }, [setData, setSelectedTaskId])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-amoled', 'theme-light')
    root.classList.add(`theme-${theme}`)
    root.classList.remove('font-size-compact', 'font-size-normal', 'font-size-large')
    root.classList.add(`font-size-${fontSize}`)
  }, [theme, fontSize])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
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
    if (activeView.startsWith('kanban:')) return <KanbanView view={activeView} />
    return <TaskPanel />
  }

  return (
    <div className={clsx('flex min-h-screen flex-col', `theme-${theme}`, `font-size-${fontSize}`)}>
      {updateInfo?.hasUpdate && (
        <UpdateBanner info={updateInfo} onDismiss={() => setUpdateInfo(null)} />
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
        {renderMain()}
        {selectedTaskId && <TaskDetail onSaveAsTemplate={() => setTemplatesOpen(true)} />}
      </div>
      <QuickAddDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
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
    </div>
  )
}