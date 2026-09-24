import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveDesktopLayout } from '../src/renderer/src/utils/desktopLayout.ts'

describe('resolveDesktopLayout', () => {
  it('keeps a full sidebar on a wide window without details', () => {
    const layout = resolveDesktopLayout({
      width: 1920,
      detailOpen: false,
      userSidebarCompact: false
    })
    assert.equal(layout.sidebarCompact, false)
    assert.equal(layout.detailNarrow, false)
    assert.equal(layout.chromeNarrow, false)
  })

  it('auto-compacts the sidebar at 1024px', () => {
    const layout = resolveDesktopLayout({
      width: 1024,
      detailOpen: false,
      userSidebarCompact: false
    })
    assert.equal(layout.sidebarCompact, true)
    assert.equal(layout.detailNarrow, true)
  })

  it('auto-compacts and narrows details when a task is open below 1280px', () => {
    const layout = resolveDesktopLayout({
      width: 1200,
      detailOpen: true,
      userSidebarCompact: false
    })
    assert.equal(layout.sidebarCompact, true)
    assert.equal(layout.detailNarrow, true)
  })

  it('honors the user compact preference on a wide window', () => {
    const layout = resolveDesktopLayout({
      width: 1920,
      detailOpen: false,
      userSidebarCompact: true
    })
    assert.equal(layout.sidebarCompact, true)
    assert.equal(layout.detailNarrow, false)
  })

  it('leaves at least 500px for the main pane at 1024px with details open', () => {
    const layout = resolveDesktopLayout({
      width: 1024,
      detailOpen: true,
      userSidebarCompact: false
    })
    const sidebar = layout.sidebarCompact ? 64 : 256
    const detail = layout.detailNarrow ? 320 : 384
    assert.ok(1024 - sidebar - detail >= 500)
  })
})
