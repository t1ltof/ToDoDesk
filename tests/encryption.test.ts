import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { decrypt, encrypt, isEncrypted } from '../src/main/encryption.ts'

describe('encryption', () => {
  it('roundtrips plaintext', () => {
    const plain = JSON.stringify({ hello: 'world' })
    const encrypted = encrypt(plain, 'test-password-123')
    assert.equal(isEncrypted(encrypted), true)
    assert.equal(decrypt(encrypted, 'test-password-123'), plain)
  })

  it('fails with wrong password', () => {
    const encrypted = encrypt('secret', 'right')
    assert.throws(() => decrypt(encrypted, 'wrong'))
  })
})