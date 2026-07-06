import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createEmptyData } from '../src/shared/schema.ts'
import { applyCalendarFilters, filterNotes } from '../src/renderer/src/utils/calendarFilters.ts'

describe('applyCalendarFilters', () => {
  it('filters tasks by search, project and importance', () => {
    const base = createEmptyData()
    const projectId = '11111111-1111-4111-8111-111111111111'
    const taskId = '22222222-2222-4222-8222-222222222222'

    base.projects.push({
      id: projectId,
      name: 'Work',
      color: '#3b82f6',
      icon: '',
      sortOrder: 0,
      archived: false
    })
    base.tasks.push(
      {
        id: taskId,
        projectId,
        parentId: null,
        title: 'Important report',
        description: 'quarterly',
        status: 'todo',
        priority: 'important',
        dueDate: '2026-07-10',
        dueDateEnd: null,
        dueTime: null,
        timeOfDay: null,
        completedAt: null,
        recurrence: 'none',
        recurrenceExceptions: [],
        dependsOnTaskId: null,
        pinned: false,
        archived: false,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        projectId: null,
        parentId: null,
        title: 'Other task',
        description: '',
        status: 'todo',
        priority: 'normal',
        dueDate: '2026-07-11',
        dueDateEnd: null,
        dueTime: null,
        timeOfDay: null,
        completedAt: null,
        recurrence: 'none',
        recurrenceExceptions: [],
        dependsOnTaskId: null,
        pinned: false,
        archived: false,
        sortOrder: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    )

    const filtered = applyCalendarFilters(base, {
      search: 'report',
      projectId,
      tagId: null,
      importantOnly: true
    })

    assert.equal(filtered.tasks.length, 1)
    assert.equal(filtered.tasks[0]?.id, taskId)
  })
})

describe('filterNotes', () => {
  it('matches title and content', () => {
    const base = createEmptyData()
    base.notes.push(
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Ideas',
        content: 'buy milk',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        title: 'Work',
        content: 'meeting notes',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    )

    const matches = filterNotes(base, 'milk')
    assert.equal(matches.length, 1)
    assert.equal(matches[0]?.title, 'Ideas')
  })
})