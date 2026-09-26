import * as Y from 'yjs'
import type { FastifyInstance } from 'fastify'
import { query } from './db.js'
import { verifyAccessToken } from './tokens.js'

interface Room {
  doc: Y.Doc
  sockets: Set<LiveSocket>
  saveTimer: ReturnType<typeof setTimeout> | null
}

interface LiveSocket {
  send: (data: string) => void
  userId: string
  login: string
  displayName: string
  role: 'owner' | 'admin' | 'editor' | 'viewer' | 'self'
  presence?: Presence
}

export interface Presence {
  userId: string
  displayName: string
  nodeId: string | null
  cursor: { x: number; y: number } | null
}

const rooms = new Map<string, Room>()

function encodeUpdate(update: Uint8Array): string {
  return Buffer.from(update).toString('base64')
}

function decodeUpdate(encoded: string): Uint8Array {
  return new Uint8Array(Buffer.from(encoded, 'base64'))
}

async function loadDoc(boardId: string): Promise<Y.Doc> {
  const doc = new Y.Doc()
  const result = await query<{ state: Buffer }>('SELECT state FROM board_docs WHERE board_id = $1', [boardId])
  const row = result.rows[0]
  if (row?.state) {
    Y.applyUpdate(doc, new Uint8Array(row.state))
  }
  return doc
}

function scheduleSave(boardId: string, room: Room): void {
  if (room.saveTimer) clearTimeout(room.saveTimer)
  room.saveTimer = setTimeout(() => {
    const state = Buffer.from(Y.encodeStateAsUpdate(room.doc))
    void query(
      `INSERT INTO board_docs (board_id, state, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (board_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
      [boardId, state]
    )
  }, 1500)
}

async function getRoom(boardId: string): Promise<Room> {
  const existing = rooms.get(boardId)
  if (existing) return existing
  const doc = await loadDoc(boardId)
  const room: Room = { doc, sockets: new Set(), saveTimer: null }
  rooms.set(boardId, room)
  return room
}

function presenceList(room: Room): Presence[] {
  return [...room.sockets]
    .map((socket) => socket.presence)
    .filter((item): item is Presence => Boolean(item))
}

async function authorizeBoard(
  userId: string,
  board: string
): Promise<{ boardId: string; role: LiveSocket['role'] } | null> {
  if (board === 'personal' || board.startsWith('personal:')) {
    return { boardId: `personal:${userId}`, role: 'self' }
  }
  const projectId = board.startsWith('project:') ? board.slice('project:'.length) : board
  const member = await query<{ role: LiveSocket['role'] }>(
    'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  )
  const role = member.rows[0]?.role
  if (!role) return null
  return { boardId: `project:${projectId}`, role }
}

export async function registerBoardLive(app: FastifyInstance): Promise<void> {
  await app.register((await import('@fastify/websocket')).default)

  app.get('/ws/board', { websocket: true }, (socket, request) => {
    const queryParams = request.query as { token?: string; board?: string }
    void (async () => {
      try {
        if (!queryParams.token || !queryParams.board) {
          socket.close()
          return
        }
        const payload = await verifyAccessToken(queryParams.token)
        const user = await query<{ login: string; display_name: string }>(
          'SELECT login, display_name FROM users WHERE id = $1',
          [payload.sub]
        )
        const row = user.rows[0]
        if (!row) {
          socket.close()
          return
        }
        const auth = await authorizeBoard(payload.sub, queryParams.board)
        if (!auth) {
          socket.close()
          return
        }
        const room = await getRoom(auth.boardId)
        const live: LiveSocket = {
          send: (data) => socket.send(data),
          userId: payload.sub,
          login: row.login,
          displayName: row.display_name,
          role: auth.role
        }
        room.sockets.add(live)
        socket.send(
          JSON.stringify({
            type: 'sync',
            update: encodeUpdate(Y.encodeStateAsUpdate(room.doc)),
            presence: presenceList(room)
          })
        )

        socket.on('message', (raw: Buffer | string) => {
          let message: {
            type?: string
            update?: string
            nodeId?: string | null
            cursor?: { x: number; y: number } | null
          }
          try {
            message = JSON.parse(String(raw)) as typeof message
          } catch {
            return
          }
          if (message.type === 'update' && message.update) {
            if (live.role === 'viewer') return
            const update = decodeUpdate(message.update)
            Y.applyUpdate(room.doc, update)
            scheduleSave(auth.boardId, room)
            const payloadOut = JSON.stringify({ type: 'update', update: message.update, from: live.userId })
            for (const peer of room.sockets) {
              if (peer !== live) peer.send(payloadOut)
            }
            return
          }
          if (message.type === 'presence') {
            live.presence = {
              userId: live.userId,
              displayName: live.displayName,
              nodeId: message.nodeId ?? null,
              cursor: message.cursor ?? null
            }
            const payloadOut = JSON.stringify({ type: 'presence', peers: presenceList(room) })
            for (const peer of room.sockets) peer.send(payloadOut)
          }
        })

        socket.on('close', () => {
          room.sockets.delete(live)
          const payloadOut = JSON.stringify({ type: 'presence', peers: presenceList(room) })
          for (const peer of room.sockets) peer.send(payloadOut)
        })
      } catch {
        socket.close()
      }
    })()
  })
}
