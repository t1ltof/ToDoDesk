import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { randomUUID } from 'node:crypto'
import { createEmptyData, type BoardNode } from '../src/shared/schema.ts'
import {
  addBoardNode,
  undoBoardHistory,
  withBoardHistory
} from '../src/renderer/src/utils/boardScope.ts'

function idea(title: string, projectId: string | null): BoardNode {
  return {
    id: randomUUID(),
    kind: 'idea',
    taskId: null,
    title,
    notes: '',
    x: 10,
    y: 10,
    width: 220,
    height: 130,
    color: '#d97706',
    style: 'card',
    groupId: null,
    imagePath: null,
    projectId
  }
}

describe('per-project board history', () => {
  it('undo restores only the board that changed', () => {
    const projectId = randomUUID()
    let data = createEmptyData()
    const personal = idea('Personal', null)
    const projectNode = idea('Project', projectId)
    data = addBoardNode(data, personal)
    data = addBoardNode(data, projectNode)

    const extra = idea('Extra', projectId)
    const after = addBoardNode(data, extra)
    data = withBoardHistory(data, after, projectId)

    const undone = undoBoardHistory(data, projectId)
    assert.ok(undone)
    assert.equal(
      undone.boardNodes.some((node) => node.id === extra.id),
      false
    )
    assert.equal(
      undone.boardNodes.some((node) => node.id === personal.id),
      true
    )
    assert.equal(
      undone.boardNodes.some((node) => node.id === projectNode.id),
      true
    )
  })
})
