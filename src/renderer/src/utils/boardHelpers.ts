import { v4 as uuidv4 } from 'uuid'
import type {
  BoardGroup,
  BoardLink,
  BoardNode,
  BoardNodeStyle,
  DataPayload
} from '../../../shared/schema'

export const BOARD_WIDTH = 6000
export const BOARD_HEIGHT = 4500
export const DEFAULT_NODE_WIDTH = 220
export const DEFAULT_NODE_HEIGHT = 130

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
    groupId: null
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
    groupId: null
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
      'title' | 'notes' | 'x' | 'y' | 'width' | 'height' | 'color' | 'style' | 'groupId'
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