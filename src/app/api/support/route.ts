import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'

export async function POST(request: NextRequest) {
  try {
    const { email, subject, message } = await request.json()
    if (!email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Email, subject and message are required' }, { status: 400 })
    }

    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    let userId: number | null = null
    if (token) {
      const session = await dbQuery.get<{ user_id: number }>(
        "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')", [token]
      )
      userId = session?.user_id ?? null
    }

    await dbQuery.run(
      'INSERT INTO support_tickets (email, subject, message, user_id) VALUES (?, ?, ?, ?)',
      [email.trim(), subject.trim(), message.trim(), userId]
    )

    return NextResponse.json({ success: true, message: 'Ticket submitted. We reply within 24 hours.' })
  } catch (err) {
    console.error('Support ticket error:', err)
    return NextResponse.json({ error: 'Failed to submit ticket' }, { status: 500 })
  }
}
