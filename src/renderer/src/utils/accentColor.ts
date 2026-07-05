export function applyAccentColor(accentColor: string): void {
  const accent = accentColor || '#3b82f6'
  const root = document.documentElement
  root.style.setProperty('--accent', accent)
  root.style.setProperty('--accent-muted', `${accent}33`)
}