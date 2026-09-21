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
      // Managed Postgres providers (Supabase's pooler here) commonly present
      // a certificate chain that doesn't validate against Node's default CA
      // bundle - a well-known, standard tradeoff for connecting to these
      // services (the connection is still encrypted via TLS; this only
      // skips validating the cert chain against a known root). Every query
      // was silently failing with SELF_SIGNED_CERT_IN_CHAIN in production
      // without this - caught by this file's own try/catch blocks, which
      // masked it as a fake empty/zero success instead of a real error.
      ssl: { rejectUnauthorized: false },
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
 * Explicit conflict targets for every `INSERT OR IGNORE` in the migration
 * files, keyed by table name. `null` means the table has no unique
 * constraint on the columns being inserted (e.g. `categories.name` isn't
 * unique) — SQLite's OR IGNORE was a no-op there too in that case, since
 * migrations only ever run once (tracked in schema_migrations), so a plain
 * INSERT preserves identical behavior. A blind "ON CONFLICT (name)" would
 * be WRONG here — Postgres errors if the target isn't a real unique/PK
 * constraint, and adding one would just be guessing.
 */
const INSERT_IGNORE_CONFLICT_TARGETS: Record<string, string | null> = {
  businesses: 'id',
  currencies: 'code',
  settings: 'key',
  categories: null,
  user_settings: 'user_id, key',
  app_settings: 'key',
}

/**
 * Rewrite every `INSERT OR IGNORE INTO <table> ...;` statement to either
 * `... ON CONFLICT (<real target>) DO NOTHING;` or a plain INSERT, per the
 * table-specific map above. Handles both VALUES(...) and INSERT...SELECT
 * forms (e.g. 009_user_settings.sql) since it matches up to the statement's
 * terminating semicolon rather than assuming a VALUES clause.
 */
function convertInsertOrIgnore(sql: string): string {
  return sql.replace(
    /INSERT\s+OR\s+IGNORE\s+INTO\s+(\w+)([\s\S]*?);/gi,
    (full: string, table: string, rest: string) => {
      const target = INSERT_IGNORE_CONFLICT_TARGETS[table.toLowerCase()]
      const conflictClause = target ? ` ON CONFLICT (${target}) DO NOTHING` : ''
      return `INSERT INTO ${table}${rest}${conflictClause};`
    }
  )
}

/**
 * Convert common SQLite SQL syntax to PostgreSQL.
 * Used when applying .sql migration files that were written for SQLite.
 *
 * NOTE: deliberately does NOT convert `INTEGER ... DEFAULT 0/1` columns to
 * BOOLEAN. That pattern is shared by genuine boolean flags (is_read,
 * gst_registered) AND real counters (recipient_count, total_generated,
 * matched_count) across the migrations — a regex can't tell them apart, and
 * converting a counter to BOOLEAN breaks every SUM()/increment against it.
 * Postgres has no issue with 0/1 INTEGER flags, so we just keep them as-is
 * — this is a deliberate decision, not an oversight.
 *
 * DOES convert TEXT timestamp columns to TIMESTAMPTZ (unlike the boolean
 * case, this pattern is unambiguous — a column declared
 * `TEXT DEFAULT (datetime('now'))`, or literally named `expires_at`, is
 * always a timestamp, never something else). This matters because
 * toPgQuery() turns `datetime('now')` into `NOW()`, which returns a real
 * TIMESTAMPTZ — assigning or comparing that against a TEXT column fails
 * with "operator does not exist: text > timestamp with time zone" at
 * runtime. Must run before the plain datetime('now') → NOW() replace below,
 * or this DEFAULT-clause-specific pattern would no longer match.
 */
function convertSqliteToPostgres(sql: string): string {
  let out = sql
    // AUTOINCREMENT → use SERIAL (applied to CREATE TABLE)
    .replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
    // TEXT ... DEFAULT (datetime('now')) → TIMESTAMPTZ ... DEFAULT NOW()
    .replace(/TEXT(\s+NOT\s+NULL)?\s+DEFAULT\s*\(datetime\('now'\)\)/gi,
      (_m, notNull: string | undefined) => `TIMESTAMPTZ${notNull ?? ''} DEFAULT NOW()`)
    // expires_at TEXT [NOT NULL] → expires_at TIMESTAMPTZ [NOT NULL]
    .replace(/\bexpires_at\s+TEXT(\s+NOT\s+NULL)?/gi,
      (_m, notNull: string | undefined) => `expires_at TIMESTAMPTZ${notNull ?? ''}`)
    // datetime('now') → NOW()
    .replace(/datetime\('now'\)/gi, 'NOW()')
    // REAL → DOUBLE PRECISION
    .replace(/\bREAL\b/gi, 'DOUBLE PRECISION')

  out = convertInsertOrIgnore(out)
  return out
}

/**
 * Convert a SQLite-style query (using `?` placeholders) to Postgres style
 * (`$1, $2, ...`), and swap SQLite-only date/time functions for their
 * Postgres equivalents. Applied to every runtime query so the ~105 route
 * files that call dbQuery.get/all/run with `?` and datetime('now')/
 * strftime()/date() need zero changes.
 *
 * Scans left-to-right, tracking whether we're inside a single-quoted string
 * literal (handling SQLite's '' escaped-quote convention) so a literal `?`
 * inside quoted text is never mistaken for a placeholder — none of the
 * sampled queries in this codebase do that, but it costs nothing to guard.
 *
 * Date/time conversions, applied in this order (each must run before the
 * more generic rule below it, or it would swallow the specific case first):
 *   datetime('now')                 → NOW()
 *   strftime('%Y-%m', 'now')        → TO_CHAR(NOW(), 'YYYY-MM')
 *   strftime('%Y-%m', <col>)        → TO_CHAR(<col>, 'YYYY-MM')
 *   date('now', '+N unit')          → CURRENT_DATE + INTERVAL 'N unit'
 *   date('now', '-N unit')          → CURRENT_DATE - INTERVAL 'N unit'
 *   date('now')                     → CURRENT_DATE
 *   date(<col>)                     → (<col>)::date
 */
export function toPgQuery(sql: string): string {
  let out = ''
  let paramIndex = 0
  let inString = false

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]

    if (ch === "'") {
      // '' inside a string is an escaped quote, not the string's end
      if (inString && sql[i + 1] === "'") {
        out += "''"
        i++
        continue
      }
      inString = !inString
      out += ch
      continue
    }

    if (ch === '?' && !inString) {
      paramIndex++
      out += `$${paramIndex}`
      continue
    }

    out += ch
  }

  return out
    .replace(/datetime\('now'\)/gi, 'NOW()')
    .replace(/strftime\('%Y-%m',\s*'now'\)/gi, "TO_CHAR(NOW(), 'YYYY-MM')")
    .replace(/strftime\('%Y-%m',\s*([^,)]+)\)/gi, "TO_CHAR($1, 'YYYY-MM')")
    .replace(/date\('now',\s*'([+-])(\d+)\s+(day|days|month|months|year|years)'\)/gi,
      (_m, sign: string, num: string, unit: string) => `CURRENT_DATE ${sign} INTERVAL '${num} ${unit}'`)
    .replace(/date\('now'\)/gi, 'CURRENT_DATE')
    .replace(/date\(([^()]+)\)/gi, '($1)::date')
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
  // Added for the admin suspend/unsuspend feature — kept as INTEGER (not
  // BOOLEAN) per the deliberate flag-column decision above.
  if (!userCols.includes('suspended')) {
    try {
      await client.query('ALTER TABLE users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0')
    } catch { /* already exists */ }
  }
  if (!userCols.includes('suspended_at')) {
    try {
      await client.query('ALTER TABLE users ADD COLUMN suspended_at TIMESTAMPTZ')
    } catch { /* already exists */ }
  }

  await seedAdminUser(client)
  await seedDemoUser(client)
  await ensureDemoPremium(client)
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

/**
 * Gives the demo account an active premium subscription, so demo logins
 * show the full feature set rather than the free tier. Mirrors db.ts's
 * ensureDemoPremium — without this, a fresh Postgres install's demo user
 * would silently be stuck on free (seedDemoUser only creates the user row,
 * not a subscription).
 */
async function ensureDemoPremium(client: PoolClient): Promise<void> {
  try {
    const demoUser = await client.query<{ id: number }>("SELECT id FROM users WHERE username = 'demo'")
    if (demoUser.rows.length === 0) return
    const demoId = demoUser.rows[0].id

    const existingSub = await client.query(
      "SELECT id FROM subscriptions WHERE user_id = $1 AND plan = 'premium' AND status = 'active'",
      [demoId]
    )
    if (existingSub.rows.length > 0) return

    await client.query(
      "UPDATE subscriptions SET status = 'cancelled' WHERE user_id = $1 AND status = 'active'",
      [demoId]
    )
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    await client.query(
      `INSERT INTO subscriptions (user_id, plan, status, started_at, expires_at, amount_paid, payment_method, notes)
       VALUES ($1, 'premium', 'active', NOW(), $2, 0, 'demo', 'Auto-created premium for demo account')`,
      [demoId, expiresAt]
    )
    console.log('[db.postgres] Demo user upgraded to premium plan')
  } catch (err) {
    console.error('[db.postgres] Failed to ensure demo premium:', err)
  }
}

// ---------------------------------------------------------------------------
// Public query helpers
// Changed from: synchronous methods returning values directly
// Changed to:   async methods returning Promises
//
// All of get/all/run/insert accept the same SQLite-style `?` placeholders
// and `datetime('now')` the app already writes — toPgQuery() converts them
// automatically, so existing call sites don't need editing. run()'s return
// shape includes both `rowCount` (Postgres-native) and `changes`/
// `lastInsertRowid` (SQLite-compatibility aliases). transaction()'s
// callback is async and receives a pg PoolClient rather than a sync db
// handle — the ~12 call sites using sync `db.prepare().run()` chains inside
// a transaction still need hand-rewriting to `await client.query(...)`.
// ---------------------------------------------------------------------------

type Params = unknown[]

export interface RunResult {
  rowCount: number
  /** Compatibility alias for rowCount, matching better-sqlite3's RunResult shape. */
  changes: number
  /**
   * Only populated when the query already has (or run() adds) a RETURNING
   * clause — Postgres has no automatic last-inserted-id like SQLite's
   * ROWID. Prefer dbQuery.insert() for the common single-row-insert case.
   */
  lastInsertRowid?: number
}

export const dbQuery = {
  /**
   * Execute a SELECT query, return all rows.
   * Accepts SQLite-style `?` placeholders — converted to $1,$2,... automatically.
   */
  async all<T extends QueryResultRow = Record<string, unknown>>(sql: string, params: Params = []): Promise<T[]> {
    try {
      const result = await getPool().query<T>(toPgQuery(sql), params)
      return result.rows
    } catch (err) {
      console.error('[db.postgres] query error:', err, '\nSQL:', sql)
      return []
    }
  },

  /**
   * Execute a SELECT query, return first row or null.
   * Accepts SQLite-style `?` placeholders — converted to $1,$2,... automatically.
   */
  async get<T extends QueryResultRow = Record<string, unknown>>(sql: string, params: Params = []): Promise<T | null> {
    try {
      const result = await getPool().query<T>(toPgQuery(sql), params)
      return result.rows[0] ?? null
    } catch (err) {
      console.error('[db.postgres] query error:', err, '\nSQL:', sql)
      return null
    }
  },

  /**
   * Execute an INSERT/UPDATE/DELETE statement.
   * Accepts SQLite-style `?` placeholders — converted to $1,$2,... automatically.
   *
   * If the query text already contains a RETURNING clause, its first
   * column is also surfaced as `lastInsertRowid` for drop-in compatibility
   * with call sites written against the SQLite shape.
   */
  async run(sql: string, params: Params = []): Promise<RunResult> {
    try {
      const result = await getPool().query(toPgQuery(sql), params)
      const rowCount = result.rowCount ?? 0
      const firstReturned = result.rows?.[0]
      const lastInsertRowid = firstReturned ? Object.values(firstReturned)[0] as number : undefined
      return { rowCount, changes: rowCount, lastInsertRowid }
    } catch (err) {
      console.error('[db.postgres] run error:', err, '\nSQL:', sql)
      return { rowCount: 0, changes: 0 }
    }
  },

  /**
   * Convenience for the common "INSERT a row, get its new id back" pattern
   * that SQLite's `.run().lastInsertRowid` handled implicitly. Appends
   * `RETURNING id` if the query doesn't already have a RETURNING clause.
   *
   * Usage: const { lastInsertRowid } = await dbQuery.insert(
   *   'INSERT INTO categories (name, icon) VALUES (?, ?)', [name, icon]
   * )
   */
  async insert(sql: string, params: Params = []): Promise<RunResult> {
    const withReturning = /\bRETURNING\b/i.test(sql) ? sql : `${sql.replace(/;\s*$/, '')} RETURNING id`
    return dbQuery.run(withReturning, params)
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
