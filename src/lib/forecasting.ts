/**
 * Cash Flow Forecasting Engine
 *
 * Generates 30/60/90-day projections based on:
 *   1. Historical daily averages (last 90 days) by category
 *   2. Known recurring transactions from the recurring_transactions table
 *   3. Pending receivables by due date
 *   4. Current balance as the starting point
 *
 * Confidence decreases linearly with distance from today.
 */

import db from '@/lib/db.async'

export interface ForecastDay {
  date: string
  projected_income: number
  projected_expense: number
  projected_balance: number
  confidence: number
  events: ForecastEvent[]
}

export interface ForecastEvent {
  type: 'recurring' | 'receivable'
  description: string
  amount: number
  kind: 'credit' | 'debit'
}

export interface ForecastSummary {
  projected_end_balance: number
  total_projected_income: number
  total_projected_expense: number
  lowest_balance_date: string
  lowest_balance_amount: number
  starting_balance: number
}

export interface ForecastResult {
  days: ForecastDay[]
  summary: ForecastSummary
}

// ─── helpers ────────────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

function advanceRecurringDate(
  current: string,
  frequency: string,
  interval: number,
  dayOfMonth?: number | null,
): string {
  const d = new Date(current + 'T00:00:00')
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + interval)
      break
    case 'weekly':
      d.setDate(d.getDate() + 7 * interval)
      break
    case 'monthly': {
      d.setMonth(d.getMonth() + interval)
      if (dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 28) {
        d.setDate(dayOfMonth)
      }
      break
    }
    case 'yearly':
      d.setFullYear(d.getFullYear() + interval)
      break
    default:
      d.setMonth(d.getMonth() + interval)
  }
  return toISODate(d)
}

// ─── main forecasting function ──────────────────────────────────────────────

export async function forecastCashFlow(
  userId: number,
  businessId: number | null,
  days: 30 | 60 | 90,
): Promise<ForecastResult> {
  const today = new Date()
  const todayStr = toISODate(today)
  const ninetyDaysAgo = toISODate(addDays(today, -90))
  const endDate = toISODate(addDays(today, days))

  // ── 1. Current balance ────────────────────────────────────────────────────
  const bizFilter = businessId ? 'AND t.business_id = ?' : ''
  const bizParams: unknown[] = businessId ? [userId, ninetyDaysAgo, businessId] : [userId, ninetyDaysAgo]
  const balParams: unknown[] = businessId ? [userId, businessId] : [userId]

  const balRow = await db.get<{ balance: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN type = 'debit'  THEN amount ELSE 0 END), 0) AS balance
     FROM transactions
     WHERE business_id IN (SELECT id FROM businesses WHERE user_id = ?) AND status = 'completed' ${businessId ? 'AND business_id = ?' : ''}`,
    balParams,
  )
  const currentBalance = balRow?.balance ?? 0

  // ── 2. Historical daily averages (last 90 days) ───────────────────────────
  const histRows = await db.all<{ type: string; daily_avg: number }>(
    `SELECT type, COALESCE(SUM(amount), 0) / 90.0 AS daily_avg
     FROM transactions t
     WHERE t.business_id IN (SELECT id FROM businesses WHERE user_id = ?) AND t.date >= ? AND t.status = 'completed' ${bizFilter}
     GROUP BY type`,
    bizParams,
  )

  let dailyAvgIncome = 0
  let dailyAvgExpense = 0
  for (const r of histRows) {
    if (r.type === 'credit') dailyAvgIncome = r.daily_avg
    if (r.type === 'debit') dailyAvgExpense = r.daily_avg
  }

  // ── 3. Recurring transactions within forecast window ──────────────────────
  const recurringRows = await db.all<{
    id: number
    type: string
    amount: number
    note: string | null
    frequency: string
    interval_value: number
    day_of_month: number | null
    next_run_date: string
    end_date: string | null
  }>(
    `SELECT id, type, amount, note, frequency, interval_value, day_of_month, next_run_date, end_date
     FROM recurring_transactions
     WHERE user_id = ? AND status = 'active'
       ${businessId ? 'AND business_id = ?' : ''}`,
    businessId ? [userId, businessId] : [userId],
  )

  // Build a map of date → events from recurring rules
  const recurringByDate = new Map<string, ForecastEvent[]>()
  for (const rule of recurringRows) {
    let cursor = rule.next_run_date
    let safety = 0
    while (cursor <= endDate && safety < 500) {
      if (cursor >= todayStr) {
        if (!recurringByDate.has(cursor)) recurringByDate.set(cursor, [])
        recurringByDate.get(cursor)!.push({
          type: 'recurring',
          description: rule.note || `Recurring ${rule.type}`,
          amount: rule.amount,
          kind: rule.type as 'credit' | 'debit',
        })
      }
      cursor = advanceRecurringDate(cursor, rule.frequency, rule.interval_value, rule.day_of_month)
      if (rule.end_date && cursor > rule.end_date) break
      safety++
    }
  }

  // ── 4. Pending receivables by due date ────────────────────────────────────
  const receivables = await db.all<{
    id: number
    amount: number
    client_name: string | null
    due_date: string
    type: string
  }>(
    `SELECT id, amount, client_name, due_date, type
     FROM transactions
     WHERE business_id IN (SELECT id FROM businesses WHERE user_id = ?) AND status = 'pending' AND due_date IS NOT NULL AND due_date >= ?
       ${businessId ? 'AND business_id = ?' : ''}`,
    businessId ? [userId, todayStr, businessId] : [userId, todayStr],
  )

  const receivablesByDate = new Map<string, ForecastEvent[]>()
  for (const rec of receivables) {
    const d = rec.due_date
    if (!receivablesByDate.has(d)) receivablesByDate.set(d, [])
    receivablesByDate.get(d)!.push({
      type: 'receivable',
      description: rec.client_name
        ? (rec.type === 'credit' ? `Payment from ${rec.client_name}` : `Payment to ${rec.client_name}`)
        : (rec.type === 'credit' ? 'Pending receivable' : 'Pending bill'),
      amount: rec.amount,
      kind: rec.type as 'credit' | 'debit',
    })
  }

  // ── 5. Project daily balance ──────────────────────────────────────────────
  const forecastDays: ForecastDay[] = []
  let runningBalance = currentBalance
  let lowestBalance = currentBalance
  let lowestBalanceDate = todayStr
  let totalIncome = 0
  let totalExpense = 0

  for (let i = 1; i <= days; i++) {
    const date = toISODate(addDays(today, i))
    const confidence = Math.max(0.1, 1 - (i / (days * 1.2)))

    const events: ForecastEvent[] = [
      ...(recurringByDate.get(date) || []),
      ...(receivablesByDate.get(date) || []),
    ]

    // Known event amounts
    let eventIncome = 0
    let eventExpense = 0
    for (const ev of events) {
      if (ev.kind === 'credit') eventIncome += ev.amount
      else eventExpense += ev.amount
    }

    // Projected = historical average + known events
    const dayIncome = dailyAvgIncome + eventIncome
    const dayExpense = dailyAvgExpense + eventExpense

    runningBalance = runningBalance + dayIncome - dayExpense
    totalIncome += dayIncome
    totalExpense += dayExpense

    if (runningBalance < lowestBalance) {
      lowestBalance = runningBalance
      lowestBalanceDate = date
    }

    forecastDays.push({
      date,
      projected_income: Math.round(dayIncome * 100) / 100,
      projected_expense: Math.round(dayExpense * 100) / 100,
      projected_balance: Math.round(runningBalance * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      events,
    })
  }

  return {
    days: forecastDays,
    summary: {
      projected_end_balance: Math.round(runningBalance * 100) / 100,
      total_projected_income: Math.round(totalIncome * 100) / 100,
      total_projected_expense: Math.round(totalExpense * 100) / 100,
      lowest_balance_date: lowestBalanceDate,
      lowest_balance_amount: Math.round(lowestBalance * 100) / 100,
      starting_balance: Math.round(currentBalance * 100) / 100,
    },
  }
}
