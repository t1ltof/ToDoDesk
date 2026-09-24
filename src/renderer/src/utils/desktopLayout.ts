export const DETAIL_NARROW_BELOW = 1280
export const SIDEBAR_AUTO_COMPACT_BELOW = 1100
export const SIDEBAR_AUTO_COMPACT_WITH_DETAIL_BELOW = 1280

export interface DesktopLayoutInput {
  width: number
  detailOpen: boolean
  userSidebarCompact: boolean
}

export interface DesktopLayout {
  sidebarCompact: boolean
  detailNarrow: boolean
  chromeNarrow: boolean
}

export function resolveDesktopLayout(input: DesktopLayoutInput): DesktopLayout {
  const detailNarrow = input.width < DETAIL_NARROW_BELOW
  const chromeNarrow = input.width < DETAIL_NARROW_BELOW
  const sidebarCompact =
    input.userSidebarCompact ||
    input.width < SIDEBAR_AUTO_COMPACT_BELOW ||
    (input.detailOpen && input.width < SIDEBAR_AUTO_COMPACT_WITH_DETAIL_BELOW)

  return { sidebarCompact, detailNarrow, chromeNarrow }
}
