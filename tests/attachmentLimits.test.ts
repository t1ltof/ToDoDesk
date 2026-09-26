import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cloudAttachmentPath,
  isCloudAttachmentPath,
  parseCloudAttachmentPath
} from '../src/shared/attachmentLimits.ts'

describe('cloud attachment paths', () => {
  it('builds and parses a cloud path', () => {
    const path = cloudAttachmentPath('project-1', 'file-1')
    assert.equal(isCloudAttachmentPath(path), true)
    assert.deepEqual(parseCloudAttachmentPath(path), {
      projectId: 'project-1',
      attachmentId: 'file-1'
    })
  })

  it('rejects local attachment paths', () => {
    assert.equal(isCloudAttachmentPath('attachments/note.txt'), false)
    assert.equal(parseCloudAttachmentPath('attachments/note.txt'), null)
  })
})
