import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'

/**
 * GET /api/cron/process-recurring
 * 
 * Cron job: processes all active recurring transactions whose next_run_date <= today.
 * For each: creates a real transaction, advances next_run_date, increments total_generated.
 * 
 * Call daily via cron or Vercel cron:
 *   curl https://moneylix.in/api/cron/process-recurring?secret=$CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().split('T')[0]

    // Get all recurring transactions due today or earlier
    const due = await db.all<{
      id: number; user_id: number; business_id: number | null
      type: string; amount: number; category_id: number | null
      currency: string; note: string | null; method: string | null; tags: string | null
      frequency: string; interval_value: number
      day_of_week: number | null; day_of_month: number | null; month_of_year: number | null
      next_run_date: string; end_date: string | null
    }>(
      `SELECT * FROM recurring_transactions 
       WHERE status = 'active' AND next_run_date <= ?`,
      [today]
    )

    let created = 0
    let completed = 0
    let errors = 0

    for (const rule of due) {
      try {
        // Create the transaction
        const now = new Date().toISOString()
        await db.run(
          `INSERT INTO transactions
             (type, amount, category_id, business_id, currency, date,
              note, method, tags, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
          [
            rule.type,
            rule.amount,
            rule.category_id,
            rule.business_id,
            rule.currency,
            rule.next_run_date, // Use the scheduled date, not today
            rule.note ? `${rule.note} (auto)` : '(recurring)',
            rule.method,
            rule.tags,
            now,
            now,
          ]
        )
        created++

        // Calculate next run date
        const nextDate = advanceDate(
          rule.next_run_date,
          rule.frequency,
          rule.interval_value,
          rule.day_of_week,
          rule.day_of_month,
          rule.month_of_year
        )

        // Check if we've passed the end_date
        if (rule.end_date && nextDate > rule.end_date) {
          await db.run(
            `UPDATE recurring_transactions 
             SET status = 'completed', last_run_date = ?, total_generated = total_generated + 1, updated_at = datetime('now')
             WHERE id = ?`,
            [rule.next_run_date, rule.id]
          )
          completed++
        } else {
          await db.run(
            `UPDATE recurring_transactions 
             SET next_run_date = ?, last_run_date = ?, total_generated = total_generated + 1, updated_at = datetime('now')
             WHERE id = ?`,
            [nextDate, rule.next_run_date, rule.id]
          )
        }
      } catch (err) {
        console.error(`[cron/process-recurring] Failed for rule ${rule.id}:`, err)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      processed: due.length,
      transactions_created: created,
      rules_completed: completed,
      errors,
      date: today,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[cron/process-recurring] Error:', err)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}

/**
 * Advance a date by the recurring frequency.
 */
function advanceDate(
  currentDate: string,
  frequency: string,
  interval: number,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null,
  monthOfYear?: number | null
): string {
  const date = new Date(currentDate + 'T00:00:00')

  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + interval)
      break
    case 'weekly':
      date.setDate(date.getDate() + 7 * interval)
      break
    case 'monthly': {
      date.setMonth(date.getMonth() + interval)
      // Handle day overflow (e.g., Jan 31 + 1 month = Feb 28)
      if (dayOfMonth) {
        const maxDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
        date.setDate(Math.min(dayOfMonth, maxDay))
      }
      break
    }
    case 'yearly': {
      date.setFullYear(date.getFullYear() + interval)
      if (dayOfMonth) {
        const maxDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
        date.setDate(Math.min(dayOfMonth, maxDay))
      }
      break
    }
  }

  return date.toISOString().split('T')[0]
}
