import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canManageRole, canWriteRole, revisionsConflict } from '../src/shared/accessRules.ts'

describe('share access rules', () => {
  it('lets editors write and blocks viewers', () => {
    assert.equal(canWriteRole('editor'), true)
    assert.equal(canWriteRole('viewer'), false)
    assert.equal(canManageRole('admin'), true)
    assert.equal(canManageRole('editor'), false)
  })

  it('conflicts only when the server row exists and revisions differ', () => {
    assert.equal(revisionsConflict(1, 2, true), true)
    assert.equal(revisionsConflict(2, 2, true), false)
    assert.equal(revisionsConflict(0, 0, false), false)
  })
})
