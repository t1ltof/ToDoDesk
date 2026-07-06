import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mergeById } from '../src/shared/mergeById.ts'

describe('mergeById', () => {
  it('appends only items with new ids', () => {
    const current = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 }
    ]
    const imported = [
      { id: 'b', value: 99 },
      { id: 'c', value: 3 }
    ]

    const merged = mergeById(current, imported)

    assert.deepEqual(merged, [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'c', value: 3 }
    ])
  })
})