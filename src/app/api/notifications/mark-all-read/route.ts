import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await db.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token]
  )
  return session?.user_id ?? null
}

/**
 * POST /api/notifications/mark-all-read
 * Marks all unread notifications as read for the authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await db.run(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [userId]
    )

    return NextResponse.json({ success: true, updated: result.changes })
  } catch (err) {
    console.error('Mark all read error:', err)
    return NextResponse.json({ error: 'Failed to mark all as read' }, { status: 500 })
  }
}
