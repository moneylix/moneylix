import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { getFinancialYearDates } from '@/lib/gst'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await db.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token],
  )
  return session?.user_id ?? null
}

interface CategoryAgg {
  category_name: string
  type: string
  total: number
  count: number
}

interface MonthAgg {
  month: string
  income: number
  expense: number
}

/**
 * GET /api/export/tax-report?businessId=N&financialYear=2026-27
 *
 * Generate a comprehensive tax-ready report as JSON:
 * - Income by category
 * - Expenses by category
 * - GST summary
 * - TDS summary
 * - P&L summary (total income - total expenses = net profit)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const financialYear = searchParams.get('financialYear')

    if (!businessId || !financialYear) {
      return NextResponse.json({ error: 'businessId and financialYear are required' }, { status: 400 })
    }

    const bizId = parseInt(businessId, 10)
    const dateRange = getFinancialYearDates(financialYear)

    // Business info
    const business = await db.get<{ name: string }>(
      'SELECT name FROM businesses WHERE id = ?',
      [bizId],
    )

    // GST settings
    const gstSettings = await db.get<{ gstin: string | null; gst_registered: number; state_code: string | null; default_tax_rate: number }>(
      'SELECT gstin, gst_registered, state_code, default_tax_rate FROM gst_settings WHERE user_id = ? AND business_id = ?',
      [userId, bizId],
    )

    // Income by category
    const incomeByCategory = await db.all<CategoryAgg>(
      `SELECT c.name as category_name, t.type, COALESCE(SUM(t.amount), 0) as total, COUNT(*) as count
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.business_id = ? AND t.type = 'credit' AND t.status = 'completed'
         AND t.date >= ? AND t.date <= ?
       GROUP BY c.name
       ORDER BY total DESC`,
      [bizId, dateRange.start, dateRange.end],
    )

    // Expenses by category
    const expenseByCategory = await db.all<CategoryAgg>(
      `SELECT c.name as category_name, t.type, COALESCE(SUM(t.amount), 0) as total, COUNT(*) as count
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.business_id = ? AND t.type = 'debit' AND t.status = 'completed'
         AND t.date >= ? AND t.date <= ?
       GROUP BY c.name
       ORDER BY total DESC`,
      [bizId, dateRange.start, dateRange.end],
    )

    // Monthly breakdown
    const monthlyData = await db.all<{ month: string; type: string; total: number }>(
      `SELECT strftime('%Y-%m', date) as month, type, COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE business_id = ? AND status = 'completed'
         AND date >= ? AND date <= ?
       GROUP BY month, type
       ORDER BY month ASC`,
      [bizId, dateRange.start, dateRange.end],
    )

    const monthlyMap = new Map<string, MonthAgg>()
    for (const row of monthlyData) {
      if (!monthlyMap.has(row.month)) {
        monthlyMap.set(row.month, { month: row.month, income: 0, expense: 0 })
      }
      const entry = monthlyMap.get(row.month)!
      if (row.type === 'credit') entry.income = row.total
      else entry.expense = row.total
    }
    const monthly = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month))

    // Totals
    const totalIncome = incomeByCategory.reduce((s, c) => s + c.total, 0)
    const totalExpense = expenseByCategory.reduce((s, c) => s + c.total, 0)
    const netProfit = totalIncome - totalExpense
    const taxRate = gstSettings?.default_tax_rate ?? 18

    // GST summary
    const gstCollected = Math.round((totalIncome * taxRate / (100 + taxRate)) * 100) / 100
    const gstPaid = Math.round((totalExpense * taxRate / (100 + taxRate)) * 100) / 100
    const netGST = Math.round((gstCollected - gstPaid) * 100) / 100

    // TDS entries
    const tdsEntries = await db.all<Record<string, unknown>>(
      `SELECT * FROM tax_entries
       WHERE user_id = ? AND business_id = ? AND financial_year = ?
         AND type IN ('tds_deducted', 'tds_receivable')
       ORDER BY created_at ASC`,
      [userId, bizId, financialYear],
    )

    const totalTDS = tdsEntries.reduce((s, e) => s + ((e.amount as number) ?? 0), 0)

    // Advance tax entries
    const advanceTaxEntries = await db.all<Record<string, unknown>>(
      `SELECT * FROM tax_entries
       WHERE user_id = ? AND business_id = ? AND financial_year = ? AND type = 'advance_tax'
       ORDER BY created_at ASC`,
      [userId, bizId, financialYear],
    )

    const totalAdvanceTax = advanceTaxEntries.reduce((s, e) => s + ((e.amount as number) ?? 0), 0)

    // Transaction count
    const countRow = await db.get<{ total: number }>(
      `SELECT COUNT(*) as total FROM transactions
       WHERE business_id = ? AND status = 'completed' AND date >= ? AND date <= ?`,
      [bizId, dateRange.start, dateRange.end],
    )

    const report = {
      reportType: 'Tax-Ready Financial Report',
      generatedAt: new Date().toISOString(),
      financialYear,
      dateRange,
      business: {
        name: business?.name ?? 'Unknown',
        gstin: gstSettings?.gstin ?? null,
        gstRegistered: (gstSettings?.gst_registered ?? 0) === 1,
        stateCode: gstSettings?.state_code ?? null,
      },
      transactionCount: countRow?.total ?? 0,
      profitAndLoss: {
        totalIncome: round2(totalIncome),
        totalExpense: round2(totalExpense),
        netProfit: round2(netProfit),
        profitMargin: totalIncome > 0 ? round2((netProfit / totalIncome) * 100) : 0,
      },
      incomeByCategory: incomeByCategory.map((c) => ({
        category: c.category_name,
        amount: round2(c.total),
        transactions: c.count,
        percentage: totalIncome > 0 ? round2((c.total / totalIncome) * 100) : 0,
      })),
      expenseByCategory: expenseByCategory.map((c) => ({
        category: c.category_name,
        amount: round2(c.total),
        transactions: c.count,
        percentage: totalExpense > 0 ? round2((c.total / totalExpense) * 100) : 0,
      })),
      gstSummary: {
        taxRate,
        gstCollected: round2(gstCollected),
        gstPaid: round2(gstPaid),
        netGST: round2(netGST),
        netStatus: netGST >= 0 ? 'payable' : 'receivable',
      },
      tdsSummary: {
        totalTDSDeducted: round2(totalTDS),
        entries: tdsEntries,
      },
      advanceTaxSummary: {
        totalPaid: round2(totalAdvanceTax),
        entries: advanceTaxEntries,
      },
      monthlyBreakdown: monthly.map((m) => ({
        ...m,
        income: round2(m.income),
        expense: round2(m.expense),
        netProfit: round2(m.income - m.expense),
      })),
    }

    // Return as downloadable JSON
    const fileName = `tax_report_${business?.name?.replace(/\s+/g, '_') ?? 'business'}_FY${financialYear}.json`

    return new NextResponse(JSON.stringify(report, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err) {
    console.error('Tax report export error:', err)
    return NextResponse.json({ error: 'Failed to generate tax report' }, { status: 500 })
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
