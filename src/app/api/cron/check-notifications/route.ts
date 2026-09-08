import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { checkLowBalance, checkUpcomingDues, checkUnusualSpend } from '@/lib/notifications'

/**
 * GET /api/cron/check-notifications
 *
 * Daily cron job that checks all active users for:
 *  1. Low balance (balance < 20% of monthly average income)
 *  2. Upcoming receivable due dates (within 3 days)
 *  3. Unusual spending (category spend > 150% of 3-month average)
 *
 * Creates in-app notifications and optionally sends emails.
 * Call this from an external cron scheduler (e.g., crontab, Upstash QStash).
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret')
    const envSecret = process.env.CRON_SECRET
    if (envSecret && cronSecret !== envSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all active users (have logged in within the last 30 days)
    const activeUsers = await db.all<{ id: number }>(
      `SELECT DISTINCT u.id FROM users u
       INNER JOIN sessions s ON s.user_id = u.id
       WHERE s.expires_at > datetime('now', '-30 days')
         AND u.role != 'admin'`
    )

    const stats = {
      usersChecked: activeUsers.length,
      lowBalanceAlerts: 0,
      dueAlerts: 0,
      unusualSpendAlerts: 0,
      errors: 0,
    }

    for (const user of activeUsers) {
      try {
        // 1. Check upcoming dues (user-level, not per-business)
        const dueCount = await checkUpcomingDues(user.id)
        stats.dueAlerts += dueCount

        // 2. Per-business checks
        const businesses = await db.all<{ id: number }>(
          'SELECT id FROM businesses WHERE user_id = ?',
          [user.id]
        )

        for (const biz of businesses) {
          try {
            // Low balance check
            const lowBal = await checkLowBalance(user.id, biz.id)
            if (lowBal) stats.lowBalanceAlerts++

            // Unusual spend check
            const unusualCount = await checkUnusualSpend(user.id, biz.id)
            stats.unusualSpendAlerts += unusualCount
          } catch (bizErr) {
            console.error(`[cron] Error checking business ${biz.id} for user ${user.id}:`, bizErr)
            stats.errors++
          }
        }

        // 3. Budget overspend checks
        await checkBudgetAlerts(user.id)
      } catch (userErr) {
        console.error(`[cron] Error checking user ${user.id}:`, userErr)
        stats.errors++
      }
    }

    console.log('[cron] Notification check complete:', stats)
    return NextResponse.json({ success: true, stats })
  } catch (err) {
    console.error('[cron] check-notifications error:', err)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}

/**
 * Check budget alerts for a user.
 * Fires when any business+category actual spend exceeds its budgeted amount.
 */
async function checkBudgetAlerts(userId: number): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

  const budgets = await db.all<{
    id: number
    business_id: number
    category_id: number | null
    amount: number
    business_name: string
    category_name: string | null
  }>(
    `SELECT b.id, b.business_id, b.category_id, b.amount,
            biz.name as business_name,
            c.name as category_name
     FROM budgets b
     LEFT JOIN businesses biz ON biz.id = b.business_id
     LEFT JOIN categories c ON c.id = b.category_id
     WHERE b.user_id = ? AND b.month = ?`,
    [userId, currentMonth]
  )

  for (const budget of budgets) {
    let actualSpend = 0

    if (budget.category_id) {
      const row = await db.get<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE business_id = ? AND type = 'debit' AND status = 'completed'
           AND category_id = ?
           AND strftime('%Y-%m', date) = ?`,
        [budget.business_id, budget.category_id, currentMonth]
      )
      actualSpend = row?.total ?? 0
    } else {
      const row = await db.get<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE business_id = ? AND type = 'debit' AND status = 'completed'
           AND strftime('%Y-%m', date) = ?`,
        [budget.business_id, currentMonth]
      )
      actualSpend = row?.total ?? 0
    }

    const percentUsed = budget.amount > 0 ? (actualSpend / budget.amount) * 100 : 0

    if (percentUsed >= 100) {
      // Check we haven't already notified in the last 3 days
      const existing = await db.get<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM notifications
         WHERE user_id = ? AND business_id = ? AND type = 'budget_alert'
           AND json_extract(metadata, '$.budget_id') = ?
           AND created_at > datetime('now', '-3 days')`,
        [userId, budget.business_id, budget.id]
      )
      if (existing && existing.cnt > 0) continue

      const catLabel = budget.category_name || 'Overall'
      const { createNotification, sendNotificationEmail } = await import('@/lib/notifications')

      await createNotification(
        userId,
        'budget_alert',
        'Budget Exceeded',
        `${catLabel} budget in "${budget.business_name}" has been exceeded: ₹${Math.round(actualSpend).toLocaleString()} spent of ₹${Math.round(budget.amount).toLocaleString()} budgeted (${Math.round(percentUsed)}%).`,
        {
          businessId: budget.business_id,
          actionUrl: '/dashboard/budgets',
          metadata: {
            budget_id: budget.id,
            category_id: budget.category_id,
            budgeted: budget.amount,
            actual: actualSpend,
            percent: Math.round(percentUsed),
          },
        }
      )

      await sendNotificationEmail(userId, {
        type: 'budget_alert',
        title: 'Budget Exceeded',
        message: `${catLabel} budget in "${budget.business_name}" is at ${Math.round(percentUsed)}%.`,
        action_url: '/dashboard/budgets',
      })
    }
  }
}
