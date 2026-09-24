import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { config } from './config.js'

const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 })

export function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params)
}

export async function migrate(): Promise<void> {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
  for (const file of files) {
    await pool.query(readFileSync(join(dir, file), 'utf8'))
  }
}

export async function closeDb(): Promise<void> {
  await pool.end()
}
