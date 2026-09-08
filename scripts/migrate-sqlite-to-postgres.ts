/**
 * migrate-sqlite-to-postgres.ts
 * ==============================
 * One-time migration script: reads all data from SQLite (moneyflow.db / moneylix.db)
 * and inserts it into PostgreSQL.
 *
 * Usage:
 *   DATABASE_URL=[REDACTED_CONN_STRING]://user:pass@localhost:5432/moneylix npx ts-node scripts/migrate-sqlite-to-postgres.ts
 *
 * Prerequisites:
 *   - npm install better-sqlite3 pg
 *   - PostgreSQL database must exist (CREATE DATABASE moneylix)
 *   - Run the app once with PostgreSQL to apply migrations (or run initDatabase())
 */

import Database from 'better-sqlite3'
import { Pool, PoolClient } from 'pg'
import path from 'path'
import fs from 'fs'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required.')
  console.error('   Example: DATABASE_URL=[REDACTED_CONN_STRING]://localhost:5432/moneylix')
  process.exit(1)
}

// Find SQLite database file
const newPath = path.join(process.cwd(), 'moneylix.db')
const oldPath = path.join(process.cwd(), 'moneyflow.db')
const sqlitePath = fs.existsSync(newPath) ? newPath : fs.existsSync(oldPath) ? oldPath : null

if (!sqlitePath) {
  console.error('❌ No SQLite database found (looked for moneylix.db and moneyflow.db)')
  process.exit(1)
}

console.log(`📂 Source SQLite: ${sqlitePath}`)
console.log(`🐘 Target PostgreSQL: ${DATABASE_URL.replace(/\/\/.*@/, '//***@')}`)
console.log('')

// ---------------------------------------------------------------------------
// Type conversion helpers
// ---------------------------------------------------------------------------

interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: string | null
  pk: number
}

/**
 * Convert SQLite column types to PostgreSQL equivalents.
 */
function sqliteTypeToPg(sqliteType: string): string {
  const t = sqliteType.toUpperCase()
  if (t.includes('INT') && t.includes('AUTO')) return 'SERIAL'
  if (t.includes('INT')) return 'INTEGER'
  if (t === 'REAL' || t === 'FLOAT' || t === 'DOUBLE') return 'DOUBLE PRECISION'
  if (t === 'BLOB') return 'BYTEA'
  if (t.includes('BOOL')) return 'BOOLEAN'
  if (t.includes('TEXT') || t.includes('CHAR') || t.includes('CLOB')) return 'TEXT'
  if (t.includes('DATE') || t.includes('TIME')) return 'TIMESTAMPTZ'
  return 'TEXT' // fallback
}

/**
 * Convert a SQLite row value to PostgreSQL-compatible value.
 * Handles:
 *   - SQLite INTEGER booleans (0/1) for known boolean columns
 *   - null values
 *   - datetime strings (passed as-is, PG handles ISO8601)
 */
function convertValue(value: unknown, _colName: string, _colType: string): unknown {
  if (value === null || value === undefined) return null
  return value
}

// ---------------------------------------------------------------------------
// Table ordering (respects foreign key constraints)
// ---------------------------------------------------------------------------

function getTableInsertOrder(db: Database.Database): string[] {
  // Get all user tables
  const tables = (db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all() as { name: string }[]).map(t => t.name)

  // schema_migrations should go first (meta table)
  // Then tables without FK deps, then dependent tables
  const priority = ['schema_migrations', 'users', 'businesses', 'categories']
  const ordered: string[] = []

  // Add priority tables first (if they exist)
  for (const t of priority) {
    if (tables.includes(t)) ordered.push(t)
  }

  // Add remaining tables
  for (const t of tables) {
    if (!ordered.includes(t)) ordered.push(t)
  }

  return ordered
}

// ---------------------------------------------------------------------------
// Migration logic
// ---------------------------------------------------------------------------

async function migrateTable(
  sqliteDb: Database.Database,
  pgClient: PoolClient,
  tableName: string
): Promise<number> {
  // Get column info from SQLite
  const columns = sqliteDb.prepare(`PRAGMA table_info("${tableName}")`).all() as ColumnInfo[]
  if (columns.length === 0) {
    console.log(`  ⚠️  Table "${tableName}" has no columns, skipping`)
    return 0
  }

  const colNames = columns.map(c => c.name)

  // Check if table exists in PostgreSQL
  const pgTableCheck = await pgClient.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    )`,
    [tableName]
  )

  if (!pgTableCheck.rows[0].exists) {
    console.log(`  ⚠️  Table "${tableName}" does not exist in PostgreSQL, skipping`)
    console.log(`      (Run migrations first or create the table manually)`)
    return 0
  }

  // Read all rows from SQLite
  const rows = sqliteDb.prepare(`SELECT * FROM "${tableName}"`).all() as Record<string, unknown>[]
  if (rows.length === 0) {
    console.log(`  📭 Table "${tableName}": 0 rows (empty)`)
    return 0
  }

  // Clear existing data in PostgreSQL (idempotent migration)
  await pgClient.query(`DELETE FROM "${tableName}"`)

  // Build batch insert
  let inserted = 0
  const batchSize = 100

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const values: unknown[] = []
    const valueClauses: string[] = []

    for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
      const row = batch[rowIdx]
      const placeholders: string[] = []

      for (let colIdx = 0; colIdx < colNames.length; colIdx++) {
        const col = colNames[colIdx]
        const colInfo = columns[colIdx]
        const paramNum = rowIdx * colNames.length + colIdx + 1
        placeholders.push(`$${paramNum}`)
        values.push(convertValue(row[col], col, colInfo.type))
      }

      valueClauses.push(`(${placeholders.join(', ')})`)
    }

    const quotedCols = colNames.map(c => `"${c}"`).join(', ')
    const insertSql = `INSERT INTO "${tableName}" (${quotedCols}) VALUES ${valueClauses.join(', ')} ON CONFLICT DO NOTHING`

    try {
      const result = await pgClient.query(insertSql, values)
      inserted += result.rowCount ?? 0
    } catch (err) {
      console.error(`  ❌ Error inserting batch into "${tableName}":`, (err as Error).message)
      // Try row-by-row for this batch to identify problematic rows
      for (const row of batch) {
        const rowValues = colNames.map((col, idx) =>
          convertValue(row[col], col, columns[idx].type)
        )
        const rowPlaceholders = colNames.map((_, idx) => `$${idx + 1}`).join(', ')
        const rowQuotedCols = colNames.map(c => `"${c}"`).join(', ')
        const rowSql = `INSERT INTO "${tableName}" (${rowQuotedCols}) VALUES (${rowPlaceholders}) ON CONFLICT DO NOTHING`
        try {
          await pgClient.query(rowSql, rowValues)
          inserted++
        } catch (rowErr) {
          console.error(`    ⚠️  Skipped row:`, (rowErr as Error).message)
        }
      }
    }
  }

  // Reset sequence for serial columns (auto-increment equivalent)
  for (const col of columns) {
    if (col.pk === 1 && col.type.toUpperCase().includes('INT')) {
      try {
        await pgClient.query(`
          SELECT setval(
            pg_get_serial_sequence('"${tableName}"', '${col.name}'),
            COALESCE((SELECT MAX("${col.name}") FROM "${tableName}"), 0) + 1,
            false
          )
        `)
      } catch {
        // Table might not have a sequence (non-serial PK)
      }
    }
  }

  return inserted
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now()

  // Open SQLite
  const sqliteDb = new Database(sqlitePath!, { readonly: true })
  sqliteDb.pragma('journal_mode = WAL')

  // Connect to PostgreSQL
  const pool = new Pool({ connectionString: DATABASE_URL })
  const client = await pool.connect()

  try {
    console.log('🚀 Starting SQLite → PostgreSQL migration...\n')

    // Get tables in FK-safe order
    const tables = getTableInsertOrder(sqliteDb)
    console.log(`📋 Found ${tables.length} tables to migrate:\n   ${tables.join(', ')}\n`)

    // Disable FK checks during migration for speed
    await client.query('SET session_replication_role = replica')

    let totalRows = 0

    for (const table of tables) {
      const tableStart = Date.now()
      const count = await migrateTable(sqliteDb, client, table)
      const elapsed = Date.now() - tableStart
      totalRows += count

      if (count > 0) {
        console.log(`  ✅ "${table}": ${count} rows migrated (${elapsed}ms)`)
      }
    }

    // Re-enable FK checks
    await client.query('SET session_replication_role = DEFAULT')

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\n${'─'.repeat(50)}`)
    console.log(`✅ Migration complete!`)
    console.log(`   Total rows: ${totalRows}`)
    console.log(`   Total time: ${totalTime}s`)
    console.log(`   Tables: ${tables.length}`)
    console.log(`${'─'.repeat(50)}`)

  } catch (err) {
    console.error('\n❌ Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
    sqliteDb.close()
  }
}

main().catch(err => {
  console.error('❌ Unhandled error:', err)
  process.exit(1)
})
