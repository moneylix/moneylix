import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { getFinancialYear, getFinancialYearDates, getQuarter, getQuarterDates } from '@/lib/gst'
import { getPlanForUserId, planAtLeast } from '@/lib/plan'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await db.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token],
  )
  return session?.user_id ?? null
}

/**
 * Income tax slab rates for FY 2026-27 (New Regime — default).
 * These are indicative and may need updating for newer FYs.
 */
const NEW_REGIME_SLABS = [
  { min: 0,        max: 300000,   rate: 0 },
  { min: 300000,   max: 700000,   rate: 5 },
  { min: 700000,   max: 1000000,  rate: 10 },
  { min: 1000000,  max: 1200000,  rate: 15 },
  { min: 1200000,  max: 1500000,  rate: 20 },
  { min: 1500000,  max: Infinity, rate: 30 },
]

function estimateIncomeTax(annualIncome: number): number {
  let tax = 0
  for (const slab of NEW_REGIME_SLABS) {
    if (annualIncome <= slab.min) break
    const taxableInSlab = Math.min(annualIncome, slab.max) - slab.min
    tax += taxableInSlab * (slab.rate / 100)
  }
  // 4% health & education cess
  tax = Math.round(tax * 1.04)
  return tax
}

/**
 * GET /api/tax/estimates?businessId=N
 *
 * Calculate TDS / advance tax estimates based on income this financial year.
 *
 * Returns:
 * - Annual income (projected from current earnings)
 * - Estimated annual tax liability
 * - Advance tax schedule (how much per quarter, how much already paid)
 * - TDS deducted so far (from tax_entries)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const plan = await getPlanForUserId(userId)
    if (!planAtLeast(plan, 'enterprise')) {
      return NextResponse.json(
        { error: 'Income tax estimates and the advance tax schedule are an Enterprise plan feature.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    const bizId = parseInt(businessId, 10)
    const now = new Date()
    const currentFY = getFinancialYear(now)
    const currentQuarter = getQuarter(now)
    const fyDates = getFinancialYearDates(currentFY)

    // Total income so far this FY
    const incomeRow = await db.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE business_id = ? AND type = 'credit' AND status = 'completed'
         AND date >= ? AND date <= ?`,
      [bizId, fyDates.start, fyDates.end],
    )
    const incomeToDate = incomeRow?.total ?? 0

    // Total expenses so far this FY
    const expenseRow = await db.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE business_id = ? AND type = 'debit' AND status = 'completed'
         AND date >= ? AND date <= ?`,
      [bizId, fyDates.start, fyDates.end],
    )
    const expenseToDate = expenseRow?.total ?? 0

    // Net profit to date
    const netProfitToDate = incomeToDate - expenseToDate

    // Project annual income (simple extrapolation)
    const fyStartDate = new Date(fyDates.start)
    const daysSinceStart = Math.max(1, Math.ceil((now.getTime() - fyStartDate.getTime()) / 86400000))
    const daysInFY = 365
    const projectedAnnualIncome = Math.round(incomeToDate * (daysInFY / daysSinceStart))
    const projectedAnnualExpense = Math.round(expenseToDate * (daysInFY / daysSinceStart))
    const projectedAnnualProfit = projectedAnnualIncome - projectedAnnualExpense

    // Estimated annual tax
    const estimatedTax = estimateIncomeTax(Math.max(0, projectedAnnualProfit))

    // Advance tax schedule
    // Q1 = 15%, Q2 = 45%, Q3 = 75%, Q4 = 100% of estimated tax
    const advanceTaxSchedule = [
      { quarter: 'Q1', cumulative_pct: 15, due_by: `${fyDates.start.substring(0, 4)}-06-15`, amount: Math.round(estimatedTax * 0.15) },
      { quarter: 'Q2', cumulative_pct: 45, due_by: `${fyDates.start.substring(0, 4)}-09-15`, amount: Math.round(estimatedTax * 0.30) },
      { quarter: 'Q3', cumulative_pct: 75, due_by: `${fyDates.start.substring(0, 4)}-12-15`, amount: Math.round(estimatedTax * 0.30) },
      { quarter: 'Q4', cumulative_pct: 100, due_by: `${parseInt(fyDates.start.substring(0, 4), 10) + 1}-03-15`, amount: Math.round(estimatedTax * 0.25) },
    ]

    // TDS already deducted (from tax_entries)
    const tdsRow = await db.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM tax_entries
       WHERE user_id = ? AND business_id = ? AND financial_year = ? AND type = 'tds_deducted'`,
      [userId, bizId, currentFY],
    )
    const tdsDeducted = tdsRow?.total ?? 0

    // Advance tax already paid
    const advancePaidRow = await db.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM tax_entries
       WHERE user_id = ? AND business_id = ? AND financial_year = ? AND type = 'advance_tax' AND status = 'paid'`,
      [userId, bizId, currentFY],
    )
    const advanceTaxPaid = advancePaidRow?.total ?? 0

    // Remaining tax liability
    const remainingLiability = Math.max(0, estimatedTax - tdsDeducted - advanceTaxPaid)

    return NextResponse.json({
      financialYear: currentFY,
      currentQuarter,
      incomeToDate,
      expenseToDate,
      netProfitToDate,
      projectedAnnualIncome,
      projectedAnnualExpense,
      projectedAnnualProfit,
      estimatedAnnualTax: estimatedTax,
      tdsDeducted,
      advanceTaxPaid,
      remainingLiability,
      effectiveRate: projectedAnnualProfit > 0 ? round2((estimatedTax / projectedAnnualProfit) * 100) : 0,
      advanceTaxSchedule,
      slabs: NEW_REGIME_SLABS.map(s => ({
        ...s,
        max: s.max === Infinity ? null : s.max,
      })),
    })
  } catch (err) {
    console.error('Tax estimates error:', err)
    return NextResponse.json({ error: 'Failed to generate tax estimates' }, { status: 500 })
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
