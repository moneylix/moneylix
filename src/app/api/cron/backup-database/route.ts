import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

/**
 * GET /api/cron/backup-database
 *
 * Daily cron job: copies the live SQLite database to a timestamped file in
 * backups/, then prunes anything beyond the retention window. Fills the gap
 * where the admin panel only offered a manual, one-off backup download.
 *
 * Scope note: this only backs up the local SQLite file. It's a real fix for
 * the current local/VPS deployment (persistent disk), but:
 *   - On ephemeral PaaS hosting (Render/Railway/etc.) without a persistent
 *     disk, files written here vanish on redeploy same as the DB itself —
 *     this job alone does not solve that.
 *   - Once the app is cut over to Postgres, this job intentionally no-ops
 *     (DATABASE_URL present) — rely on the Postgres host's own automated
 *     backups (Render/Supabase both offer this) instead of pg_dump-ing from
 *     inside the app process.
 *
 * Call via the internal scheduler (src/lib/scheduler.ts) or an external
 * cron hitting this endpoint with ?secret=$CRON_SECRET.
 */
const RETENTION_COUNT = 14 // keep the last 14 daily backups

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret') || request.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Postgres deployments back up at the hosting-provider level, not here.
  if (process.env.DATABASE_URL) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'DATABASE_URL is set — relying on the Postgres host\'s automated backups instead of a local file copy.',
    })
  }

  try {
    const newPath = path.join(process.cwd(), 'moneylix.db')
    const oldPath = path.join(process.cwd(), 'moneyflow.db')
    const dbPath = (!fs.existsSync(newPath) && fs.existsSync(oldPath)) ? oldPath : newPath

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'Database file not found' }, { status: 404 })
    }

    const backupsDir = path.join(process.cwd(), 'backups')
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true })

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupPath = path.join(backupsDir, `moneylix-${stamp}.db`)
    fs.copyFileSync(dbPath, backupPath)

    // Prune anything beyond the retention window, oldest first.
    const existing = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('moneylix-') && f.endsWith('.db'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(backupsDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)

    let pruned = 0
    for (const file of existing.slice(RETENTION_COUNT)) {
      fs.unlinkSync(path.join(backupsDir, file.name))
      pruned++
    }

    return NextResponse.json({
      success: true,
      backup: path.basename(backupPath),
      sizeKB: Math.round(fs.statSync(backupPath).size / 1024),
      totalBackups: Math.min(existing.length, RETENTION_COUNT),
      pruned,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[cron/backup-database] error:', err)
    return NextResponse.json({ error: 'Backup failed' }, { status: 500 })
  }
}
