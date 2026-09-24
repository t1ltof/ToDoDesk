import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createEmptyData } from '../src/shared/schema.ts'
import { clearCompletedTasks, syncReminder } from '../src/renderer/src/utils/taskHelpers.ts'

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

describe('clearCompletedTasks', () => {
  it('removes attachment records and deletes files for done tasks', () => {
    const deleted: string[] = []
    ;(globalThis as { window?: { tododesk: { deleteAttachmentFile: (path: string) => void } } }).window = {
      tododesk: {
        deleteAttachmentFile: (path: string) => {
          deleted.push(path)
        }
      }
    }

    const taskId = '11111111-1111-4111-8111-111111111111'
    const openId = '33333333-3333-4333-8333-333333333333'
    const base = createEmptyData()
    const data = {
      ...base,
      tasks: [
        {
          id: taskId,
          projectId: null,
          parentId: null,
          title: 'Done',
          description: '',
          status: 'done' as const,
          priority: 'normal' as const,
          dueDate: null,
          dueDateEnd: null,
          dueTime: null,
          timeOfDay: null,
          completedAt: '2026-07-10T00:00:00.000Z',
          recurrence: 'none' as const,
          recurrenceExceptions: [],
          dependsOnTaskId: null,
          pinned: false,
          archived: false,
          sortOrder: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        },
        {
          id: openId,
          projectId: null,
          parentId: null,
          title: 'Open',
          description: '',
          status: 'todo' as const,
          priority: 'normal' as const,
          dueDate: null,
          dueDateEnd: null,
          dueTime: null,
          timeOfDay: null,
          completedAt: null,
          recurrence: 'none' as const,
          recurrenceExceptions: [],
          dependsOnTaskId: null,
          pinned: false,
          archived: false,
          sortOrder: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ],
      taskAttachments: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          taskId,
          fileName: 'done.txt',
          filePath: 'attachments/done.txt',
          addedAt: '2026-01-01T00:00:00.000Z'
        },
        {
          id: '55555555-5555-4555-8555-555555555555',
          taskId: openId,
          fileName: 'open.txt',
          filePath: 'attachments/open.txt',
          addedAt: '2026-01-01T00:00:00.000Z'
        }
      ]
    }

    const next = clearCompletedTasks(data)
    assert.equal(next.tasks.some((task) => task.id === taskId), false)
    assert.equal(next.tasks.some((task) => task.id === openId), true)
    assert.equal(next.taskAttachments.length, 1)
    assert.equal(next.taskAttachments[0].taskId, openId)
    assert.deepEqual(deleted, ['attachments/done.txt'])
  })
})