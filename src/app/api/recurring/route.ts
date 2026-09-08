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
 * GET /api/recurring
 * List all recurring transactions for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const recurring = await db.all<Record<string, unknown>>(
      `SELECT r.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
              b.name as business_name
       FROM recurring_transactions r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN businesses b ON b.id = r.business_id
       WHERE r.user_id = ?
       ORDER BY r.status ASC, r.next_run_date ASC`,
      [userId]
    )

    return NextResponse.json({ recurring })
  } catch (err) {
    console.error('Recurring GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch recurring transactions' }, { status: 500 })
  }
}

/**
 * POST /api/recurring
 * Create a new recurring transaction rule.
 * 
 * Body: {
 *   type: "credit" | "debit",
 *   amount: number,
 *   category_id?: number,
 *   business_id?: number,
 *   currency?: string,
 *   note?: string,
 *   method?: string,
 *   tags?: string,
 *   frequency: "daily" | "weekly" | "monthly" | "yearly",
 *   interval_value?: number,
 *   day_of_week?: number,
 *   day_of_month?: number,
 *   month_of_year?: number,
 *   start_date: string,  // YYYY-MM-DD
 *   end_date?: string,
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      type, amount, category_id, business_id, currency, note, method, tags,
      frequency, interval_value, day_of_week, day_of_month, month_of_year,
      start_date, end_date,
    } = body

    // Validation
    if (!type || !['credit', 'debit'].includes(type)) {
      return NextResponse.json({ error: 'Type must be "credit" or "debit"' }, { status: 400 })
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
    }
    if (!frequency || !['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
      return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
    }
    if (!start_date || !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
      return NextResponse.json({ error: 'start_date must be YYYY-MM-DD' }, { status: 400 })
    }

    // Verify business belongs to user
    if (business_id) {
      const biz = await db.get('SELECT id FROM businesses WHERE id = ? AND user_id = ?', [business_id, userId])
      if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Calculate next_run_date
    const nextRunDate = calculateNextRunDate(start_date, frequency, interval_value || 1, day_of_week, day_of_month, month_of_year)

    const result = await db.run(
      `INSERT INTO recurring_transactions (
        user_id, business_id, type, amount, category_id, currency, note, method, tags,
        frequency, interval_value, day_of_week, day_of_month, month_of_year,
        start_date, end_date, next_run_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        userId, business_id || null, type, amount, category_id || null,
        currency || 'INR', note || null, method || 'bank', tags || null,
        frequency, interval_value || 1, day_of_week ?? null, day_of_month ?? null, month_of_year ?? null,
        start_date, end_date || null, nextRunDate,
      ]
    )

    const created = await db.get<Record<string, unknown>>(
      'SELECT * FROM recurring_transactions WHERE id = ?',
      [result.lastInsertRowid as number]
    )

    return NextResponse.json({ success: true, recurring: created }, { status: 201 })
  } catch (err) {
    console.error('Recurring POST error:', err)
    return NextResponse.json({ error: 'Failed to create recurring transaction' }, { status: 500 })
  }
}

/**
 * Calculate the next run date based on frequency settings.
 */
function calculateNextRunDate(
  startDate: string,
  frequency: string,
  interval: number,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null,
  monthOfYear?: number | null
): string {
  const today = new Date().toISOString().split('T')[0]
  
  // If start date is in the future, use it
  if (startDate >= today) return startDate

  // Otherwise calculate next occurrence from today
  const now = new Date()
  
  switch (frequency) {
    case 'daily': {
      return today
    }
    case 'weekly': {
      const targetDay = dayOfWeek ?? now.getDay()
      const currentDay = now.getDay()
      const daysUntil = (targetDay - currentDay + 7) % 7 || 7
      const next = new Date(now)
      next.setDate(now.getDate() + daysUntil)
      return next.toISOString().split('T')[0]
    }
    case 'monthly': {
      const targetDom = dayOfMonth ?? now.getDate()
      const next = new Date(now.getFullYear(), now.getMonth(), targetDom)
      if (next <= now) next.setMonth(next.getMonth() + interval)
      return next.toISOString().split('T')[0]
    }
    case 'yearly': {
      const targetMonth = (monthOfYear ?? (now.getMonth() + 1)) - 1
      const targetDay = dayOfMonth ?? now.getDate()
      const next = new Date(now.getFullYear(), targetMonth, targetDay)
      if (next <= now) next.setFullYear(next.getFullYear() + interval)
      return next.toISOString().split('T')[0]
    }
    default:
      return today
  }
}
