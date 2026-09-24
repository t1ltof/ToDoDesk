import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { config } from './config.js'

const secret = new TextEncoder().encode(config.jwtSecret)

export interface AccessPayload {
  sub: string
  login: string
}

export async function signAccessToken(userId: string, login: string): Promise<string> {
  return new SignJWT({ login })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(config.accessTtl)
    .sign(secret)
}

export async function verifyAccessToken(token: string): Promise<AccessPayload> {
  const { payload } = await jwtVerify(token, secret)
  const sub = payload.sub
  const login = payload.login
  if (!sub || typeof login !== 'string') {
    throw new Error('Invalid token')
  }
  return { sub, login }
}

export function createRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url')
  const hash = hashRefreshToken(token)
  const expiresAt = new Date(Date.now() + config.refreshDays * 86_400_000)
  return { token, hash, expiresAt }
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function newId(): string {
  return randomUUID()
}
