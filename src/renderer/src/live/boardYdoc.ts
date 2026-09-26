import * as Y from 'yjs'

export type BoardEntity = Record<string, unknown> & { id: string }

export function createBoardDoc(): Y.Doc {
  return new Y.Doc()
}

export function nodesMap(doc: Y.Doc): Y.Map<BoardEntity> {
  return doc.getMap('nodes')
}

export function linksMap(doc: Y.Doc): Y.Map<BoardEntity> {
  return doc.getMap('links')
}

export function groupsMap(doc: Y.Doc): Y.Map<BoardEntity> {
  return doc.getMap('groups')
}

export function readEntities(map: Y.Map<BoardEntity>): BoardEntity[] {
  const items: BoardEntity[] = []
  map.forEach((value) => {
    if (value && typeof value === 'object' && typeof value.id === 'string') {
      items.push(value)
    }
  })
  return items
}

export function writeEntities(doc: Y.Doc, nodes: BoardEntity[], links: BoardEntity[], groups: BoardEntity[]): void {
  doc.transact(() => {
    replaceMap(nodesMap(doc), nodes)
    replaceMap(linksMap(doc), links)
    replaceMap(groupsMap(doc), groups)
  }, 'local-full')
}

function replaceMap(map: Y.Map<BoardEntity>, items: BoardEntity[]): void {
  const keep = new Set(items.map((item) => item.id))
  for (const key of [...map.keys()]) {
    if (!keep.has(key)) map.delete(key)
  }
  for (const item of items) {
    map.set(item.id, item)
  }
}

export function writePositions(
  doc: Y.Doc,
  positions: Array<{ id: string; x: number; y: number }>
): void {
  doc.transact(() => {
    const map = nodesMap(doc)
    for (const pos of positions) {
      const current = map.get(pos.id)
      if (!current) continue
      map.set(pos.id, { ...current, x: pos.x, y: pos.y })
    }
  }, 'local-pos')
}

export function encodeUpdate(update: Uint8Array): string {
  let binary = ''
  for (const byte of update) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function decodeUpdate(encoded: string): Uint8Array {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function encodeState(doc: Y.Doc): string {
  return encodeUpdate(Y.encodeStateAsUpdate(doc))
}

export function applyEncodedUpdate(doc: Y.Doc, encoded: string): void {
  Y.applyUpdate(doc, decodeUpdate(encoded), 'remote')
}
