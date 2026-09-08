import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

let dbInstance: Database.Database | null = null

function getDatabase(): Database.Database {
  if (!dbInstance) {
    // Support both old (moneyflow.db) and new (moneylix.db) filenames
    // Use moneyflow.db if it exists and moneylix.db doesn't (migration safety)
    const newPath = path.join(process.cwd(), 'moneylix.db')
    const oldPath = path.join(process.cwd(), 'moneyflow.db')
    const dbPath = (!fs.existsSync(newPath) && fs.existsSync(oldPath)) ? oldPath : newPath
    dbInstance = new Database(dbPath)
    dbInstance.pragma('journal_mode = WAL')
    dbInstance.pragma('foreign_keys = ON')
    runMigrations(dbInstance)
  }
  return dbInstance
}

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const migrationsDir = path.join(process.cwd(), 'src', 'migrations')
  if (!fs.existsSync(migrationsDir)) return

  const files = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  const applied = new Set<number>(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(r => r.version)
  )

  for (const file of files) {
    const match = file.match(/^(\d+)_/)
    if (!match) continue
    const version = parseInt(match[1], 10)
    if (applied.has(version)) continue

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(version, file)
    })()
    console.log(`[db] Applied migration ${file}`)
  }

  // Runtime column-patch for databases created before migrations were tracked
  patchLegacyColumns(db)
}

function patchLegacyColumns(db: Database.Database): void {
  const txCols = (db.prepare("PRAGMA table_info(transactions)").all() as { name: string }[]).map(c => c.name)
  const txPatches: [string, string][] = [
    ['status',      "ALTER TABLE transactions ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'"],
    ['due_date',    'ALTER TABLE transactions ADD COLUMN due_date TEXT'],
    ['reminder_days','ALTER TABLE transactions ADD COLUMN reminder_days INTEGER DEFAULT 3'],
    ['client_name', 'ALTER TABLE transactions ADD COLUMN client_name TEXT'],
    ['business_id', 'ALTER TABLE transactions ADD COLUMN business_id INTEGER REFERENCES businesses(id)'],
  ]
  for (const [col, sql] of txPatches) {
    if (!txCols.includes(col)) { try { db.exec(sql) } catch { /* already exists */ } }
  }

  const userCols = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map(c => c.name)
  if (!userCols.includes('role')) {
    try { db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'") } catch { /* already exists */ }
  }
  // DEFAULT 1 so existing accounts aren't locked out immediately
  if (!userCols.includes('email_verified')) {
    try { db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1') } catch { /* already exists */ }
  }
  if (!userCols.includes('suspended')) {
    try { db.exec('ALTER TABLE users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0') } catch { /* already exists */ }
  }
  if (!userCols.includes('suspended_at')) {
    try { db.exec('ALTER TABLE users ADD COLUMN suspended_at TEXT') } catch { /* already exists */ }
  }

  seedAdminUser(db)
  seedDemoUser(db)
  ensureDemoPremium(db)
  ensureDevAdminPassword(db)
}

function seedAdminUser(db: Database.Database): void {
  try {
    const existing = db.prepare("SELECT id FROM users WHERE role = 'admin'").get()
    if (existing) return
    // Random per-install password — there is no fixed/shared admin credential in source.
    // Printed once, here, at first boot; use forgot-password to recover it afterward.
    const plainPassword = crypto.randomBytes(12).toString('base64url')
    const hash = bcrypt.hashSync(plainPassword, bcrypt.genSaltSync(12))
    db.prepare(
      "INSERT OR IGNORE INTO users (username, email, password, role) VALUES ('admin', 'admin@moneylix.app', ?, 'admin')"
    ).run(hash)
    console.log('[db] Admin account created — login: admin / ' + plainPassword)
    console.log('[db] This password is shown once. Save it now, or reset it via the forgot-password flow.')
  } catch (err) {
    console.error('[db] Failed to seed admin user:', err)
  }
}

/**
 * Dev-only: force the admin password to a known value on boot so you can always
 * log in locally. Does NOTHING in production (NODE_ENV === 'production').
 * Default dev credentials: admin / admin123
 */
function ensureDevAdminPassword(db: Database.Database): void {
  if (process.env.NODE_ENV === 'production') return
  try {
    const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as { id: number } | undefined
    if (!admin) return
    const devPassword = 'admin123'
    const hash = bcrypt.hashSync(devPassword, bcrypt.genSaltSync(12))
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, admin.id)
    console.log('[db] DEV MODE — admin password reset to: admin / ' + devPassword)
    console.log('[db] (This only happens in development. Production keeps the secure random password.)')
  } catch (err) {
    console.error('[db] Failed to set dev admin password:', err)
  }
}

function seedDemoUser(db: Database.Database): void {
  try {
    const existing = db.prepare("SELECT id FROM users WHERE username = 'demo'").get()
    if (existing) return
    const password = Buffer.from('demo').toString('base64')
    db.prepare(
      "INSERT OR IGNORE INTO users (username, email, password, role) VALUES ('demo', 'demo@moneylix.app', ?, 'user')"
    ).run(password)

    // Get the demo user id and create a premium subscription so demo has full access
    const demoUser = db.prepare("SELECT id FROM users WHERE username = 'demo'").get() as { id: number } | undefined
    if (demoUser) {
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      db.prepare(
        "INSERT OR IGNORE INTO subscriptions (user_id, plan, status, started_at, expires_at, amount_paid, payment_method, notes) VALUES (?, 'premium', 'active', datetime('now'), ?, 0, 'demo', 'Auto-created premium for demo account')"
      ).run(demoUser.id, expiresAt)
    }

    console.log('[db] Demo user seeded with premium plan — login: demo / demo')
  } catch (err) {
    console.error('[db] Failed to seed demo user:', err)
  }
}

function ensureDemoPremium(db: Database.Database): void {
  try {
    const demoUser = db.prepare("SELECT id FROM users WHERE username = 'demo'").get() as { id: number } | undefined
    if (!demoUser) return

    // Check if demo already has an active premium subscription
    const existingSub = db.prepare(
      "SELECT id FROM subscriptions WHERE user_id = ? AND plan = 'premium' AND status = 'active'"
    ).get(demoUser.id)
    if (existingSub) return

    // Upsert: cancel any existing subs, then insert premium
    db.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'").run(demoUser.id)
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    db.prepare(
      "INSERT INTO subscriptions (user_id, plan, status, started_at, expires_at, amount_paid, payment_method, notes) VALUES (?, 'premium', 'active', datetime('now'), ?, 0, 'demo', 'Auto-created premium for demo account')"
    ).run(demoUser.id, expiresAt)
    console.log('[db] Demo user upgraded to premium plan')
  } catch (err) {
    console.error('[db] Failed to ensure demo premium:', err)
  }
}

// ---------------------------------------------------------------------------
// Public query helpers
// ---------------------------------------------------------------------------

type Params = unknown[]

export const dbQuery = {
  all<T = Record<string, unknown>>(sql: string, params: Params = []): T[] {
    try {
      return getDatabase().prepare(sql).all(...params) as T[]
    } catch (err) {
      console.error('[db] query error:', err, '\nSQL:', sql)
      return []
    }
  },

  get<T = Record<string, unknown>>(sql: string, params: Params = []): T | null {
    try {
      return (getDatabase().prepare(sql).get(...params) ?? null) as T | null
    } catch (err) {
      console.error('[db] query error:', err, '\nSQL:', sql)
      return null
    }
  },

  run(sql: string, params: Params = []): Database.RunResult {
    try {
      return getDatabase().prepare(sql).run(...params)
    } catch (err) {
      console.error('[db] run error:', err, '\nSQL:', sql)
      return { changes: 0, lastInsertRowid: 0 }
    }
  },

  /** Wrap multiple writes in a single SQLite transaction. */
  transaction<T>(fn: (db: Database.Database) => T): T {
    return getDatabase().transaction(fn)(getDatabase())
  },
}

export default dbQuery
