import assert from 'node:assert/strict'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { SignJWT } from 'jose'

process.env.DATABASE_URL ??= 'postgres://tododesk:tododesk@127.0.0.1:9/tododesk'
process.env.JWT_SECRET ??= 'test-jwt-secret-value'
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'tododesk-uploads-'))
delete process.env.TRUST_PROXY

const { config } = await import('../dist/config.js')
const { createApp } = await import('../dist/app.js')
const { registerRoutes } = await import('../dist/routes.js')
const { registerAttachmentRoutes } = await import('../dist/attachments.js')
const { signAccessToken } = await import('../dist/tokens.js')
const { closeDb } = await import('../dist/db.js')

const app = createApp({ logger: false })
await registerRoutes(app)
await registerAttachmentRoutes(app)

after(async () => {
  await app.close()
  await closeDb()
})

async function login(forwardedFor, remoteAddress = '127.0.0.1') {
  return app.inject({
    method: 'POST',
    url: '/auth/login',
    remoteAddress,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': forwardedFor
    },
    payload: '{}'
  })
}

describe('trustProxy login limit', { concurrency: 1 }, () => {
  it('trusts only the configured proxy address', () => {
    assert.equal(config.trustProxy, '127.0.0.1')
  })

  it('counts logins per forwarded client when the peer is nginx', async () => {
    for (let n = 0; n < 10; n += 1) {
      const response = await login('203.0.113.10')
      assert.equal(response.statusCode, 400)
    }
    const blocked = await login('203.0.113.10')
    assert.equal(blocked.statusCode, 429)
    assert.equal(blocked.json().error, 'Слишком много попыток входа')

    const other = await login('203.0.113.11')
    assert.equal(other.statusCode, 400)
  })

  it('does not honor X-Forwarded-For from an untrusted peer', async () => {
    for (let n = 1; n <= 10; n += 1) {
      const response = await login(`198.51.100.${n}`, '203.0.113.50')
      assert.equal(response.statusCode, 400)
    }
    const blocked = await login('198.51.100.99', '203.0.113.50')
    assert.equal(blocked.statusCode, 429)
  })

  it('treats an IPv4-mapped loopback peer as the trusted proxy', async () => {
    for (let n = 0; n < 10; n += 1) {
      const response = await login('203.0.113.40', '::ffff:127.0.0.1')
      assert.equal(response.statusCode, 400)
    }
    const blocked = await login('203.0.113.40', '::ffff:127.0.0.1')
    assert.equal(blocked.statusCode, 429)
    const other = await login('203.0.113.41', '::ffff:127.0.0.1')
    assert.equal(other.statusCode, 400)
  })
})

async function expiredAccessToken() {
  return new SignJWT({ login: 'alice' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('11111111-1111-1111-1111-111111111111')
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(new TextEncoder().encode(process.env.JWT_SECRET))
}

async function postFile(headers) {
  return app.inject({
    method: 'POST',
    url: '/projects/proj-1/attachments',
    headers: {
      'content-type': 'application/octet-stream',
      ...headers
    },
    payload: Buffer.from('hello')
  })
}

describe('attachment errors', { concurrency: 1 }, () => {
  it('returns 401 for a missing, expired, or invalid access token', async () => {
    const expired = await expiredAccessToken()
    const cases = [
      ['POST', '/projects/proj-1/attachments', {}],
      ['POST', '/projects/proj-1/attachments', { authorization: 'Bearer not-a-jwt' }],
      ['POST', '/projects/proj-1/attachments', { authorization: `Bearer ${expired}` }],
      ['GET', '/projects/proj-1/attachments/file-1', { authorization: 'Bearer not-a-jwt' }],
      ['DELETE', '/projects/proj-1/attachments/file-1', { authorization: `Bearer ${expired}` }]
    ]
    for (const [method, url, headers] of cases) {
      const response = await app.inject({
        method,
        url,
        headers: {
          'content-type': 'application/octet-stream',
          ...headers
        },
        payload: method === 'POST' ? Buffer.from('hello') : undefined
      })
      assert.equal(response.statusCode, 401, `${method} ${url}`)
      assert.equal(response.json().error, 'Unauthorized')
    }
  })

  it('returns 400 for a malformed x-file-name and does not store the file', async () => {
    const token = await signAccessToken('11111111-1111-1111-1111-111111111111', 'alice')
    for (const name of ['%', '%ZZ', '%E0%A4%A', 'a%2']) {
      const response = await postFile({
        authorization: `Bearer ${token}`,
        'x-file-name': name
      })
      assert.equal(response.statusCode, 400, name)
      assert.equal(response.json().error, 'Некорректное имя файла')
    }
    assert.equal(existsSync(join(process.env.UPLOAD_DIR, 'proj-1')), false)
  })
})
