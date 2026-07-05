export interface ImportPreview {
  filePath: string
  exportedAt: string
  projectCount: number
  taskCount: number
  doneCount: number
  tagCount: number
  templateCount: number
  valid: boolean
  errors: string[]
  warnings: string[]
}