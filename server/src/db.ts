import { readFileSync } from 'node:fs'
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
  const sql = readFileSync(join(dir, '001_init.sql'), 'utf8')
  await pool.query(sql)
}

export async function closeDb(): Promise<void> {
  await pool.end()
}
