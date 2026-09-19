/**
 * Async Database Compatibility Layer
 *
 * Routes every call to either the SQLite (better-sqlite3) or PostgreSQL
 * backend depending on whether DATABASE_URL is set. Both backends expose
 * the same async interface, so call sites never need to know which one
 * is active.
 *
 * Interface:
 *   dbQuery.all<T>(sql, params?) → Promise<T[]>
 *   dbQuery.get<T>(sql, params?) → Promise<T | null>
 *   dbQuery.run(sql, params?) → Promise<{ changes: number; lastInsertRowid: number | bigint }>
 *   dbQuery.insert(sql, params?) → Promise<{ changes: number; lastInsertRowid: number | bigint }>
 *   dbQuery.transaction<T>(fn) → Promise<T>
 *
 * dbQuery.transaction()'s callback receives an object with a single
 * `.query(sql, params)` method mirroring node-postgres's PoolClient — every
 * call site already writes `tx.query(toPgQuery(sql), params)` in
 * anticipation of the Postgres cutover. On the SQLite side, `sqliteTxQuery`
 * below reverses that same conversion (`$1,$2,... → ?`, `NOW() →
 * datetime('now')`) so the identical call sites also run correctly against
 * the local SQLite file during development.
 */

import syncDb from './db'
import pgDb from './db.postgres'

type Params = unknown[]

export interface RunResult {
  changes: number
  lastInsertRowid: number | bigint
}

interface QueryResultLike<T = Record<string, unknown>> {
  rows: T[]
  rowCount: number
}

function usePostgres(): boolean {
  return !!process.env.DATABASE_URL
}

/**
 * Reverses the two conversions toPgQuery() applies (see db.postgres.ts) —
 * the only ones any current .transaction() call site actually uses inside
 * its query text. Extend this if a future transaction block starts using
 * strftime()/date('now', ±N) too (toPgQuery has equivalents for those).
 */
function pgQueryToSqlite(sql: string): string {
  return sql
    .replace(/\$\d+/g, '?')
    .replace(/\bNOW\(\)/gi, "datetime('now')")
}

async function sqliteTxQuery<T = Record<string, unknown>>(sql: string, params: Params = []): Promise<QueryResultLike<T>> {
  const sqliteSql = pgQueryToSqlite(sql)
  if (/^\s*SELECT/i.test(sqliteSql) || /\bRETURNING\b/i.test(sqliteSql)) {
    const rows = syncDb.all<T>(sqliteSql, params)
    return { rows, rowCount: rows.length }
  }
  const info = syncDb.run(sqliteSql, params)
  return { rows: [], rowCount: info.changes }
}

export const dbQuery = {
  async all<T = Record<string, unknown>>(sql: string, params: Params = []): Promise<T[]> {
    if (usePostgres()) return pgDb.all<Record<string, unknown>>(sql, params) as Promise<T[]>
    return syncDb.all<T>(sql, params)
  },

  async get<T = Record<string, unknown>>(sql: string, params: Params = []): Promise<T | null> {
    if (usePostgres()) return pgDb.get<Record<string, unknown>>(sql, params) as Promise<T | null>
    return syncDb.get<T>(sql, params)
  },

  async run(sql: string, params: Params = []): Promise<RunResult> {
    if (usePostgres()) {
      const r = await pgDb.run(sql, params)
      return { changes: r.changes, lastInsertRowid: r.lastInsertRowid ?? 0 }
    }
    return syncDb.run(sql, params)
  },

  /**
   * Alias for run() on SQLite — better-sqlite3's .run() already returns
   * lastInsertRowid natively, no RETURNING clause needed. On Postgres,
   * db.postgres.ts's insert() appends RETURNING id since there's no
   * implicit last-inserted-rowid there.
   */
  async insert(sql: string, params: Params = []): Promise<RunResult> {
    if (usePostgres()) {
      const r = await pgDb.insert(sql, params)
      return { changes: r.changes, lastInsertRowid: r.lastInsertRowid ?? 0 }
    }
    return syncDb.run(sql, params)
  },

  /**
   * Wrap multiple writes in a single transaction. The callback receives an
   * object exposing `.query(sql, params)`, matching node-postgres's
   * PoolClient shape — on Postgres it *is* the real PoolClient; on SQLite
   * it's the sqliteTxQuery adapter above.
   *
   * Changed from: sync better-sqlite3 db.transaction(fn)(db) — required a
   * synchronous callback. Now manually brackets BEGIN/COMMIT/ROLLBACK with
   * raw statements instead, since better-sqlite3's own .transaction() HOF
   * would COMMIT as soon as an async fn returns its (still-pending) promise,
   * before any of its internal awaits actually resolve.
   */
  async transaction<T>(fn: (tx: { query: (sql: string, params?: Params) => Promise<QueryResultLike> }) => Promise<T>): Promise<T> {
    if (usePostgres()) {
      return pgDb.transaction(fn as (client: any) => Promise<T>)
    }
    syncDb.run('BEGIN')
    try {
      const result = await fn({ query: sqliteTxQuery })
      syncDb.run('COMMIT')
      return result
    } catch (err) {
      syncDb.run('ROLLBACK')
      throw err
    }
  },
}

export default dbQuery
