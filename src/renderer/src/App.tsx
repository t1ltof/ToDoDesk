import { useEffect, useState } from 'react'
import QuickAddDialog from './components/QuickAddDialog'
import Sidebar from './components/Sidebar'
import TaskPanel from './components/TaskPanel'
import { useAppStore } from './store/useAppStore'

export default function App(): JSX.Element {
  const { loading, load, setData } = useAppStore()
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  useEffect(() => {
    void load()

    const unsubData = window.tododesk.onDataUpdated((data) => {
      setData(data)
    })

    const unsubQuickAdd = window.tododesk.onQuickAdd(() => {
      setQuickAddOpen(true)
    })

    return () => {
      unsubData()
      unsubQuickAdd()
    }
  }, [load, setData])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        Загрузка...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <TaskPanel />
      <QuickAddDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </div>
  )
}