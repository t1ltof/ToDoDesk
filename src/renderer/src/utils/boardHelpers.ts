import { v4 as uuidv4 } from 'uuid'
import type {
  BoardGroup,
  BoardHistoryEntry,
  BoardLink,
  BoardNode,
  BoardNodeStyle,
  ChecklistItem,
  DataPayload,
  Task
} from '../../../shared/schema'
import { addDaysToDateKey, todayKey } from './calendarUtils'
import { isTaskBlocked } from './taskFilters'

export type BoardSnapshot = {
  id: string
  name: string
  createdAt: string
  nodes: BoardNode[]
  links: BoardLink[]
}

type DataWithSnapshots = DataPayload & { boardSnapshots?: BoardSnapshot[] }

export const BOARD_WIDTH = 6000
export const BOARD_HEIGHT = 4500
export const DEFAULT_NODE_WIDTH = 220
export const DEFAULT_NODE_HEIGHT = 130
export const MAX_BOARD_HISTORY = 20

function cloneBoardState(data: DataPayload): BoardHistoryEntry {
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    nodes: data.boardNodes.map((node) => ({ ...node })),
    links: data.boardLinks.map((link) => ({ ...link }))
  }
}

/** Push current board state to history, then apply the next payload. */
export function withBoardHistory(before: DataPayload, after: DataPayload): DataPayload {
  const entry = cloneBoardState(before)
  const history = [...before.boardHistory, entry].slice(-MAX_BOARD_HISTORY)
  return { ...after, boardHistory: history }
}

export function undoBoardHistory(data: DataPayload): DataPayload | null {
  if (data.boardHistory.length === 0) return null
  const history = [...data.boardHistory]
  const previous = history[history.length - 1]
  return {
    ...data,
    boardNodes: previous.nodes.map((node) => ({ ...node })),
    boardLinks: previous.links.map((link) => ({ ...link })),
    boardHistory: history.slice(0, -1)
  }
}

export function createIdeaNode(x: number, y: number, title = 'Новая идея'): BoardNode {
  return {
    id: uuidv4(),
    kind: 'idea',
    taskId: null,
    title,
    notes: '',
    x,
    y,
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT,
    color: '#d97706',
    style: 'card',
    groupId: null,
    imagePath: null
  }
}

export function createTaskNode(
  taskId: string,
  title: string,
  x: number,
  y: number,
  color = '#3b82f6'
): BoardNode {
  return {
    id: uuidv4(),
    kind: 'task',
    taskId,
    title,
    notes: '',
    x,
    y,
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT,
    color,
    style: 'card',
    groupId: null,
    imagePath: null
  }
}

export function createBoardGroup(
  x: number,
  y: number,
  title = 'Группа',
  width = 480,
  height = 320,
  color = '#78350f'
): BoardGroup {
  return {
    id: uuidv4(),
    title,
    x,
    y,
    width,
    height,
    color
  }
}

export function addBoardNode(data: DataPayload, node: BoardNode): DataPayload {
  return { ...data, boardNodes: [...data.boardNodes, node] }
}

export function updateBoardNode(
  data: DataPayload,
  nodeId: string,
  patch: Partial<
    Pick<
      BoardNode,
      'title' | 'notes' | 'x' | 'y' | 'width' | 'height' | 'color' | 'style' | 'groupId' | 'imagePath'
    >
  >
): DataPayload {
  return {
    ...data,
    boardNodes: data.boardNodes.map((node) =>
      node.id === nodeId ? { ...node, ...patch } : node
    )
  }
}

export function moveBoardNodes(
  data: DataPayload,
  positions: Array<{ nodeId: string; x: number; y: number }>
): DataPayload {
  const posMap = new Map(positions.map((p) => [p.nodeId, p]))
  return {
    ...data,
    boardNodes: data.boardNodes.map((node) => {
      const pos = posMap.get(node.id)
      return pos ? { ...node, x: pos.x, y: pos.y } : node
    })
  }
}

export function clampNodePosition(x: number, y: number, width = 220, height = 130): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(BOARD_WIDTH - width, x)),
    y: Math.max(0, Math.min(BOARD_HEIGHT - height, y))
  }
}

export function deleteBoardNode(data: DataPayload, nodeId: string): DataPayload {
  return {
    ...data,
    boardNodes: data.boardNodes.filter((node) => node.id !== nodeId),
    boardLinks: data.boardLinks.filter(
      (link) => link.fromNodeId !== nodeId && link.toNodeId !== nodeId
    )
  }
}

export function addBoardGroup(data: DataPayload, group: BoardGroup): DataPayload {
  return { ...data, boardGroups: [...(data.boardGroups ?? []), group] }
}

export function updateBoardGroup(
  data: DataPayload,
  groupId: string,
  patch: Partial<Pick<BoardGroup, 'title' | 'x' | 'y' | 'width' | 'height' | 'color'>>
): DataPayload {
  return {
    ...data,
    boardGroups: (data.boardGroups ?? []).map((group) =>
      group.id === groupId ? { ...group, ...patch } : group
    )
  }
}

export function deleteBoardGroup(data: DataPayload, groupId: string): DataPayload {
  return {
    ...data,
    boardGroups: (data.boardGroups ?? []).filter((group) => group.id !== groupId),
    boardNodes: data.boardNodes.map((node) =>
      node.groupId === groupId ? { ...node, groupId: null } : node
    )
  }
}

export function addBoardLink(
  data: DataPayload,
  fromNodeId: string,
  toNodeId: string,
  label = ''
): DataPayload {
  if (fromNodeId === toNodeId) return data

  const exists = data.boardLinks.some(
    (link) =>
      (link.fromNodeId === fromNodeId && link.toNodeId === toNodeId) ||
      (link.fromNodeId === toNodeId && link.toNodeId === fromNodeId)
  )
  if (exists) return data

  const link: BoardLink = { id: uuidv4(), fromNodeId, toNodeId, label }
  return { ...data, boardLinks: [...data.boardLinks, link] }
}

export function updateBoardLink(
  data: DataPayload,
  linkId: string,
  patch: Partial<Pick<BoardLink, 'label' | 'fromNodeId' | 'toNodeId'>>
): DataPayload {
  return {
    ...data,
    boardLinks: data.boardLinks.map((link) =>
      link.id === linkId ? { ...link, ...patch } : link
    )
  }
}

export function deleteBoardLink(data: DataPayload, linkId: string): DataPayload {
  return {
    ...data,
    boardLinks: data.boardLinks.filter((link) => link.id !== linkId)
  }
}

export function getNodeCenter(node: BoardNode): { x: number; y: number } {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2
  }
}

export function suggestLinkOnProximity(
  nodes: BoardNode[],
  movedNodeId: string,
  threshold = 120
): { fromNodeId: string; toNodeId: string } | null {
  const moved = nodes.find((n) => n.id === movedNodeId)
  if (!moved) return null

  const movedCenter = getNodeCenter(moved)
  let closest: BoardNode | null = null
  let minDist = Infinity

  for (const node of nodes) {
    if (node.id === movedNodeId) continue
    const dist = Math.hypot(
      movedCenter.x - getNodeCenter(node).x,
      movedCenter.y - getNodeCenter(node).y
    )
    if (dist < threshold && dist < minDist) {
      minDist = dist
      closest = node
    }
  }

  if (!closest) return null
  return { fromNodeId: movedNodeId, toNodeId: closest.id }
}

export function getNodeStyleClasses(style: BoardNodeStyle): string {
  switch (style) {
    case 'sticker':
      return 'board-node-sticker rotate-[-1.5deg] shadow-yellow-900/40 border-yellow-600/50 bg-yellow-100/95 text-amber-950'
    case 'photo':
      return 'board-node-photo shadow-xl border-white/30 bg-gradient-to-br from-slate-700 to-slate-900 ring-2 ring-white/10'
    case 'document':
      return 'board-node-document shadow-md border-gray-400/40 bg-gray-50/95 text-gray-900 font-serif'
    case 'card':
    default:
      return 'board-node-card'
  }
}

export function getNodeAnchor(
  node: BoardNode,
  side: 'top' | 'bottom' | 'center'
): { x: number; y: number } {
  const cx = node.x + node.width / 2
  if (side === 'top') return { x: cx, y: node.y }
  if (side === 'bottom') return { x: cx, y: node.y + node.height }
  return { x: cx, y: node.y + node.height / 2 }
}

export function linkPath(from: BoardNode, to: BoardNode): string {
  const start = getNodeAnchor(from, 'bottom')
  const end = getNodeAnchor(to, 'top')
  const midY = (start.y + end.y) / 2
  return `M ${start.x} ${start.y} C ${start.x} ${midY}, ${end.x} ${midY}, ${end.x} ${end.y}`
}

export function screenToWorld(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  panX: number,
  panY: number,
  zoom: number
): { x: number; y: number } {
  return {
    x: (clientX - rect.left - panX) / zoom,
    y: (clientY - rect.top - panY) / zoom
  }
}

export function filterBoardNodes(
  nodes: BoardNode[],
  tasks: DataPayload['tasks'],
  taskTags: DataPayload['taskTags'],
  filter: { type: 'all' } | { type: 'project'; projectId: string } | { type: 'tag'; tagId: string }
): BoardNode[] {
  if (filter.type === 'all') return nodes

  const taskMap = new Map(tasks.map((t) => [t.id, t]))

  if (filter.type === 'project') {
    return nodes.filter((node) => {
      if (node.kind === 'idea') return false
      const task = node.taskId ? taskMap.get(node.taskId) : null
      return task?.projectId === filter.projectId
    })
  }

  const taggedTaskIds = new Set(
    taskTags.filter((tt) => tt.tagId === filter.tagId).map((tt) => tt.taskId)
  )
  return nodes.filter((node) => {
    if (node.kind === 'idea') return false
    return node.taskId ? taggedTaskIds.has(node.taskId) : false
  })
}

export function getBoardSnapshots(data: DataPayload): BoardSnapshot[] {
  return (data as DataWithSnapshots).boardSnapshots ?? []
}

export function saveBoardSnapshot(data: DataPayload, name: string): DataPayload {
  const snapshot: BoardSnapshot = {
    id: uuidv4(),
    name,
    createdAt: new Date().toISOString(),
    nodes: data.boardNodes.map((node) => ({ ...node })),
    links: data.boardLinks.map((link) => ({ ...link }))
  }
  const snapshots = getBoardSnapshots(data)
  return { ...data, boardSnapshots: [...snapshots, snapshot] } as DataPayload
}

export function restoreBoardSnapshot(data: DataPayload, snapshotId: string): DataPayload {
  const snapshot = getBoardSnapshots(data).find((item) => item.id === snapshotId)
  if (!snapshot) return data
  return {
    ...data,
    boardNodes: snapshot.nodes.map((node) => ({ ...node })),
    boardLinks: snapshot.links.map((link) => ({ ...link }))
  }
}

export function alignBoardNodes(
  data: DataPayload,
  nodeIds: string[],
  primaryNodeId?: string
): DataPayload {
  const ids = nodeIds.filter((id) => data.boardNodes.some((node) => node.id === id))
  if (ids.length < 2) return data

  const primaryId =
    primaryNodeId && ids.includes(primaryNodeId) ? primaryNodeId : ids[0]
  const primary = data.boardNodes.find((node) => node.id === primaryId)
  if (!primary) return data

  const targetY = primary.y
  return {
    ...data,
    boardNodes: data.boardNodes.map((node) =>
      ids.includes(node.id) && node.id !== primaryId ? { ...node, y: targetY } : node
    )
  }
}

export function gridLayoutBoardNodes(
  data: DataPayload,
  nodeIds: string[],
  gap = 20
): DataPayload {
  const selected = data.boardNodes.filter((node) => nodeIds.includes(node.id))
  if (selected.length < 2) return data

  const cols = Math.ceil(Math.sqrt(selected.length))
  const sorted = [...selected].sort((a, b) => a.y - b.y || a.x - b.x)
  const startX = Math.min(...selected.map((node) => node.x))
  const startY = Math.min(...selected.map((node) => node.y))
  const maxW = Math.max(...selected.map((node) => node.width))
  const maxH = Math.max(...selected.map((node) => node.height))

  const positions = sorted.map((node, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    const x = startX + col * (maxW + gap)
    const y = startY + row * (maxH + gap)
    const clamped = clampNodePosition(x, y, node.width, node.height)
    return { nodeId: node.id, x: clamped.x, y: clamped.y }
  })

  return moveBoardNodes(data, positions)
}

export function worldRectFromScreen(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: DOMRect,
  panX: number,
  panY: number,
  zoom: number
): { x: number; y: number; width: number; height: number } {
  const w1 = screenToWorld(x1, y1, rect, panX, panY, zoom)
  const w2 = screenToWorld(x2, y2, rect, panX, panY, zoom)
  const left = Math.min(w1.x, w2.x)
  const top = Math.min(w1.y, w2.y)
  return {
    x: left,
    y: top,
    width: Math.abs(w2.x - w1.x),
    height: Math.abs(w2.y - w1.y)
  }
}

export function nodesIntersectingRect(nodes: BoardNode[], rect: { x: number; y: number; width: number; height: number }): BoardNode[] {
  const rectRight = rect.x + rect.width
  const rectBottom = rect.y + rect.height
  return nodes.filter((node) => {
    const nodeRight = node.x + node.width
    const nodeBottom = node.y + node.height
    return !(
      node.x > rectRight ||
      nodeRight < rect.x ||
      node.y > rectBottom ||
      nodeBottom < rect.y
    )
  })
}

export function formatBoardDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null
  const today = todayKey()
  const tomorrowKey = addDaysToDateKey(today, 1)

  if (dueDate === today) return 'Сегодня'
  if (dueDate === tomorrowKey) return 'Завтра'

  const date = new Date(`${dueDate}T12:00:00`)
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function formatSlaCountdown(dueDate: string | null, status: Task['status']): string | null {
  if (!dueDate || status === 'done') return null
  const today = todayKey()
  const diff = Math.ceil(
    (new Date(`${dueDate}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) /
      86_400_000
  )
  if (diff < 0) return `просрочено ${Math.abs(diff)} дн.`
  if (diff === 0) return 'осталось 0 дн.'
  return `осталось ${diff} дн.`
}

export function getChecklistProgress(
  checklistItems: ChecklistItem[],
  taskId: string
): { done: number; total: number } | null {
  const items = checklistItems.filter((item) => item.taskId === taskId)
  if (items.length === 0) return null
  return {
    done: items.filter((item) => item.completed).length,
    total: items.length
  }
}

export function isTaskOverdue(task: Task): boolean {
  if (task.status === 'done' || !task.dueDate) return false
  return task.dueDate < todayKey()
}

export function isBoardAnimationsEnabled(data: DataPayload): boolean {
  const settings = data.settings as DataPayload['settings'] & { boardAnimations?: boolean }
  return settings.boardAnimations !== false
}

export function exportBoardPng(
  nodes: BoardNode[],
  links: BoardLink[],
  backgroundColor: string,
  filename = 'tododesk-board.png'
): void {
  const canvas = document.createElement('canvas')
  canvas.width = BOARD_WIDTH
  canvas.height = BOARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT)

  const nodeMap = new Map(nodes.map((node) => [node.id, node]))

  ctx.strokeStyle = '#dc2626'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  for (const link of links) {
    const from = nodeMap.get(link.fromNodeId)
    const to = nodeMap.get(link.toNodeId)
    if (!from || !to) continue
    const start = getNodeAnchor(from, 'bottom')
    const end = getNodeAnchor(to, 'top')
    const midY = (start.y + end.y) / 2
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.bezierCurveTo(start.x, midY, end.x, midY, end.x, end.y)
    ctx.stroke()
  }
  ctx.setLineDash([])

  for (const node of nodes) {
    ctx.fillStyle = node.kind === 'idea' ? '#d97706' : '#1e293b'
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 2
    const radius = node.style === 'sticker' ? 4 : 8
    roundRect(ctx, node.x, node.y, node.width, node.height, radius)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#f3f4f6'
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.fillText(truncateText(ctx, node.title, node.width - 16), node.x + 8, node.y + 22)

    if (node.notes) {
      ctx.fillStyle = '#9ca3af'
      ctx.font = '11px system-ui, sans-serif'
      ctx.fillText(truncateText(ctx, node.notes, node.width - 16), node.x + 8, node.y + 40)
    }
  }

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let trimmed = text
  while (trimmed.length > 0 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1)
  }
  return `${trimmed}…`
}

export function getBoardNodePreview(
  data: DataPayload,
  task: Task
): {
  dueLabel: string | null
  slaLabel: string | null
  tagNames: string[]
  checklist: { done: number; total: number } | null
  overdue: boolean
  important: boolean
  blocked: boolean
} {
  const tagIds = data.taskTags
    .filter((link) => link.taskId === task.id)
    .map((link) => link.tagId)
  const tagNames = tagIds
    .map((tagId) => data.tags.find((tag) => tag.id === tagId)?.name)
    .filter((name): name is string => Boolean(name))
    .slice(0, 2)

  return {
    dueLabel: formatBoardDueDate(task.dueDate),
    slaLabel: formatSlaCountdown(task.dueDate, task.status),
    tagNames,
    checklist: getChecklistProgress(data.checklistItems, task.id),
    overdue: isTaskOverdue(task),
    important: task.priority === 'important',
    blocked: isTaskBlocked(data, task.id)
  }
}