import { useEffect, useState } from 'react'
import type { UpdateInfo } from '../../preload/index'
import CalendarView from './components/CalendarView'
import QuickAddDialog from './components/QuickAddDialog'
import SettingsDialog from './components/SettingsDialog'
import Sidebar from './components/Sidebar'
import StatsView from './components/StatsView'
import TaskDetail from './components/TaskDetail'
import TaskPanel from './components/TaskPanel'
import TemplatesDialog from './components/TemplatesDialog'
import UpdateBanner from './components/UpdateBanner'
import KanbanView from './components/KanbanView'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAppStore } from './store/useAppStore'

export default function App(): JSX.Element {
  const { loading, load, setData, setSelectedTaskId, activeView, selectedTaskId } = useAppStore()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)

  useKeyboardShortcuts(() => setQuickAddOpen(true))

  useEffect(() => {
    void load()

    const unsubData = window.tododesk.onDataUpdated((data) => setData(data))
    const unsubQuickAdd = window.tododesk.onQuickAdd(() => setQuickAddOpen(true))
    const unsubOpenTask = window.tododesk.onOpenTask((taskId) => setSelectedTaskId(taskId))
    const unsubUpdate = window.tododesk.onUpdateAvailable((info) => setUpdateInfo(info))

    return () => {
      unsubData()
      unsubQuickAdd()
      unsubOpenTask()
      unsubUpdate()
    }
  }, [load, setData, setSelectedTaskId])

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
    if (activeView.startsWith('kanban:')) return <KanbanView view={activeView} />
    return <TaskPanel />
  }

  return (
    <div className="flex min-h-screen flex-col">
      {updateInfo?.hasUpdate && (
        <UpdateBanner info={updateInfo} onDismiss={() => setUpdateInfo(null)} />
      )}
      <div className="flex min-h-0 flex-1">
        <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
        {renderMain()}
        {selectedTaskId && <TaskDetail onSaveAsTemplate={() => setTemplatesOpen(true)} />}
      </div>
      <QuickAddDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      {settingsOpen && (
        <SettingsDialog
          onClose={() => setSettingsOpen(false)}
          onOpenTemplates={() => setTemplatesOpen(true)}
        />
      )}
      {templatesOpen && <TemplatesDialog onClose={() => setTemplatesOpen(false)} />}
    </div>
  )
}