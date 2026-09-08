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

    const notifications: { id: string; type: string; message: string; created_at: string }[] = []

    const sub = await dbQuery.get<{ plan: string; expires_at: string | null; status: string }>(
      "SELECT plan, expires_at, status FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
      [session.user_id]
    )

    if (sub?.expires_at) {
      const daysLeft = Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / 86400000)

      if (sub.status === 'expired' || daysLeft <= 0) {
        notifications.push({
          id: 'plan_expired',
          type: 'error',
          message: `Your ${sub.plan} plan has expired. Renew to continue using premium features.`,
          created_at: sub.expires_at,
        })
      } else if (daysLeft <= 7) {
        notifications.push({
          id: 'plan_expiring_soon',
          type: 'warning',
          message: `Your ${sub.plan} plan expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew now to avoid interruption.`,
          created_at: new Date().toISOString(),
        })
      } else if (daysLeft <= 30) {
        notifications.push({
          id: 'plan_expiring',
          type: 'info',
          message: `Your ${sub.plan} plan expires in ${daysLeft} days.`,
          created_at: new Date().toISOString(),
        })
      }
    }

    // Pending receivables reminder
    const pendingCount = await dbQuery.get<{ n: number }>(
      "SELECT COUNT(*) as n FROM transactions WHERE status = 'pending' AND type = 'credit'",
      []
    )
    if ((pendingCount?.n ?? 0) > 0) {
      notifications.push({
        id: 'pending_receivables',
        type: 'info',
        message: `You have ${pendingCount!.n} pending receivable${pendingCount!.n === 1 ? '' : 's'} awaiting payment.`,
        created_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ notifications })
  } catch (err) {
    console.error('Notifications error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
