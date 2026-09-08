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
 * POST /api/receipts/[id]/match
 * Manually match a receipt to a specific transaction ID.
 * Body: { transaction_id: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const receiptId = parseInt(params.id, 10)
    if (isNaN(receiptId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const body = await request.json()
    const { transaction_id } = body

    if (!transaction_id) {
      return NextResponse.json({ error: 'transaction_id is required' }, { status: 400 })
    }

    const receipt = await db.get<{ id: number }>(
      'SELECT id FROM receipts WHERE id = ? AND user_id = ?',
      [receiptId, userId]
    )
    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })

    // Verify the transaction belongs to the user
    const tx = await db.get<{ id: number; amount: number; date: string }>(
      `SELECT t.id, t.amount, t.date FROM transactions t
       WHERE t.id = ? AND t.business_id IN (SELECT id FROM businesses WHERE user_id = ?)`,
      [transaction_id, userId]
    )
    if (!tx) {
      return NextResponse.json({ error: 'Transaction not found or not owned by you' }, { status: 400 })
    }

    // Check if another receipt is already matched to this transaction
    const existingMatch = await db.get<{ id: number }>(
      'SELECT id FROM receipts WHERE transaction_id = ? AND id != ? AND user_id = ?',
      [transaction_id, receiptId, userId]
    )
    if (existingMatch) {
      return NextResponse.json({
        error: 'This transaction is already linked to another receipt',
      }, { status: 409 })
    }

    await db.run(
      "UPDATE receipts SET transaction_id = ?, status = 'matched' WHERE id = ? AND user_id = ?",
      [transaction_id, receiptId, userId]
    )

    const updated = await db.get<Record<string, unknown>>(
      `SELECT r.*, t.amount as tx_amount, t.date as tx_date, t.note as tx_note
       FROM receipts r
       LEFT JOIN transactions t ON t.id = r.transaction_id
       WHERE r.id = ?`,
      [receiptId]
    )

    return NextResponse.json({ receipt: updated, matched: true })
  } catch (err) {
    console.error('Receipt match error:', err)
    return NextResponse.json({ error: 'Failed to match receipt' }, { status: 500 })
  }
}
