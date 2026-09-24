type SocketLike = { send: (data: string) => void }

const rooms = new Map<string, Set<SocketLike>>()

export function joinProject(projectId: string, socket: SocketLike): void {
  const set = rooms.get(projectId) ?? new Set<SocketLike>()
  set.add(socket)
  rooms.set(projectId, set)
}

export function leaveAll(socket: SocketLike): void {
  for (const set of rooms.values()) {
    set.delete(socket)
  }
}

export function broadcastProject(projectId: string, payload: unknown): void {
  const set = rooms.get(projectId)
  if (!set) return
  const message = JSON.stringify(payload)
  for (const socket of set) {
    try {
      socket.send(message)
    } catch {
      set.delete(socket)
    }
  }
}
