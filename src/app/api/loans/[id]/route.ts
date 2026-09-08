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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const loanId = parseInt(params.id)

    const loan = await db.get<Record<string, unknown>>(
      `SELECT l.*, b.name as business_name
       FROM loans l
       LEFT JOIN businesses b ON b.id = l.business_id
       WHERE l.id = ? AND l.user_id = ?`,
      [loanId, userId]
    )

    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })

    const payments = await db.all<Record<string, unknown>>(
      `SELECT ep.*, t.note as transaction_note
       FROM emi_payments ep
       LEFT JOIN transactions t ON t.id = ep.transaction_id
       WHERE ep.loan_id = ?
       ORDER BY ep.emi_number ASC`,
      [loanId]
    )

    return NextResponse.json({ loan, payments })
  } catch (err) {
    console.error('Loan GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch loan' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const loanId = parseInt(params.id)
    const body = await request.json()

    const existing = await db.get<{ id: number }>(
      'SELECT id FROM loans WHERE id = ? AND user_id = ?',
      [loanId, userId]
    )
    if (!existing) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })

    const {
      lender_name,
      loan_type,
      status,
      notes,
      next_emi_date,
    } = body

    const updates: string[] = []
    const values: unknown[] = []

    if (lender_name !== undefined) { updates.push('lender_name = ?'); values.push(lender_name) }
    if (loan_type !== undefined) { updates.push('loan_type = ?'); values.push(loan_type) }
    if (status !== undefined) { updates.push('status = ?'); values.push(status) }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes) }
    if (next_emi_date !== undefined) { updates.push('next_emi_date = ?'); values.push(next_emi_date) }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push("updated_at = datetime('now')")
    values.push(loanId, userId)

    await db.run(
      `UPDATE loans SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Loan PUT error:', err)
    return NextResponse.json({ error: 'Failed to update loan' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const loanId = parseInt(params.id)

    const existing = await db.get<{ id: number }>(
      'SELECT id FROM loans WHERE id = ? AND user_id = ?',
      [loanId, userId]
    )
    if (!existing) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })

    await db.run('DELETE FROM emi_payments WHERE loan_id = ?', [loanId])
    await db.run('DELETE FROM loans WHERE id = ? AND user_id = ?', [loanId, userId])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Loan DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete loan' }, { status: 500 })
  }
}
