import type { CSSProperties } from 'react'

export const DEFAULT_BOARD_BACKGROUND = '#3d2b1f'

export const BOARD_BACKGROUND_PRESETS: Array<{ label: string; color: string }> = [
  { label: 'Пробка', color: '#3d2b1f' },
  { label: 'Графит', color: '#2a2d34' },
  { label: 'Сланец', color: '#3a4254' },
  { label: 'Морской', color: '#1e3a5f' },
  { label: 'Лес', color: '#1e3a2f' },
  { label: 'Бордо', color: '#3d1f2a' },
  { label: 'Песок', color: '#5c4a32' },
  { label: 'Ночь', color: '#151820' }
]

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  }
}

export function normalizeBoardBackground(color: string | undefined): string {
  if (!color) return DEFAULT_BOARD_BACKGROUND
  return parseHex(color) ? `#${color.replace('#', '').toLowerCase()}` : DEFAULT_BOARD_BACKGROUND
}

function shade(hex: string, amount: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex

  const mix = amount >= 0 ? 255 : 0
  const ratio = Math.abs(amount) / 100

  const channel = (value: number): number =>
    Math.round(value + (mix - value) * ratio)

  const r = channel(rgb.r).toString(16).padStart(2, '0')
  const g = channel(rgb.g).toString(16).padStart(2, '0')
  const b = channel(rgb.b).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

function gridPattern(opacity: number): string {
  return `repeating-linear-gradient(
      90deg,
      transparent,
      transparent 48px,
      rgba(0, 0, 0, ${opacity}) 48px,
      rgba(0, 0, 0, ${opacity}) 49px
    ),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 48px,
      rgba(0, 0, 0, ${opacity}) 48px,
      rgba(0, 0, 0, ${opacity}) 49px
    )`
}

export function getBoardCanvasStyle(backgroundColor: string): CSSProperties {
  const base = normalizeBoardBackground(backgroundColor)
  const darker = shade(base, -28)
  const accent = shade(base, 12)

  return {
    background: `
      radial-gradient(circle at 20% 30%, ${accent}33 0%, transparent 50%),
      radial-gradient(circle at 80% 70%, ${darker}55 0%, transparent 45%),
      ${shade(base, -38)}
    `
  }
}

export function getBoardSurfaceStyle(backgroundColor: string): CSSProperties {
  const base = normalizeBoardBackground(backgroundColor)
  const lighter = shade(base, 14)
  const darker = shade(base, -18)

  return {
    backgroundColor: base,
    backgroundImage: `
      ${gridPattern(0.03)},
      radial-gradient(ellipse at center, ${lighter} 0%, ${darker} 100%)
    `,
    boxShadow: 'inset 0 0 120px rgba(0, 0, 0, 0.45)'
  }
}