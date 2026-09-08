import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { sendPlanUpgradeEmail } from '@/lib/email/resend'

// Called by cron: GET /api/cron/expire-subscriptions
// Secure with CRON_SECRET env variable
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Mark expired subscriptions
    const expired = await dbQuery.run(
      `UPDATE subscriptions SET status = 'expired', updated_at = datetime('now')
       WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < datetime('now')`
    )

    // 2. Find subscriptions expiring in exactly 7 days — send reminder
    const expiring7 = await dbQuery.all<{ user_id: number; plan: string; expires_at: string; email: string }>(
      `SELECT s.user_id, s.plan, s.expires_at, u.email
       FROM subscriptions s JOIN users u ON u.id = s.user_id
       WHERE s.status = 'active'
       AND date(s.expires_at) = date('now', '+7 days')`
    )

    // 3. Find subscriptions expiring in exactly 1 day — send urgent reminder
    const expiring1 = await dbQuery.all<{ user_id: number; plan: string; expires_at: string; email: string }>(
      `SELECT s.user_id, s.plan, s.expires_at, u.email
       FROM subscriptions s JOIN users u ON u.id = s.user_id
       WHERE s.status = 'active'
       AND date(s.expires_at) = date('now', '+1 day')`
    )

    let emailsSent = 0
    for (const sub of [...expiring7, ...expiring1]) {
      try {
        await sendPlanUpgradeEmail(sub.email, sub.plan, new Date(sub.expires_at))
        emailsSent++
      } catch { /* non-blocking */ }
    }

    return NextResponse.json({
      success: true,
      expired: expired.changes,
      reminders_sent: emailsSent,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Cron expire-subscriptions error:', err)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
