import argon2 from 'argon2'
import { randomUUID } from 'node:crypto'
import { closeDb, migrate, query } from './db.js'

const login = process.argv[2]?.trim().toLowerCase()
const password = process.argv[3] ?? ''
const displayName = process.argv[4]?.trim() || login

if (!login || !password) {
  console.error('Usage: npm run create-user -- <login> <password> [displayName]')
  process.exit(1)
}

await migrate()
const hash = await argon2.hash(password, { type: argon2.argon2id })
await query(
  `INSERT INTO users (id, login, password_hash, display_name)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (login) DO UPDATE SET password_hash = EXCLUDED.password_hash, display_name = EXCLUDED.display_name`,
  [randomUUID(), login, hash, displayName]
)
await closeDb()
console.log(`user ${login} ready`)
