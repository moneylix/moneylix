import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'

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
 * POST /api/payroll/entries/:id/pay
 * Mark a payroll entry as paid.
 *   1. Creates a debit transaction automatically.
 *   2. Links the transaction to the payroll entry.
 *   3. Updates the entry status to 'paid'.
 *
 * Optional body: { method?, date?, category_id? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const entryId = parseInt(params.id, 10)
    if (!entryId) return NextResponse.json({ error: 'Invalid entry id' }, { status: 400 })

    const entry = await db.get<{
      id: number
      user_id: number
      business_id: number
      staff_member_id: number
      net_amount: number
      status: string
      period: string
    }>(
      'SELECT id, user_id, business_id, staff_member_id, net_amount, status, period FROM payroll_entries WHERE id = ? AND user_id = ?',
      [entryId, userId],
    )
    if (!entry) return NextResponse.json({ error: 'Payroll entry not found' }, { status: 404 })

    if (entry.status === 'paid') {
      return NextResponse.json({ error: 'This entry is already paid' }, { status: 400 })
    }

    if (entry.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot pay a cancelled entry' }, { status: 400 })
    }

    // Get staff member name for the transaction note
    const staff = await db.get<{ name: string; role_title: string | null }>(
      'SELECT name, role_title FROM staff_members WHERE id = ?',
      [entry.staff_member_id],
    )

    let body: Record<string, unknown> = {}
    try { body = await request.json() } catch { /* no body is fine */ }

    const method = (body.method as string) || 'bank'
    const date = (body.date as string) || new Date().toISOString().split('T')[0]
    const categoryId = body.category_id ? parseInt(String(body.category_id), 10) : null

    // Find the default salary/payroll category, or fall back to first debit category
    let txCategoryId = categoryId
    if (!txCategoryId) {
      const salCat = await db.get<{ id: number }>(
        "SELECT id FROM categories WHERE (name LIKE '%salary%' OR name LIKE '%payroll%') AND (type = 'debit' OR type = 'both') LIMIT 1",
        [],
      )
      if (salCat) {
        txCategoryId = salCat.id
      } else {
        const fallback = await db.get<{ id: number }>(
          "SELECT id FROM categories WHERE type = 'debit' OR type = 'both' LIMIT 1",
          [],
        )
        txCategoryId = fallback?.id ?? 1
      }
    }

    const txNote = `Salary: ${staff?.name ?? 'Staff'}${staff?.role_title ? ' (' + staff.role_title + ')' : ''} — ${entry.period}`

    // Create the debit transaction
    const txResult = await db.insert(
      `INSERT INTO transactions (user_id, type, amount, category_id, business_id, currency, date, note, method, status)
       VALUES (?, 'debit', ?, ?, ?, 'INR', ?, ?, ?, 'completed')`,
      [userId, entry.net_amount, txCategoryId, entry.business_id, date, txNote, method],
    )

    const transactionId = txResult.lastInsertRowid

    // Update payroll entry
    await db.run(
      `UPDATE payroll_entries
       SET status = 'paid', paid_date = ?, transaction_id = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [date, transactionId, entryId],
    )

    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      paid_date: date,
    })
  } catch (err) {
    console.error('Payroll pay POST error:', err)
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
  }
}
