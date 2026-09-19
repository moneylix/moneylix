/**
 * init-postgres-schema.ts
 * ========================
 * Creates the Moneylix schema on a fresh PostgreSQL database by running the
 * same migrations the app runs on boot, then clears the two seed rows
 * (admin/demo users) that get created along the way — those exist only so
 * a *fresh* install has something to log in with, and would otherwise
 * collide on id=1/id=2 with the real users about to be copied over from
 * SQLite by migrate-sqlite-to-postgres.ts.
 *
 * Run this FIRST, before migrate-sqlite-to-postgres.ts.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/init-postgres-schema.ts
 */

import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required.')
  process.exit(1)
}

async function main(): Promise<void> {
  // Imported after the DATABASE_URL check so db.postgres.ts's module-level
  // pool constructor never runs against an empty connection string.
  const { initDatabase, closeDatabase } = await import('../src/lib/db.postgres')

  console.log('Running migrations against:', DATABASE_URL!.replace(/\/\/.*@/, '//***@'))
  await initDatabase()
  console.log('Schema created.')

  const pool = new Pool({ connectionString: DATABASE_URL })
  const client = await pool.connect()
  try {
    console.log('Clearing seed rows (admin/demo users) before real data import...')
    await client.query('SET session_replication_role = replica')
    const tables = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'schema_migrations'`
    )
    for (const { tablename } of tables.rows) {
      await client.query(`DELETE FROM "${tablename}"`)
    }
    await client.query('SET session_replication_role = DEFAULT')
    console.log(`Cleared ${tables.rows.length} tables. Schema is ready for data import.`)
  } finally {
    client.release()
    await pool.end()
    await closeDatabase()
  }
}

main().catch(err => {
  console.error('Schema init failed:', err)
  process.exit(1)
})
