import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createEmptyData } from '../src/shared/schema.ts'
import { syncReminder } from '../src/renderer/src/utils/taskHelpers.ts'

describe('syncReminder', () => {
  it('preserves custom reminders when due date changes', () => {
    const base = createEmptyData()
    const taskId = '11111111-1111-4111-8111-111111111111'
    const customId = '22222222-2222-4222-8222-222222222222'

    const data = {
      ...base,
      tasks: [
        {
          id: taskId,
          projectId: null,
          parentId: null,
          title: 'Test',
          description: '',
          status: 'todo' as const,
          priority: 'normal' as const,
          dueDate: '2026-07-10',
          dueDateEnd: null,
          dueTime: null,
          timeOfDay: null,
          completedAt: null,
          recurrence: 'none' as const,
          recurrenceExceptions: [],
          dependsOnTaskId: null,
          pinned: false,
          archived: false,
          sortOrder: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ],
      reminders: [
        {
          id: customId,
          taskId,
          remindAt: '2026-07-08T15:00:00.000Z',
          kind: 'custom' as const
        }
      ]
    }

    const next = syncReminder(data, taskId, '2026-07-15')
    assert.equal(next.reminders.some((r) => r.id === customId), true)
    assert.equal(next.reminders.some((r) => r.kind === 'dueDate'), true)
  })
})