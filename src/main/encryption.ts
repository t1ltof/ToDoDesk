import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 12
const SALT_LENGTH = 16

export interface EncryptedEnvelope {
  format: 'tododesk-encrypted'
  salt: string
  iv: string
  tag: string
  payload: string
}

let cachedPassword: string | null = null

export function setDataPassword(password: string | null): void {
  cachedPassword = password
}

export function getDataPassword(): string | null {
  return cachedPassword
}

export function isEncrypted(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as Partial<EncryptedEnvelope>
    return parsed.format === 'tododesk-encrypted'
  } catch {
    return false
  }
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH)
}

export function encrypt(plainText: string, password: string): string {
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const key = deriveKey(password, salt)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()

  const envelope: EncryptedEnvelope = {
    format: 'tododesk-encrypted',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    payload: encrypted.toString('base64')
  }

  return JSON.stringify(envelope)
}

export function decrypt(raw: string, password: string): string {
  const envelope = JSON.parse(raw) as EncryptedEnvelope
  if (envelope.format !== 'tododesk-encrypted') {
    throw new Error('Файл не зашифрован')
  }

  const salt = Buffer.from(envelope.salt, 'base64')
  const iv = Buffer.from(envelope.iv, 'base64')
  const tag = Buffer.from(envelope.tag, 'base64')
  const payload = Buffer.from(envelope.payload, 'base64')
  const key = deriveKey(password, salt)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf-8')
}