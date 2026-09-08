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
 * GET /api/budgets
 * List budgets for user + business + month with actual spend.
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

    // Verify business ownership
    const biz = await db.get<{ id: number }>(
      'SELECT id FROM businesses WHERE id = ? AND user_id = ?',
      [parseInt(businessId, 10), userId]
    )
    if (!biz) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Fetch budgets with category info
    const budgets = await db.all<{
      id: number
      user_id: number
      business_id: number
      category_id: number | null
      month: string
      amount: number
      created_at: string
      updated_at: string
      category_name: string | null
      category_icon: string | null
      category_color: string | null
    }>(
      `SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM budgets b
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE b.user_id = ? AND b.business_id = ? AND b.month = ?
       ORDER BY b.category_id IS NULL DESC, c.name ASC`,
      [userId, parseInt(businessId, 10), month]
    )

    // Calculate actual spend for each budget
    const enriched = await Promise.all(
      budgets.map(async (budget) => {
        let actualSpend = 0

        if (budget.category_id) {
          const row = await db.get<{ total: number }>(
            `SELECT COALESCE(SUM(amount), 0) as total
             FROM transactions
             WHERE business_id = ? AND type = 'debit' AND status = 'completed'
               AND category_id = ?
               AND strftime('%Y-%m', date) = ?`,
            [budget.business_id, budget.category_id, month]
          )
          actualSpend = row?.total ?? 0
        } else {
          // Overall budget
          const row = await db.get<{ total: number }>(
            `SELECT COALESCE(SUM(amount), 0) as total
             FROM transactions
             WHERE business_id = ? AND type = 'debit' AND status = 'completed'
               AND strftime('%Y-%m', date) = ?`,
            [budget.business_id, month]
          )
          actualSpend = row?.total ?? 0
        }

        const remaining = budget.amount - actualSpend
        const percentUsed = budget.amount > 0 ? (actualSpend / budget.amount) * 100 : 0

        return {
          ...budget,
          actual_spend: actualSpend,
          remaining,
          percent_used: Math.round(percentUsed * 10) / 10,
        }
      })
    )

    return NextResponse.json({ budgets: enriched })
  } catch (err) {
    console.error('Budgets GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 })
  }
}

/**
 * POST /api/budgets
 * Create or update a budget (upsert on unique constraint).
 * Body: { businessId, categoryId (null for overall), month (YYYY-MM), amount }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { businessId, categoryId, month, amount } = body

    if (!businessId || !month || amount === undefined || amount === null) {
      return NextResponse.json({ error: 'businessId, month, and amount are required' }, { status: 400 })
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Month must be in YYYY-MM format' }, { status: 400 })
    }

    // Verify business ownership
    const biz = await db.get<{ id: number }>(
      'SELECT id FROM businesses WHERE id = ? AND user_id = ?',
      [businessId, userId]
    )
    if (!biz) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Validate category exists if provided
    if (categoryId) {
      const cat = await db.get<{ id: number }>('SELECT id FROM categories WHERE id = ?', [categoryId])
      if (!cat) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 })
      }
    }

    // Upsert
    const result = await db.run(
      `INSERT INTO budgets (user_id, business_id, category_id, month, amount, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, business_id, category_id, month) DO UPDATE SET
         amount = excluded.amount,
         updated_at = datetime('now')`,
      [userId, businessId, categoryId ?? null, month, amount]
    )

    return NextResponse.json({
      success: true,
      id: Number(result.lastInsertRowid),
    })
  } catch (err) {
    console.error('Budgets POST error:', err)
    return NextResponse.json({ error: 'Failed to create/update budget' }, { status: 500 })
  }
}

/**
 * DELETE /api/budgets
 * Delete a budget by id.
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Budget id is required' }, { status: 400 })
    }

    const budget = await db.get<{ user_id: number }>('SELECT user_id FROM budgets WHERE id = ?', [id])
    if (!budget || budget.user_id !== userId) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    }

    await db.run('DELETE FROM budgets WHERE id = ?', [id])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Budgets DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 })
  }
}
