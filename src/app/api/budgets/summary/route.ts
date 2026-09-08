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
 * GET /api/budgets/summary
 * Budget vs actual summary for a given month + business.
 * Returns per-category breakdown and overall totals.
 * Query: businessId (required), month (YYYY-MM, defaults to current)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    const bizId = parseInt(businessId, 10)

    // Verify ownership
    const biz = await db.get<{ id: number }>(
      'SELECT id FROM businesses WHERE id = ? AND user_id = ?',
      [bizId, userId]
    )
    if (!biz) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Get all debit categories with actual spend this month
    const actualSpend = await db.all<{
      category_id: number
      category_name: string
      category_icon: string
      category_color: string
      actual: number
    }>(
      `SELECT
         c.id as category_id,
         c.name as category_name,
         c.icon as category_icon,
         c.color as category_color,
         COALESCE(SUM(t.amount), 0) as actual
       FROM categories c
       LEFT JOIN transactions t ON t.category_id = c.id
         AND t.business_id = ?
         AND t.type = 'debit'
         AND t.status = 'completed'
         AND strftime('%Y-%m', t.date) = ?
       WHERE c.type IN ('debit', 'both')
          OR c.id IN (
            SELECT DISTINCT category_id FROM transactions
            WHERE business_id = ? AND type = 'debit' AND status = 'completed' AND strftime('%Y-%m', date) = ?
          )
       GROUP BY c.id
       ORDER BY actual DESC`,
      [bizId, month, bizId, month]
    )

    // Get budgets for this month
    const budgets = await db.all<{
      category_id: number | null
      amount: number
    }>(
      'SELECT category_id, amount FROM budgets WHERE user_id = ? AND business_id = ? AND month = ?',
      [userId, bizId, month]
    )

    const budgetMap = new Map<number | null, number>()
    for (const b of budgets) {
      budgetMap.set(b.category_id, b.amount)
    }

    // Build per-category breakdown
    const categories = actualSpend.map(cat => {
      const budgeted = budgetMap.get(cat.category_id) ?? 0
      const remaining = budgeted - cat.actual
      const percentUsed = budgeted > 0 ? (cat.actual / budgeted) * 100 : 0

      return {
        category_id: cat.category_id,
        category_name: cat.category_name,
        category_icon: cat.category_icon,
        category_color: cat.category_color,
        budgeted,
        actual: cat.actual,
        remaining,
        percent_used: Math.round(percentUsed * 10) / 10,
        has_budget: budgeted > 0,
      }
    })

    // Overall totals
    const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0)
    const totalActual = actualSpend.reduce((sum, c) => sum + c.actual, 0)
    const overallBudget = budgetMap.get(null) ?? 0

    // Count categories over budget
    const overBudgetCount = categories.filter(c => c.has_budget && c.percent_used > 100).length
    const onTrackCount = categories.filter(c => c.has_budget && c.percent_used <= 100).length
    const noBudgetCount = categories.filter(c => !c.has_budget && c.actual > 0).length

    return NextResponse.json({
      month,
      businessId: bizId,
      categories,
      overall: {
        total_budgeted: totalBudgeted,
        overall_budget: overallBudget,
        total_actual: totalActual,
        total_remaining: (overallBudget > 0 ? overallBudget : totalBudgeted) - totalActual,
        percent_used: overallBudget > 0
          ? Math.round(((totalActual / overallBudget) * 100) * 10) / 10
          : totalBudgeted > 0
            ? Math.round(((totalActual / totalBudgeted) * 100) * 10) / 10
            : 0,
      },
      stats: {
        over_budget: overBudgetCount,
        on_track: onTrackCount,
        no_budget: noBudgetCount,
        total_categories_with_spend: actualSpend.filter(c => c.actual > 0).length,
      },
    })
  } catch (err) {
    console.error('Budget summary error:', err)
    return NextResponse.json({ error: 'Failed to fetch budget summary' }, { status: 500 })
  }
}
