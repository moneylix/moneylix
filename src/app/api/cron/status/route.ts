import { NextRequest, NextResponse } from 'next/server'
import { getSchedulerStatus } from '@/lib/scheduler'

/**
 * GET /api/cron/status
 * Returns the current status of the internal cron scheduler.
 * Useful for debugging whether jobs are running.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only admin can check cron status
    const db = (await import('@/lib/db.async')).default
    const session = await db.get<{ user_id: number }>(
      "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
      [token]
    )
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await db.get<{ role: string }>(
      'SELECT role FROM users WHERE id = ?',
      [session.user_id]
    )
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const status = getSchedulerStatus()
    return NextResponse.json(status)
  } catch (err) {
    console.error('Cron status error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
