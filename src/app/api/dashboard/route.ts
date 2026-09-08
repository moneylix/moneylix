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

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const businessIdParam = searchParams.get('businessId')

    if (!businessIdParam) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }
    const businessId = parseInt(businessIdParam, 10)

    const biz = await db.get('SELECT id FROM businesses WHERE id = ? AND user_id = ?', [businessId, userId])
    if (!biz) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const today = new Date().toISOString().split('T')[0]
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const weekStartStr = weekStart.toISOString().split('T')[0]
    const monthStart = new Date()
    monthStart.setDate(1)
    const monthStartStr = monthStart.toISOString().split('T')[0]
    const prevMonthStart = new Date(monthStart)
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1)
    const prevMonthStartStr = prevMonthStart.toISOString().split('T')[0]

    const getAgg = async (statusCondition: string, dateCondition: string, dateParams: string[] = []) => {
      const sql = `SELECT type, SUM(amount) as total FROM transactions WHERE business_id = ? ${statusCondition} ${dateCondition} GROUP BY type`
      const params: any[] = [businessId, ...dateParams]
      const rows = await db.all<{type: string, total: number}>(sql, params)
      let credit = 0; let debit = 0;
      for (const r of rows) {
        if (r.type === 'credit') credit = r.total || 0;
        if (r.type === 'debit') debit = r.total || 0;
      }
      return { credit, debit }
    }

    const completed = await getAgg("AND status = 'completed'", "")
    const totalBalance = completed.credit - completed.debit

    const pending = await getAgg("AND status = 'pending'", "")
    const totalPending = pending.credit - pending.debit

    const todayStats = await getAgg("AND status != 'pending'", "AND date = ?", [today])
    const weekStats = await getAgg("AND status != 'pending'", "AND date >= ?", [weekStartStr])
    const monthStats = await getAgg("AND status != 'pending'", "AND date >= ?", [monthStartStr])
    const prevMonthStats = await getAgg("AND status != 'pending'", "AND date >= ? AND date < ?", [prevMonthStartStr, monthStartStr])

    const savingsRate = monthStats.credit > 0 ? ((monthStats.credit - monthStats.debit) / monthStats.credit) * 100 : 0
    const prevSavingsRate = prevMonthStats.credit > 0 ? ((prevMonthStats.credit - prevMonthStats.debit) / prevMonthStats.credit) * 100 : null

    const pctChange = (current: number, previous: number): number | null =>
      previous > 0 ? ((current - previous) / previous) * 100 : null

    const monthNet = monthStats.credit - monthStats.debit
    const balanceAtMonthStart = totalBalance - monthNet

    const summary = {
      totalBalance,
      totalPending,
      todayCredit: todayStats.credit,
      todayDebit: todayStats.debit,
      todayNet: todayStats.credit - todayStats.debit,
      weekCredit: weekStats.credit,
      weekDebit: weekStats.debit,
      weekNet: weekStats.credit - weekStats.debit,
      monthCredit: monthStats.credit,
      monthDebit: monthStats.debit,
      monthNet,
      monthIncomeChangePct: pctChange(monthStats.credit, prevMonthStats.credit),
      monthExpenseChangePct: pctChange(monthStats.debit, prevMonthStats.debit),
      savingsRateChangePct: prevSavingsRate !== null ? savingsRate - prevSavingsRate : null,
      totalBalanceChangePct: pctChange(totalBalance, balanceAtMonthStart),
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('Dashboard summary error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
