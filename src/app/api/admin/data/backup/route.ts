import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_auth'
import { audit } from '@/lib/audit'
import fs from 'fs'
import path from 'path'

/**
 * GET /api/admin/data/backup
 * Streams the live SQLite database file as a timestamped download.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Resolve the DB path the same way src/lib/db.ts does
    const newPath = path.join(process.cwd(), 'moneylix.db')
    const oldPath = path.join(process.cwd(), 'moneyflow.db')
    const dbPath = (!fs.existsSync(newPath) && fs.existsSync(oldPath)) ? oldPath : newPath

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'Database file not found' }, { status: 404 })
    }

    const buffer = fs.readFileSync(dbPath)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `moneylix-backup-${stamp}.db`

    await audit({
      userId: admin.id,
      action: 'DATA_BACKUP_DOWNLOADED',
      category: 'admin',
      description: `Admin downloaded a database backup (${(buffer.length / 1024).toFixed(0)} KB)`,
      request,
    })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    console.error('[admin/data/backup] error:', err)
    return NextResponse.json({ error: 'Backup failed' }, { status: 500 })
  }
}
