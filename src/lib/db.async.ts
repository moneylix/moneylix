/**
 * Async Database Compatibility Layer
 * 
 * This wraps the synchronous better-sqlite3 methods in async functions,
 * providing the same interface as db.postgres.ts will have.
 * 
 * Migration path:
 *   1. All routes import from '@/lib/db.async' (this file) — uses SQLite under the hood
 *   2. When PostgreSQL is ready, swap this import to '@/lib/db.postgres'
 *   3. No other code changes needed — same async interface
 * 
 * Interface:
 *   dbQuery.all<T>(sql, params?) → Promise<T[]>
 *   dbQuery.get<T>(sql, params?) → Promise<T | null>
 *   dbQuery.run(sql, params?) → Promise<{ changes: number; lastInsertRowid: number | bigint }>
 *   dbQuery.transaction<T>(fn) → Promise<T>
 */

import syncDb from './db'

type Params = unknown[]

export interface RunResult {
  changes: number
  lastInsertRowid: number | bigint
}

export const dbQuery = {
  async all<T = Record<string, unknown>>(sql: string, params: Params = []): Promise<T[]> {
    return syncDb.all<T>(sql, params)
  },

  async get<T = Record<string, unknown>>(sql: string, params: Params = []): Promise<T | null> {
    return syncDb.get<T>(sql, params)
  },

  async run(sql: string, params: Params = []): Promise<RunResult> {
    return syncDb.run(sql, params)
  },

  async transaction<T>(fn: (db: any) => T): Promise<T> {
    return syncDb.transaction(fn)
  },
}

export default dbQuery
