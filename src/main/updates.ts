import { app } from 'electron'

const REPO = 't1ltof/ToDoDesk'

export interface UpdateInfo {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string | null
  url: string | null
  error: string | null
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = app.getVersion()
  const result: UpdateInfo = {
    hasUpdate: false,
    currentVersion,
    latestVersion: null,
    url: null,
    error: null
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ToDoDesk' }
    })

    if (!response.ok) {
      result.error = `GitHub API: ${response.status}`
      return result
    }

    const data = (await response.json()) as { tag_name?: string; html_url?: string }
    const latest = data.tag_name?.replace(/^v/, '') ?? null
    result.latestVersion = latest
    result.url = data.html_url ?? `https://github.com/${REPO}/releases`

    if (latest && compareVersions(latest, currentVersion) > 0) {
      result.hasUpdate = true
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Ошибка сети'
  }

  return result
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}