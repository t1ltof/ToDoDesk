import { execFileSync } from 'child_process'
import { nativeImage } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { SyncStatus } from './syncScheduler'
import { getTrayIconPath } from './resources'

const badgeDir = join(tmpdir(), 'tododesk-tray')

function escapePsString(value: string): string {
  return value.replace(/'/g, "''")
}

function syncDotColor(status: SyncStatus): string | null {
  if (status === 'synced') return '220, 34, 197, 94'
  if (status === 'pending') return '220, 234, 179, 8'
  if (status === 'error') return '220, 239, 68, 68'
  return null
}

export function createTrayIconWithCount(
  count: number,
  overdueCount = 0,
  syncStatus: SyncStatus = 'disabled'
): Electron.NativeImage {
  const basePath = getTrayIconPath()
  const baseImage = nativeImage.createFromPath(basePath)
  const syncColor = count <= 0 ? syncDotColor(syncStatus) : null

  if ((count <= 0 && !syncColor) || baseImage.isEmpty()) {
    return baseImage.isEmpty() ? nativeImage.createEmpty() : baseImage.resize({ width: 16, height: 16 })
  }

  if (count <= 0 && syncColor) {
    mkdirSync(badgeDir, { recursive: true })
    const outputPath = join(badgeDir, `tray-sync-${syncStatus}.png`)
    const script = `
Add-Type -AssemblyName System.Drawing
$base = [System.Drawing.Image]::FromFile('${escapePsString(basePath)}')
$bmp = New-Object System.Drawing.Bitmap 32, 32
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.DrawImage($base, 0, 0, 32, 32)
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(${syncColor}))
$g.FillEllipse($brush, 22, 22, 8, 8)
$bmp.Save('${escapePsString(outputPath)}', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $base.Dispose()
`
    try {
      const scriptPath = join(badgeDir, 'draw-sync.ps1')
      writeFileSync(scriptPath, script, 'utf-8')
      execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
        timeout: 5000,
        windowsHide: true
      })
      if (existsSync(outputPath)) {
        const image = nativeImage.createFromPath(outputPath)
        if (!image.isEmpty()) return image.resize({ width: 16, height: 16 })
      }
    } catch {
      // fallback
    }
    return baseImage.resize({ width: 16, height: 16 })
  }

  mkdirSync(badgeDir, { recursive: true })
  const badgeKey = overdueCount > 0 ? `tray-${count}-od${overdueCount}` : `tray-${count}`
  const outputPath = join(badgeDir, `${badgeKey}.png`)
  const label = count > 99 ? '99+' : String(count)
  const badgeArgb =
    overdueCount > 0 ? '220, 220, 38, 38' : '220, 234, 88, 12'

  const script = `
Add-Type -AssemblyName System.Drawing
$base = [System.Drawing.Image]::FromFile('${escapePsString(basePath)}')
$bmp = New-Object System.Drawing.Bitmap 32, 32
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.DrawImage($base, 0, 0, 32, 32)
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(${badgeArgb}))
$g.FillEllipse($brush, 18, 0, 14, 14)
$font = New-Object System.Drawing.Font('Segoe UI', 6, [System.Drawing.FontStyle]::Bold)
$g.DrawString('${escapePsString(label)}', $font, [System.Drawing.Brushes]::White, 19, 1)
$bmp.Save('${escapePsString(outputPath)}', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $base.Dispose()
`

  try {
    const scriptPath = join(badgeDir, 'draw.ps1')
    writeFileSync(scriptPath, script, 'utf-8')
    execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      timeout: 5000,
      windowsHide: true
    })

    if (existsSync(outputPath)) {
      const image = nativeImage.createFromPath(outputPath)
      if (!image.isEmpty()) return image.resize({ width: 16, height: 16 })
    }
  } catch {
    // fallback to base icon
  }

  return baseImage.resize({ width: 16, height: 16 })
}