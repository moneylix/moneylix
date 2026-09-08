import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session = await dbQuery.get<{ user_id: number }>(
      "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
      [token]
    )
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Auto-expire plans that have passed their expiry date
    await dbQuery.run(
      "UPDATE subscriptions SET status = 'expired' WHERE user_id = ? AND status = 'active' AND expires_at IS NOT NULL AND expires_at < datetime('now')",
      [session.user_id]
    )

    const sub = await dbQuery.get<{
      plan: string; status: string; expires_at: string | null; started_at: string; amount_paid: number
    }>(
      "SELECT plan, status, expires_at, started_at, amount_paid FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [session.user_id]
    )

    const plan = sub?.plan ?? 'free'
    const expiresAt = sub?.expires_at ?? null
    const daysLeft = expiresAt
      ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000))
      : null

    return NextResponse.json({
      plan,
      status: sub?.status ?? 'free',
      expires_at: expiresAt,
      days_left: daysLeft,
      started_at: sub?.started_at ?? null,
      amount_paid: sub?.amount_paid ?? 0,
    })
  } catch (err) {
    console.error('User plan error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
