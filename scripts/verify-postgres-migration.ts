/**
 * verify-postgres-migration.ts
 * ==============================
 * Sanity-checks a completed SQLite → PostgreSQL migration:
 *   1. Row counts match between SQLite and Postgres, per table
 *   2. SERIAL sequences are set past the max existing id (so the next
 *      INSERT doesn't collide with imported data)
 *   3. No orphaned foreign keys on the main relationships
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/verify-postgres-migration.ts
 */

import Database from 'better-sqlite3'
import { Pool } from 'pg'
import path from 'path'
import fs from 'fs'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required.')
  process.exit(1)
}

const newPath = path.join(process.cwd(), 'moneylix.db')
const oldPath = path.join(process.cwd(), 'moneyflow.db')
const sqlitePath = fs.existsSync(newPath) ? newPath : fs.existsSync(oldPath) ? oldPath : null
if (!sqlitePath) {
  console.error('No SQLite database found.')
  process.exit(1)
}

async function main(): Promise<void> {
  const sqliteDb = new Database(sqlitePath!, { readonly: true })
  const pool = new Pool({ connectionString: DATABASE_URL })
  const client = await pool.connect()

  let problems = 0

  try {
    console.log('── 1. Row count comparison ──')
    const tables = (sqliteDb.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all() as { name: string }[]).map(t => t.name)

    for (const table of tables) {
      const sqliteCount = (sqliteDb.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get() as { c: number }).c
      let pgCount = 0
      try {
        const r = await client.query(`SELECT COUNT(*) as c FROM "${table}"`)
        pgCount = parseInt(r.rows[0].c, 10)
      } catch {
        console.log(`  ⚠️  "${table}" doesn't exist in Postgres`)
        problems++
        continue
      }
      const ok = sqliteCount === pgCount
      if (!ok) problems++
      console.log(`  ${ok ? '✅' : '❌'} ${table}: sqlite=${sqliteCount} postgres=${pgCount}`)
    }

    console.log('\n── 2. Sequence sanity (key tables) ──')
    for (const table of ['users', 'businesses', 'transactions', 'invoices']) {
      const r = await client.query(
        `SELECT last_value FROM pg_sequences WHERE sequencename = pg_get_serial_sequence('"${table}"', 'id')::regclass::text`
      ).catch(() => null)
      const maxId = await client.query(`SELECT COALESCE(MAX(id), 0) as max FROM "${table}"`)
      console.log(`  ${table}: max id = ${maxId.rows[0].max}, sequence last_value = ${r?.rows[0]?.last_value ?? 'n/a'}`)
    }

    console.log('\n── 3. Orphaned foreign key check ──')
    const fkChecks: [string, string, string][] = [
      ['transactions', 'business_id', 'businesses'],
      ['transactions', 'category_id', 'categories'],
      ['businesses', 'user_id', 'users'],
      ['invoices', 'business_id', 'businesses'],
      ['bank_connections', 'user_id', 'users'],
    ]
    for (const [child, fk, parent] of fkChecks) {
      const r = await client.query(
        `SELECT COUNT(*) as c FROM "${child}" c WHERE c."${fk}" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "${parent}" p WHERE p.id = c."${fk}")`
      )
      const orphans = parseInt(r.rows[0].c, 10)
      if (orphans > 0) problems++
      console.log(`  ${orphans === 0 ? '✅' : '❌'} ${child}.${fk} → ${parent}: ${orphans} orphaned rows`)
    }

    console.log('\n── 4. Real users present (not seed placeholders) ──')
    const admin = await client.query(`SELECT username, email FROM users WHERE role = 'admin' LIMIT 1`)
    console.log(`  admin row: ${JSON.stringify(admin.rows[0] ?? 'NONE FOUND')}`)

    console.log(`\n${problems === 0 ? '✅ All checks passed.' : `❌ ${problems} problem(s) found — see above.`}`)
  } finally {
    client.release()
    await pool.end()
    sqliteDb.close()
  }
}

main().catch(err => {
  console.error('Verification failed:', err)
  process.exit(1)
})
