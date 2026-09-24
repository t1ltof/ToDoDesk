import { v4 as uuidv4 } from 'uuid'
import type { BoardHistoryEntry, BoardNode, DataPayload } from '../../../shared/schema'

export type BoardKey = string | null

export const MAX_BOARD_HISTORY = 20

export function isOnBoard(item: { projectId?: string | null }, boardKey: BoardKey): boolean {
  return (item.projectId ?? null) === boardKey
}

function cloneBoardState(data: DataPayload, boardKey: BoardKey): BoardHistoryEntry {
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    projectId: boardKey,
    nodes: data.boardNodes.filter((node) => isOnBoard(node, boardKey)).map((node) => ({ ...node })),
    links: data.boardLinks.filter((link) => isOnBoard(link, boardKey)).map((link) => ({ ...link }))
  }
}

export function withBoardHistory(
  before: DataPayload,
  after: DataPayload,
  boardKey: BoardKey = null
): DataPayload {
  const entry = cloneBoardState(before, boardKey)
  const history = [...before.boardHistory, entry].slice(-MAX_BOARD_HISTORY)
  return { ...after, boardHistory: history }
}

export function undoBoardHistory(data: DataPayload, boardKey: BoardKey = null): DataPayload | null {
  let index = -1
  for (let i = data.boardHistory.length - 1; i >= 0; i--) {
    if (isOnBoard(data.boardHistory[i], boardKey)) {
      index = i
      break
    }
  }
  if (index < 0) return null

  const previous = data.boardHistory[index]
  return {
    ...data,
    boardNodes: [
      ...data.boardNodes.filter((node) => !isOnBoard(node, boardKey)),
      ...previous.nodes.map((node) => ({ ...node }))
    ],
    boardLinks: [
      ...data.boardLinks.filter((link) => !isOnBoard(link, boardKey)),
      ...previous.links.map((link) => ({ ...link }))
    ],
    boardHistory: data.boardHistory.filter((_, i) => i !== index)
  }
}

export function addBoardNode(data: DataPayload, node: BoardNode): DataPayload {
  return { ...data, boardNodes: [...data.boardNodes, node] }
}
