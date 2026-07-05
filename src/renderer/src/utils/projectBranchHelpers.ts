import { v4 as uuidv4 } from 'uuid'
import type { DataPayload, Task } from '../../../shared/schema'
import { collectDescendantIds } from './taskHelpers'

export function createProjectFromTaskBranch(
  data: DataPayload,
  rootTaskId: string,
  projectName: string
): DataPayload {
  const now = new Date().toISOString()
  const projectId = uuidv4()
  const treeIds = collectDescendantIds(data, rootTaskId)
  const idMap = new Map<string, string>()

  for (const id of treeIds) {
    idMap.set(id, uuidv4())
  }

  const treeTasks = data.tasks.filter((task) => treeIds.has(task.id))
  const clonedTasks: Task[] = treeTasks.map((task) => ({
    ...task,
    id: idMap.get(task.id)!,
    projectId,
    parentId: task.parentId ? idMap.get(task.parentId) ?? null : null,
    dependsOnTaskId:
      task.dependsOnTaskId && treeIds.has(task.dependsOnTaskId)
        ? idMap.get(task.dependsOnTaskId) ?? null
        : null,
    createdAt: now,
    updatedAt: now
  }))

  const clonedChecklist = data.checklistItems
    .filter((item) => treeIds.has(item.taskId))
    .map((item) => ({
      ...item,
      id: uuidv4(),
      taskId: idMap.get(item.taskId)!
    }))

  const clonedTags = data.taskTags
    .filter((link) => treeIds.has(link.taskId))
    .map((link) => ({
      taskId: idMap.get(link.taskId)!,
      tagId: link.tagId
    }))

  const clonedReminders = data.reminders
    .filter((item) => treeIds.has(item.taskId))
    .map((item) => ({
      ...item,
      id: uuidv4(),
      taskId: idMap.get(item.taskId)!
    }))

  const project = {
    id: projectId,
    name: projectName.trim(),
    color: '#3b82f6',
    icon: '',
    sortOrder: data.projects.length,
    archived: false
  }

  return {
    ...data,
    projects: [...data.projects, project],
    tasks: [...data.tasks, ...clonedTasks],
    checklistItems: [...data.checklistItems, ...clonedChecklist],
    taskTags: [...data.taskTags, ...clonedTags],
    reminders: [...data.reminders, ...clonedReminders]
  }
}