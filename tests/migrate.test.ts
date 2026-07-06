import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createEmptyData, migratePayload } from '../src/shared/schema.ts'

describe('migratePayload', () => {
  it('adds v0.8 fields to legacy payload', () => {
    const legacy = {
      projects: [],
      tags: [],
      tasks: [],
      taskTags: [],
      checklistItems: [],
      reminders: [],
      settings: {}
    }

    const migrated = migratePayload(legacy)
    assert.deepEqual(migrated.taskAttachments, [])
    assert.deepEqual(migrated.sprints, [])
    assert.deepEqual(migrated.boardSnapshots, [])
    assert.deepEqual(migrated.smartRules, [])
    assert.deepEqual(migrated.drafts, [])
    assert.deepEqual(migrated.boardHistory, [])
  })

  it('preserves boardHistory without truncating on load', () => {
    const entries = Array.from({ length: 25 }, () => ({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      nodes: [],
      links: []
    }))

    const migrated = migratePayload({
      ...createEmptyData(),
      boardHistory: entries
    })

    assert.equal(migrated.boardHistory.length, 25)
  })

  it('adds v1.0 sync and export settings defaults', () => {
    const migrated = migratePayload({ ...createEmptyData(), settings: {} })
    assert.equal(migrated.settings.syncAutoPushEnabled, false)
    assert.equal(migrated.settings.syncAutoPushIntervalMinutes, 5)
    assert.equal(migrated.settings.scheduledExportEnabled, false)
    assert.equal(migrated.settings.scheduledExportFormat, 'tododesk')
  })
})