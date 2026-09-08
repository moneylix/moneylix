import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
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

    const grandTotals = await db.get<{ totalIncome: number; totalExpense: number; totalPending: number }>(`
      SELECT
        COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0) as totalIncome,
        COALESCE(SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END), 0) as totalExpense,
        COALESCE(SUM(CASE WHEN t.status = 'pending' AND t.type = 'credit' THEN t.amount WHEN t.status = 'pending' AND t.type = 'debit' THEN -t.amount ELSE 0 END), 0) as totalPending
      FROM transactions t
      JOIN businesses b ON b.id = t.business_id
      WHERE b.user_id = ?
    `, [userId])

    const totalIncome = grandTotals?.totalIncome ?? 0
    const totalExpense = grandTotals?.totalExpense ?? 0
    const totalPending = grandTotals?.totalPending ?? 0
    const netProfit = totalIncome - totalExpense

    const businessBreakdown = await db.all(`
      SELECT
        b.id,
        b.name,
        COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END), 0) as expense,
        COALESCE(SUM(CASE WHEN t.status = 'pending' AND t.type = 'credit' THEN t.amount WHEN t.status = 'pending' AND t.type = 'debit' THEN -t.amount ELSE 0 END), 0) as pending
      FROM businesses b
      LEFT JOIN transactions t ON b.id = t.business_id
      WHERE b.user_id = ?
      GROUP BY b.id, b.name
      ORDER BY b.name ASC
    `, [userId])

    const formattedBreakdown = businessBreakdown.map((b: any) => ({
      id: b.id,
      name: b.name,
      income: b.income,
      expense: b.expense,
      pending: b.pending,
      netProfit: b.income - b.expense
    }))

    return NextResponse.json({
      grandTotal: { income: totalIncome, expense: totalExpense, pending: totalPending, netProfit },
      breakdown: formattedBreakdown
    })
  } catch (error) {
    console.error('Overall summary error:', error)
    return NextResponse.json({ error: 'Failed to fetch overall data' }, { status: 500 })
  }
}
