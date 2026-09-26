import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createBoardDoc,
  nodesMap,
  readEntities,
  writeEntities,
  writePositions
} from '../src/renderer/src/live/boardYdoc.ts'

describe('board ydoc', () => {
  it('keeps two nodes when only one position changes', () => {
    const doc = createBoardDoc()
    writeEntities(
      doc,
      [
        { id: 'a', x: 1, y: 1, title: 'A' },
        { id: 'b', x: 8, y: 8, title: 'B' }
      ],
      [],
      []
    )
    writePositions(doc, [{ id: 'a', x: 40, y: 12 }])
    const nodes = readEntities(nodesMap(doc))
    const a = nodes.find((node) => node.id === 'a')
    const b = nodes.find((node) => node.id === 'b')
    assert.equal(a?.x, 40)
    assert.equal(a?.y, 12)
    assert.equal(a?.title, 'A')
    assert.equal(b?.x, 8)
  })
})
