import { useEffect, useRef, useState } from 'react'
import type { BoardGroup, BoardLink, BoardNode, DataPayload } from '../../../shared/schema'
import {
  applyEncodedUpdate,
  createBoardDoc,
  encodeUpdate,
  groupsMap,
  linksMap,
  nodesMap,
  readEntities,
  writeEntities,
  writePositions
} from '../live/boardYdoc'
import { useAppStore } from '../store/useAppStore'
import type { PresencePeer } from '../../../shared/cloud'

function boardIdFor(boardKey: string | null): string {
  return boardKey ? `project:${boardKey}` : 'personal'
}

function asNodes(items: ReturnType<typeof readEntities>): BoardNode[] {
  return items as unknown as BoardNode[]
}

function asLinks(items: ReturnType<typeof readEntities>): BoardLink[] {
  return items as unknown as BoardLink[]
}

function asGroups(items: ReturnType<typeof readEntities>): BoardGroup[] {
  return items as unknown as BoardGroup[]
}

export function useBoardLive(boardKey: string | null, canEdit: boolean): {
  live: boolean
  peers: PresencePeer[]
  pushBoard: (data: DataPayload) => void
  pushPositions: (positions: Array<{ id: string; x: number; y: number }>) => void
  setPresence: (nodeId: string | null) => void
} {
  const profileMode = useAppStore((state) => state.data.settings.profileMode)
  const live = profileMode === 'cloud'
  const docRef = useRef(createBoardDoc())
  const [peers, setPeers] = useState<PresencePeer[]>([])
  const seeded = useRef(false)

  useEffect(() => {
    if (!live) return
    const doc = createBoardDoc()
    docRef.current = doc
    seeded.current = false
    const unsubscribe = window.tododesk.onBoardLiveMessage((message) => {
      if (message.type === 'sync' && typeof message.update === 'string') {
        applyEncodedUpdate(doc, message.update)
        seeded.current = true
        const current = useAppStore.getState().data
        const localNodes = current.boardNodes.filter((node) => (node.projectId ?? null) === boardKey)
        const localLinks = current.boardLinks.filter((link) => (link.projectId ?? null) === boardKey)
        const localGroups = current.boardGroups.filter((group) => (group.projectId ?? null) === boardKey)
        if (nodesMap(doc).size === 0 && localNodes.length > 0) {
          writeEntities(doc, localNodes, localLinks, localGroups)
        }
        const latest = useAppStore.getState().data
        useAppStore.setState({
          data: {
            ...latest,
            boardNodes: [
              ...latest.boardNodes.filter((node) => (node.projectId ?? null) !== boardKey),
              ...asNodes(readEntities(nodesMap(doc)))
            ],
            boardLinks: [
              ...latest.boardLinks.filter((link) => (link.projectId ?? null) !== boardKey),
              ...asLinks(readEntities(linksMap(doc)))
            ],
            boardGroups: [
              ...latest.boardGroups.filter((group) => (group.projectId ?? null) !== boardKey),
              ...asGroups(readEntities(groupsMap(doc)))
            ]
          }
        })
      }
      if (message.type === 'update' && typeof message.update === 'string') {
        applyEncodedUpdate(doc, message.update)
        const current = useAppStore.getState().data
        useAppStore.setState({
          data: {
            ...current,
            boardNodes: [
              ...current.boardNodes.filter((node) => (node.projectId ?? null) !== boardKey),
              ...asNodes(readEntities(nodesMap(doc)))
            ],
            boardLinks: [
              ...current.boardLinks.filter((link) => (link.projectId ?? null) !== boardKey),
              ...asLinks(readEntities(linksMap(doc)))
            ],
            boardGroups: [
              ...current.boardGroups.filter((group) => (group.projectId ?? null) !== boardKey),
              ...asGroups(readEntities(groupsMap(doc)))
            ]
          }
        })
      }
      if (message.type === 'presence' && Array.isArray(message.peers)) {
        setPeers(message.peers as PresencePeer[])
      }
    })
    window.tododesk.boardLiveJoin(boardIdFor(boardKey))
    const onUpdate = (update: Uint8Array, origin: unknown): void => {
      if (origin === 'remote' || !canEdit) return
      window.tododesk.boardLiveSend({ type: 'update', update: encodeUpdate(update) })
    }
    doc.on('update', onUpdate)
    return () => {
      doc.off('update', onUpdate)
      unsubscribe()
      window.tododesk.boardLiveLeave()
      setPeers([])
    }
  }, [boardKey, live, canEdit])

  return {
    live,
    peers,
    pushBoard: (data) => {
      if (!live || !canEdit) return
      writeEntities(
        docRef.current,
        data.boardNodes.filter((node) => (node.projectId ?? null) === boardKey),
        data.boardLinks.filter((link) => (link.projectId ?? null) === boardKey),
        data.boardGroups.filter((group) => (group.projectId ?? null) === boardKey)
      )
    },
    pushPositions: (positions) => {
      if (!live || !canEdit) return
      writePositions(docRef.current, positions)
    },
    setPresence: (nodeId) => {
      if (!live) return
      window.tododesk.boardLiveSend({ type: 'presence', nodeId })
    }
  }
}
