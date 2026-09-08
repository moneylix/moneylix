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
 * PUT /api/budgets/[id]
 * Update a specific budget amount.
 * Body: { amount }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const budgetId = parseInt(params.id, 10)
    if (isNaN(budgetId)) {
      return NextResponse.json({ error: 'Invalid budget id' }, { status: 400 })
    }

    const budget = await db.get<{ user_id: number }>('SELECT user_id FROM budgets WHERE id = ?', [budgetId])
    if (!budget || budget.user_id !== userId) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    }

    const body = await request.json()
    const { amount } = body

    if (amount === undefined || amount === null || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    await db.run(
      "UPDATE budgets SET amount = ?, updated_at = datetime('now') WHERE id = ?",
      [amount, budgetId]
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Budget PUT error:', err)
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 })
  }
}

/**
 * DELETE /api/budgets/[id]
 * Delete a specific budget.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const budgetId = parseInt(params.id, 10)
    if (isNaN(budgetId)) {
      return NextResponse.json({ error: 'Invalid budget id' }, { status: 400 })
    }

    const budget = await db.get<{ user_id: number }>('SELECT user_id FROM budgets WHERE id = ?', [budgetId])
    if (!budget || budget.user_id !== userId) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    }

    await db.run('DELETE FROM budgets WHERE id = ?', [budgetId])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Budget DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 })
  }
}
