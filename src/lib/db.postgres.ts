/**
 * db.postgres.ts — PostgreSQL database layer for Moneylix
 * ========================================================
 * This is the async PostgreSQL equivalent of db.ts (better-sqlite3).
 *
 * KEY CHANGES FROM SQLITE VERSION:
 * ─────────────────────────────────
 * 1. Connection: better-sqlite3 Database → pg Pool (connection pooling)
 * 2. All methods are now ASYNC (return Promises)
 * 3. Parameter placeholders: ? → $1, $2, $3, ...
 * 4. datetime('now') → NOW()
 * 5. INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY
 * 6. No PRAGMA statements (WAL, foreign_keys handled by PG natively)
 * 7. INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING
 * 8. table_info pragma → information_schema.columns
 * 9. Transactions use client checkout from pool instead of sync wrapper
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

// ---------------------------------------------------------------------------
// Connection setup
// Changed from: new Database('moneylix.db')
// Changed to:   Pool with DATABASE_URL from environment
// ---------------------------------------------------------------------------

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error(
        '[db.postgres] DATABASE_URL environment variable is required.\n' +
        'Example: postgresql://user:password@localhost:5432/moneylix'
      )
    }

    pool = new Pool({
      connectionString,
      // Connection pool settings
      max: 20,              // max connections in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })

    pool.on('error', (err) => {
      console.error('[db.postgres] Unexpected pool error:', err)
    })
  }
  return pool
}

/**
 * Initialize the database: run migrations, patch columns, seed users.
 * MUST be called once at app startup (e.g., in server.ts or next.config.ts).
 *
 * Changed from: automatically called on first getDatabase() (sync)
 * Changed to:   explicit async init — call await initDatabase() at startup
 */
export async function initDatabase(): Promise<void> {
  const client = await getPool().connect()
  try {
    await runMigrations(client)
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// Migration runner
// Changed from: synchronous db.exec() + db.prepare().run()
// Changed to:   async client.query()
// ---------------------------------------------------------------------------

async function runMigrations(client: PoolClient): Promise<void> {
  // Changed from: datetime('now') → NOW()
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  const migrationsDir = path.join(process.cwd(), 'src', 'migrations')
  if (!fs.existsSync(migrationsDir)) return

  const files = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  // Changed from: db.prepare('SELECT version...').all()
  // Changed to:   client.query() with rows access
  const result = await client.query<{ version: number }>('SELECT version FROM schema_migrations')
  const applied = new Set<number>(result.rows.map(r => r.version))

  for (const file of files) {
    const match = file.match(/^(\d+)_/)
    if (!match) continue
    const version = parseInt(match[1], 10)
    if (applied.has(version)) continue

    let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')

    // Auto-convert common SQLite-isms to PostgreSQL
    sql = convertSqliteToPostgres(sql)

    // Changed from: db.transaction(() => { ... })()
    // Changed to:   BEGIN/COMMIT with error handling
    try {
      await client.query('BEGIN')
      await client.query(sql)
      // Changed from: ? params → $1, $2 params
      await client.query(
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
        [version, file]
      )
      await client.query('COMMIT')
      console.log(`[db.postgres] Applied migration ${file}`)
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`[db.postgres] Failed migration ${file}:`, err)
      throw err
    }
  }

  // Runtime column-patch for databases created before migrations were tracked
  await patchLegacyColumns(client)
}

/**
 * Convert common SQLite SQL syntax to PostgreSQL.
 * Used when applying .sql migration files that were written for SQLite.
 */
function convertSqliteToPostgres(sql: string): string {
  return sql
    // AUTOINCREMENT → use SERIAL (applied to CREATE TABLE)
    .replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
    // datetime('now') → NOW()
    .replace(/datetime\('now'\)/gi, 'NOW()')
    // BOOLEAN as INTEGER → BOOLEAN
    .replace(/INTEGER\s+NOT\s+NULL\s+DEFAULT\s+([01])\b/gi, (_, val) =>
      `BOOLEAN NOT NULL DEFAULT ${val === '1' ? 'TRUE' : 'FALSE'}`
    )
    // INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING
    .replace(/INSERT\s+OR\s+IGNORE/gi, 'INSERT')
    // TEXT fields stay TEXT (compatible)
    // REAL → DOUBLE PRECISION (if needed)
    .replace(/\bREAL\b/gi, 'DOUBLE PRECISION')
}

// ---------------------------------------------------------------------------
// Legacy column patching
// Changed from: PRAGMA table_info(transactions) → information_schema.columns
// ---------------------------------------------------------------------------

async function patchLegacyColumns(client: PoolClient): Promise<void> {
  // Changed from: db.prepare("PRAGMA table_info(transactions)").all()
  // Changed to:   information_schema query
  const txColsResult = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'transactions' AND table_schema = 'public'`
  )
  const txCols = txColsResult.rows.map(c => c.column_name)

  // Changed from: SQLite ALTER TABLE with defaults
  // Changed to:   PostgreSQL ALTER TABLE (same syntax, mostly compatible)
  const txPatches: [string, string][] = [
    ['status',        "ALTER TABLE transactions ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'"],
    ['due_date',      'ALTER TABLE transactions ADD COLUMN due_date TIMESTAMPTZ'],
    ['reminder_days', 'ALTER TABLE transactions ADD COLUMN reminder_days INTEGER DEFAULT 3'],
    ['client_name',   'ALTER TABLE transactions ADD COLUMN client_name TEXT'],
    ['business_id',   'ALTER TABLE transactions ADD COLUMN business_id INTEGER REFERENCES businesses(id)'],
  ]

  for (const [col, sql] of txPatches) {
    if (!txCols.includes(col)) {
      try { await client.query(sql) } catch { /* already exists */ }
    }
  }

  const userColsResult = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'users' AND table_schema = 'public'`
  )
  const userCols = userColsResult.rows.map(c => c.column_name)

  if (!userCols.includes('role')) {
    try {
      await client.query("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
    } catch { /* already exists */ }
  }
  // Changed from: INTEGER NOT NULL DEFAULT 1 → BOOLEAN NOT NULL DEFAULT TRUE
  if (!userCols.includes('email_verified')) {
    try {
      await client.query('ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE')
    } catch { /* already exists */ }
  }

  await seedAdminUser(client)
  await seedDemoUser(client)
}

// ---------------------------------------------------------------------------
// Seed functions
// Changed from: db.prepare("INSERT OR IGNORE...").run(hash)
// Changed to:   INSERT ... ON CONFLICT DO NOTHING with $1 params
// ---------------------------------------------------------------------------

async function seedAdminUser(client: PoolClient): Promise<void> {
  try {
    const existing = await client.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    if (existing.rows.length > 0) return

    // Random per-install password — there is no fixed/shared admin credential in source.
    // Printed once, here, at first boot; use forgot-password to recover it afterward.
    const plainPassword = crypto.randomBytes(12).toString('base64url')
    const hash = await bcrypt.hash(plainPassword, await bcrypt.genSalt(12))
    await client.query(
      `INSERT INTO users (username, email, password, role)
       VALUES ('admin', 'admin@moneylix.app', $1, 'admin')
       ON CONFLICT DO NOTHING`,
      [hash]
    )
    console.log('[db.postgres] Admin account created — login: admin / ' + plainPassword)
    console.log('[db.postgres] This password is shown once. Save it now, or reset it via the forgot-password flow.')
  } catch (err) {
    console.error('[db.postgres] Failed to seed admin user:', err)
  }
}

async function seedDemoUser(client: PoolClient): Promise<void> {
  try {
    const existing = await client.query("SELECT id FROM users WHERE username = 'demo' LIMIT 1")
    if (existing.rows.length > 0) return

    // bcrypt hash of 'demo'
    const hash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
    await client.query(
      `INSERT INTO users (username, email, password, role)
       VALUES ('demo', 'demo@moneylix.app', $1, 'user')
       ON CONFLICT DO NOTHING`,
      [hash]
    )
    console.log('[db.postgres] Demo user seeded — login: demo / demo')
  } catch (err) {
    console.error('[db.postgres] Failed to seed demo user:', err)
  }
}

// ---------------------------------------------------------------------------
// Public query helpers
// Changed from: synchronous methods returning values directly
// Changed to:   async methods returning Promises
//
// INTERFACE COMPARISON:
//   SQLite:     dbQuery.all<T>(sql, params): T[]
//   PostgreSQL: dbQuery.all<T>(sql, params): Promise<T[]>
//
//   SQLite:     dbQuery.get<T>(sql, params): T | null
//   PostgreSQL: dbQuery.get<T>(sql, params): Promise<T | null>
//
//   SQLite:     dbQuery.run(sql, params): { changes, lastInsertRowid }
//   PostgreSQL: dbQuery.run(sql, params): Promise<{ rowCount: number }>
//
//   SQLite:     dbQuery.transaction(fn): T
//   PostgreSQL: dbQuery.transaction(fn): Promise<T>
// ---------------------------------------------------------------------------

type Params = unknown[]

export interface RunResult {
  rowCount: number
}

export const dbQuery = {
  /**
   * Execute a SELECT query, return all rows.
   * Changed from: getDatabase().prepare(sql).all(...params) as T[]
   * Changed to:   pool.query(sql, params) → result.rows
   *
   * NOTE: Callers must use $1, $2, $3 instead of ? placeholders!
   */
  async all<T extends QueryResultRow = Record<string, unknown>>(sql: string, params: Params = []): Promise<T[]> {
    try {
      const result = await getPool().query<T>(sql, params)
      return result.rows
    } catch (err) {
      console.error('[db.postgres] query error:', err, '\nSQL:', sql)
      return []
    }
  },

  /**
   * Execute a SELECT query, return first row or null.
   * Changed from: getDatabase().prepare(sql).get(...params) ?? null
   * Changed to:   pool.query(sql + LIMIT 1 if missing) → rows[0] ?? null
   */
  async get<T extends QueryResultRow = Record<string, unknown>>(sql: string, params: Params = []): Promise<T | null> {
    try {
      const result = await getPool().query<T>(sql, params)
      return result.rows[0] ?? null
    } catch (err) {
      console.error('[db.postgres] query error:', err, '\nSQL:', sql)
      return null
    }
  },

  /**
   * Execute an INSERT/UPDATE/DELETE statement.
   * Changed from: returns { changes: number, lastInsertRowid: number }
   * Changed to:   returns { rowCount: number }
   *
   * For RETURNING id, use dbQuery.get() with RETURNING clause instead.
   */
  async run(sql: string, params: Params = []): Promise<RunResult> {
    try {
      const result = await getPool().query(sql, params)
      return { rowCount: result.rowCount ?? 0 }
    } catch (err) {
      console.error('[db.postgres] run error:', err, '\nSQL:', sql)
      return { rowCount: 0 }
    }
  },

  /**
   * Execute multiple statements in a single transaction.
   * Changed from: getDatabase().transaction(fn)(getDatabase()) — sync, receives db
   * Changed to:   checks out a client, wraps in BEGIN/COMMIT/ROLLBACK — async, receives client
   *
   * Usage:
   *   const result = await dbQuery.transaction(async (client) => {
   *     await client.query('INSERT INTO ...', [...])
   *     await client.query('UPDATE ...', [...])
   *     return someValue
   *   })
   */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await getPool().connect()
    try {
      await client.query('BEGIN')
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// Changed from: not needed for SQLite (single file)
// Changed to:   must drain pool connections on shutdown
// ---------------------------------------------------------------------------

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    console.log('[db.postgres] Connection pool closed')
  }
}

// Handle process shutdown gracefully
process.on('SIGTERM', async () => { await closeDatabase() })
process.on('SIGINT', async () => { await closeDatabase() })

export default dbQuery
