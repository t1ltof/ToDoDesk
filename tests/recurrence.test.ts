import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { advanceMonthlyDueDate } from '../src/shared/dateAdvance.ts'

describe('advanceMonthlyDueDate', () => {
  it('advances Jan 31 to Feb 28/29 not March', () => {
    const next = advanceMonthlyDueDate('2026-01-31')
    assert.match(next, /^2026-02-(28|29)$/)
  })
})