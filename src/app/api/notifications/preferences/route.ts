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

const NOTIFICATION_TYPES = [
  'low_balance',
  'due_date',
  'unusual_spend',
  'tax_deadline',
  'budget_alert',
  'system',
] as const

/**
 * GET /api/notifications/preferences
 * Returns all notification preferences for the user.
 * Any type not in the table defaults to email_enabled=1, push_enabled=1.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await db.all<{
      notification_type: string
      email_enabled: number
      push_enabled: number
    }>(
      'SELECT notification_type, email_enabled, push_enabled FROM notification_preferences WHERE user_id = ?',
      [userId]
    )

    const prefMap: Record<string, { email_enabled: boolean; push_enabled: boolean }> = {}
    for (const t of NOTIFICATION_TYPES) {
      prefMap[t] = { email_enabled: true, push_enabled: true }
    }
    for (const row of rows) {
      prefMap[row.notification_type] = {
        email_enabled: row.email_enabled === 1,
        push_enabled: row.push_enabled === 1,
      }
    }

    return NextResponse.json({ preferences: prefMap })
  } catch (err) {
    console.error('Notification preferences GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }
}

/**
 * PUT /api/notifications/preferences
 * Update notification preferences for the user.
 * Body: { type: string, email_enabled: boolean, push_enabled: boolean }
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { type, email_enabled, push_enabled } = body

    if (!type || !NOTIFICATION_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 })
    }

    await db.run(
      `INSERT INTO notification_preferences (user_id, notification_type, email_enabled, push_enabled)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, notification_type) DO UPDATE SET
         email_enabled = excluded.email_enabled,
         push_enabled = excluded.push_enabled`,
      [userId, type, email_enabled ? 1 : 0, push_enabled ? 1 : 0]
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Notification preferences PUT error:', err)
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }
}
