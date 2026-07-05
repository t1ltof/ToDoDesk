import { v4 as uuidv4 } from 'uuid'
import type { DataPayload, Sprint } from '../../../shared/schema'

export function createSprint(
  data: DataPayload,
  input: { name: string; startDate: string; endDate: string; goal?: string }
): DataPayload {
  const sprint: Sprint = {
    id: uuidv4(),
    name: input.name.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    goal: input.goal?.trim() ?? '',
    taskIds: [],
    completed: false
  }

  return { ...data, sprints: [...data.sprints, sprint] }
}

export function updateSprint(
  data: DataPayload,
  sprintId: string,
  patch: Partial<Pick<Sprint, 'name' | 'startDate' | 'endDate' | 'goal' | 'taskIds' | 'completed'>>
): DataPayload {
  return {
    ...data,
    sprints: data.sprints.map((sprint) =>
      sprint.id === sprintId ? { ...sprint, ...patch } : sprint
    )
  }
}

export function deleteSprint(data: DataPayload, sprintId: string): DataPayload {
  return {
    ...data,
    sprints: data.sprints.filter((sprint) => sprint.id !== sprintId)
  }
}

export function assignTasksToSprint(
  data: DataPayload,
  sprintId: string,
  taskIds: string[]
): DataPayload {
  return updateSprint(data, sprintId, { taskIds })
}

export function getSprintProgress(data: DataPayload, sprint: Sprint): {
  total: number
  done: number
  percent: number
} {
  const tasks = sprint.taskIds
    .map((id) => data.tasks.find((task) => task.id === id))
    .filter((task): task is NonNullable<typeof task> => Boolean(task))

  const done = tasks.filter((task) => task.status === 'done').length
  const total = tasks.length

  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100)
  }
}