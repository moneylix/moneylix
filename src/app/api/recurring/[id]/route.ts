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
 * PATCH /api/recurring/[id]
 * Update a recurring transaction (pause, resume, edit amount/note/frequency).
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = parseInt(params.id)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    // Verify ownership
    const existing = await db.get<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM recurring_transactions WHERE id = ? AND user_id = ?',
      [id, userId]
    )
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json()
    const updates: string[] = []
    const params_arr: unknown[] = []

    // Allowed fields to update
    const allowedFields: Record<string, string> = {
      amount: 'amount',
      note: 'note',
      method: 'method',
      tags: 'tags',
      category_id: 'category_id',
      frequency: 'frequency',
      interval_value: 'interval_value',
      day_of_week: 'day_of_week',
      day_of_month: 'day_of_month',
      end_date: 'end_date',
      status: 'status',
    }

    for (const [key, col] of Object.entries(allowedFields)) {
      if (body[key] !== undefined) {
        // Validate status
        if (key === 'status' && !['active', 'paused', 'completed'].includes(body[key])) {
          return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }
        if (key === 'frequency' && !['daily', 'weekly', 'monthly', 'yearly'].includes(body[key])) {
          return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
        }
        updates.push(`${col} = ?`)
        params_arr.push(body[key])
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }

    updates.push("updated_at = datetime('now')")
    params_arr.push(id)

    await db.run(
      `UPDATE recurring_transactions SET ${updates.join(', ')} WHERE id = ?`,
      params_arr
    )

    const updated = await db.get<Record<string, unknown>>(
      'SELECT * FROM recurring_transactions WHERE id = ?',
      [id]
    )

    return NextResponse.json({ success: true, recurring: updated })
  } catch (err) {
    console.error('Recurring PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

/**
 * DELETE /api/recurring/[id]
 * Delete a recurring transaction rule.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = parseInt(params.id)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const existing = await db.get<{ id: number }>(
      'SELECT id FROM recurring_transactions WHERE id = ? AND user_id = ?',
      [id, userId]
    )
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.run('DELETE FROM recurring_transactions WHERE id = ?', [id])

    return NextResponse.json({ success: true, message: 'Recurring transaction deleted' })
  } catch (err) {
    console.error('Recurring DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
