import { execFileSync } from 'child_process'
import { nativeImage } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { getTrayIconPath } from './resources'

const badgeDir = join(tmpdir(), 'tododesk-tray')

function escapePsString(value: string): string {
  return value.replace(/'/g, "''")
}

export function createTrayIconWithCount(count: number): Electron.NativeImage {
  const basePath = getTrayIconPath()
  const baseImage = nativeImage.createFromPath(basePath)

  if (count <= 0 || baseImage.isEmpty()) {
    return baseImage.isEmpty() ? nativeImage.createEmpty() : baseImage.resize({ width: 16, height: 16 })
  }

  mkdirSync(badgeDir, { recursive: true })
  const outputPath = join(badgeDir, `tray-${count}.png`)
  const label = count > 99 ? '99+' : String(count)

  const script = `
Add-Type -AssemblyName System.Drawing
$base = [System.Drawing.Image]::FromFile('${escapePsString(basePath)}')
$bmp = New-Object System.Drawing.Bitmap 32, 32
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.DrawImage($base, 0, 0, 32, 32)
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 239, 68, 68))
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