import { readCloudSession } from './cloudAuth'

type LiveHandler = (message: Record<string, unknown>) => void

let socket: WebSocket | null = null
let handler: LiveHandler | null = null
let currentBoard: string | null = null

function wsUrl(serverUrl: string): string {
  return serverUrl.replace(/^http/, 'ws') + '/ws/board'
}

export function setBoardLiveHandler(next: LiveHandler | null): void {
  handler = next
}

export function connectBoardLive(boardId: string): boolean {
  const session = readCloudSession()
  if (!session) return false
  disconnectBoardLive()
  currentBoard = boardId
  const url = `${wsUrl(session.serverUrl)}?token=${encodeURIComponent(session.accessToken)}&board=${encodeURIComponent(boardId)}`
  const ws = new WebSocket(url)
  socket = ws
  ws.addEventListener('message', (event) => {
    try {
      const payload = JSON.parse(String(event.data)) as Record<string, unknown>
      handler?.(payload)
    } catch {
      // ignore malformed frames
    }
  })
  ws.addEventListener('close', () => {
    if (socket === ws) socket = null
  })
  return true
}

export function sendBoardLive(payload: Record<string, unknown>): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify(payload))
}

export function disconnectBoardLive(): void {
  currentBoard = null
  socket?.close()
  socket = null
}

export function currentLiveBoard(): string | null {
  return currentBoard
}
