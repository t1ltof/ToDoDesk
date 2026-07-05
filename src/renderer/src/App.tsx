import { useEffect } from 'react'
import Sidebar from './components/Sidebar'
import TaskPanel from './components/TaskPanel'
import { useAppStore } from './store/useAppStore'

export default function App(): JSX.Element {
  const { loading, load, setData } = useAppStore()

  useEffect(() => {
    void load()

    const unsubscribe = window.tododesk.onDataUpdated((data) => {
      setData(data)
    })

    return unsubscribe
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
    </div>
  )
}