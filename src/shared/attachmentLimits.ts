export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
export const MAX_PROJECT_ATTACHMENT_BYTES = 50 * 1024 * 1024

export function isCloudAttachmentPath(filePath: string): boolean {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '').startsWith('cloud/')
}

export function cloudAttachmentPath(projectId: string, attachmentId: string): string {
  return `cloud/${projectId}/${attachmentId}`
}

export function parseCloudAttachmentPath(
  filePath: string
): { projectId: string; attachmentId: string } | null {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\/+/, '')
  const parts = normalized.split('/')
  if (parts.length !== 3 || parts[0] !== 'cloud' || !parts[1] || !parts[2]) return null
  return { projectId: parts[1], attachmentId: parts[2] }
}
