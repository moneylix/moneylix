import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { getFinancialYearDates, getQuarterDates } from '@/lib/gst'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await db.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token],
  )
  return session?.user_id ?? null
}

interface TxnAgg {
  total: number
}

interface MonthlyAgg {
  month: string
  income: number
  expense: number
  gst_collected: number
  gst_paid: number
}

/**
 * GET /api/gst/summary?businessId=N&financialYear=2026-27&quarter=Q1
 *
 * Returns GST summary:
 * - Total output tax (GST collected on income / invoices)
 * - Total input tax (GST paid on expenses)
 * - Net payable / receivable
 * - Monthly breakdown
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const financialYear = searchParams.get('financialYear')
    const quarter = searchParams.get('quarter') // optional: Q1, Q2, Q3, Q4

    if (!businessId || !financialYear) {
      return NextResponse.json({ error: 'businessId and financialYear are required' }, { status: 400 })
    }

    // Determine date range
    let dateRange: { start: string; end: string }
    if (quarter) {
      dateRange = getQuarterDates(financialYear, quarter)
    } else {
      dateRange = getFinancialYearDates(financialYear)
    }

    const bizId = parseInt(businessId, 10)

    // Get GST settings for this business to know the default rate
    const gstSettings = await db.get<{ default_tax_rate: number; gst_registered: number }>(
      'SELECT default_tax_rate, gst_registered FROM gst_settings WHERE user_id = ? AND business_id = ?',
      [userId, bizId],
    )
    const taxRate = gstSettings?.default_tax_rate ?? 18

    // Total income in period (credit transactions)
    const incomeRow = await db.get<TxnAgg>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE business_id = ? AND type = 'credit' AND status = 'completed'
         AND date >= ? AND date <= ?`,
      [bizId, dateRange.start, dateRange.end],
    )
    const totalIncome = incomeRow?.total ?? 0

    // Total expense in period (debit transactions)
    const expenseRow = await db.get<TxnAgg>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE business_id = ? AND type = 'debit' AND status = 'completed'
         AND date >= ? AND date <= ?`,
      [bizId, dateRange.start, dateRange.end],
    )
    const totalExpense = expenseRow?.total ?? 0

    // Estimate GST collected (output tax) — approximate from income * rate/(100+rate)
    // This assumes income amounts are GST-inclusive
    const gstCollected = round2(totalIncome * taxRate / (100 + taxRate))

    // Estimate GST paid (input tax) — approximate from expenses * rate/(100+rate)
    const gstPaid = round2(totalExpense * taxRate / (100 + taxRate))

    // Net payable
    const netPayable = round2(gstCollected - gstPaid)

    // Monthly breakdown
    const monthlyRows = await db.all<{
      month: string
      type: string
      total: number
    }>(
      `SELECT strftime('%Y-%m', date) as month, type, COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE business_id = ? AND status = 'completed'
         AND date >= ? AND date <= ?
       GROUP BY month, type
       ORDER BY month ASC`,
      [bizId, dateRange.start, dateRange.end],
    )

    // Build monthly summary
    const monthMap = new Map<string, MonthlyAgg>()
    for (const row of monthlyRows) {
      if (!monthMap.has(row.month)) {
        monthMap.set(row.month, { month: row.month, income: 0, expense: 0, gst_collected: 0, gst_paid: 0 })
      }
      const entry = monthMap.get(row.month)!
      if (row.type === 'credit') {
        entry.income = row.total
        entry.gst_collected = round2(row.total * taxRate / (100 + taxRate))
      } else {
        entry.expense = row.total
        entry.gst_paid = round2(row.total * taxRate / (100 + taxRate))
      }
    }

    const monthly = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month))

    // Fetch any manually entered tax entries for this period
    const taxEntries = await db.all<Record<string, unknown>>(
      `SELECT * FROM tax_entries
       WHERE user_id = ? AND business_id = ? AND financial_year = ?
       ${quarter ? "AND quarter = ?" : ""}
       ORDER BY created_at DESC`,
      quarter ? [userId, bizId, financialYear, quarter] : [userId, bizId, financialYear],
    )

    return NextResponse.json({
      financialYear,
      quarter: quarter ?? 'Full Year',
      dateRange,
      taxRate,
      gstRegistered: gstSettings?.gst_registered ?? 0,
      summary: {
        totalIncome,
        totalExpense,
        gstCollected,
        gstPaid,
        netPayable,
        netStatus: netPayable >= 0 ? 'payable' : 'receivable',
      },
      monthly,
      taxEntries,
    })
  } catch (err) {
    console.error('GST summary error:', err)
    return NextResponse.json({ error: 'Failed to generate GST summary' }, { status: 500 })
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
