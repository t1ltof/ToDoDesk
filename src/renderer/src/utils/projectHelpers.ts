import type { DataPayload, Project } from '../../../shared/schema'

export function updateProject(
  data: DataPayload,
  projectId: string,
  patch: Partial<Pick<Project, 'name' | 'color'>>
): DataPayload {
  return {
    ...data,
    projects: data.projects.map((project) =>
      project.id === projectId ? { ...project, ...patch } : project
    )
  }
}

export function deleteProject(data: DataPayload, projectId: string): DataPayload {
  return {
    ...data,
    projects: data.projects.filter((project) => project.id !== projectId),
    tasks: data.tasks.map((task) =>
      task.projectId === projectId ? { ...task, projectId: null } : task
    )
  }
}