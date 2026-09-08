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
 * GET /api/notifications
 * List notifications for the authenticated user.
 * Query params: unread=true, type=low_balance, limit=20, offset=0
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const type = searchParams.get('type')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const conditions: string[] = ['n.user_id = ?']
    const params: unknown[] = [userId]

    if (unreadOnly) {
      conditions.push('n.is_read = 0')
    }
    if (type) {
      conditions.push('n.type = ?')
      params.push(type)
    }

    const whereClause = conditions.join(' AND ')

    const countRow = await db.get<{ total: number }>(
      `SELECT COUNT(*) as total FROM notifications n WHERE ${whereClause}`,
      params
    )
    const total = countRow?.total ?? 0

    const notifications = await db.all<Record<string, unknown>>(
      `SELECT n.*, b.name as business_name
       FROM notifications n
       LEFT JOIN businesses b ON b.id = n.business_id
       WHERE ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const unreadCount = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    )

    return NextResponse.json({
      notifications,
      total,
      unreadCount: unreadCount?.count ?? 0,
      limit,
      offset,
    })
  } catch (err) {
    console.error('Notifications GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

/**
 * POST /api/notifications
 * Mark a single notification as read.
 * Body: { id: number }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing notification id' }, { status: 400 })
    }

    const notification = await db.get<{ user_id: number }>(
      'SELECT user_id FROM notifications WHERE id = ?',
      [id]
    )
    if (!notification || notification.user_id !== userId) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    await db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Notifications POST error:', err)
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }
}
