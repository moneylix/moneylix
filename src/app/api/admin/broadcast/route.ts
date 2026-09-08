import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { requireAdmin } from '@/app/api/admin/_auth'

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { subject, message, plan_filter } = await request.json()

    if (!subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
    }

    // Get target users based on plan filter
    let users: { id: number; email: string; username: string }[]

    if (plan_filter && plan_filter !== 'all') {
      users = await dbQuery.all<{ id: number; email: string; username: string }>(
        `SELECT DISTINCT u.id, u.email, u.username
         FROM users u
         JOIN subscriptions s ON s.user_id = u.id
         WHERE s.plan = ? AND s.status = 'active'`,
        [plan_filter]
      )
    } else {
      users = await dbQuery.all<{ id: number; email: string; username: string }>(
        'SELECT id, email, username FROM users WHERE email_verified = 1'
      )
    }

    // Store broadcast in DB for notification center
    const now = new Date().toISOString()
    await dbQuery.run(
      `INSERT INTO broadcasts (subject, message, plan_filter, sent_by, sent_at, recipient_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [subject, message, plan_filter ?? 'all', admin.id, now, users.length]
    )

    return NextResponse.json({
      success: true,
      recipients: users.length,
      message: `Broadcast queued for ${users.length} users`,
    })
  } catch (err) {
    console.error('Broadcast error:', err)
    return NextResponse.json({ error: 'Failed to send broadcast' }, { status: 500 })
  }
}
