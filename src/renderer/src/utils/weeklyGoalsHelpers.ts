import { v4 as uuidv4 } from 'uuid'
import type { DataPayload } from '../../../shared/schema'

export function addWeeklyGoal(data: DataPayload, weekKey: string, text: string): DataPayload {
  return {
    ...data,
    weeklyGoals: [
      ...data.weeklyGoals,
      { id: uuidv4(), weekKey, text: text.trim(), completed: false }
    ]
  }
}

export function toggleWeeklyGoal(data: DataPayload, goalId: string): DataPayload {
  return {
    ...data,
    weeklyGoals: data.weeklyGoals.map((goal) =>
      goal.id === goalId ? { ...goal, completed: !goal.completed } : goal
    )
  }
}

export function deleteWeeklyGoal(data: DataPayload, goalId: string): DataPayload {
  return {
    ...data,
    weeklyGoals: data.weeklyGoals.filter((goal) => goal.id !== goalId)
  }
}

export function getWeeklyGoalsProgress(data: DataPayload, weekKey: string): {
  total: number
  completed: number
  percent: number
} {
  const goals = data.weeklyGoals.filter((g) => g.weekKey === weekKey)
  const completed = goals.filter((g) => g.completed).length
  const total = goals.length
  return {
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100)
  }
}