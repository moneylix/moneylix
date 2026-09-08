import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import fs from 'fs'
import path from 'path'

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
 * GET /api/receipts/[id]
 * Get a single receipt with its OCR data and linked transaction.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const receiptId = parseInt(params.id, 10)
    if (isNaN(receiptId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const receipt = await db.get<Record<string, unknown>>(
      `SELECT r.*, t.amount as tx_amount, t.date as tx_date, t.note as tx_note, t.type as tx_type,
              c.name as tx_category_name
       FROM receipts r
       LEFT JOIN transactions t ON t.id = r.transaction_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE r.id = ? AND r.user_id = ?`,
      [receiptId, userId]
    )

    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })

    // If matched, also return nearby transactions for potential re-matching
    let suggestedTransactions: Record<string, unknown>[] = []
    if (receipt.ocr_amount) {
      const tolerance = (receipt.ocr_amount as number) * 0.15
      const minAmt = (receipt.ocr_amount as number) - tolerance
      const maxAmt = (receipt.ocr_amount as number) + tolerance

      suggestedTransactions = await db.all<Record<string, unknown>>(
        `SELECT t.id, t.amount, t.date, t.note, t.type, c.name as category_name
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.user_id = ? AND t.type = 'debit' AND t.amount BETWEEN ? AND ?
         ORDER BY ABS(t.amount - ?) ASC
         LIMIT 10`,
        [userId, minAmt, maxAmt, receipt.ocr_amount]
      )
    }

    return NextResponse.json({ receipt, suggestedTransactions })
  } catch (err) {
    console.error('Receipt GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch receipt' }, { status: 500 })
  }
}

/**
 * PUT /api/receipts/[id]
 * Manually link a receipt to a transaction.
 * Body: { transaction_id }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const receiptId = parseInt(params.id, 10)
    if (isNaN(receiptId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const existing = await db.get<{ id: number }>(
      'SELECT id FROM receipts WHERE id = ? AND user_id = ?',
      [receiptId, userId]
    )
    if (!existing) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })

    const body = await request.json()
    const { transaction_id } = body

    if (transaction_id != null) {
      // Verify that the transaction belongs to the user
      const tx = await db.get<{ id: number }>(
        'SELECT id FROM transactions WHERE id = ? AND business_id IN (SELECT id FROM businesses WHERE user_id = ?)',
        [transaction_id, userId]
      )
      if (!tx) return NextResponse.json({ error: 'Transaction not found or not owned by you' }, { status: 400 })

      await db.run(
        "UPDATE receipts SET transaction_id = ?, status = 'matched' WHERE id = ? AND user_id = ?",
        [transaction_id, receiptId, userId]
      )
    } else {
      await db.run(
        "UPDATE receipts SET transaction_id = NULL, status = 'unmatched' WHERE id = ? AND user_id = ?",
        [receiptId, userId]
      )
    }

    const updated = await db.get<Record<string, unknown>>(
      'SELECT * FROM receipts WHERE id = ?',
      [receiptId]
    )

    return NextResponse.json({ receipt: updated })
  } catch (err) {
    console.error('Receipt PUT error:', err)
    return NextResponse.json({ error: 'Failed to update receipt' }, { status: 500 })
  }
}

/**
 * DELETE /api/receipts/[id]
 * Delete a receipt and its file.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const receiptId = parseInt(params.id, 10)
    if (isNaN(receiptId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const receipt = await db.get<{ id: number; file_path: string }>(
      'SELECT id, file_path FROM receipts WHERE id = ? AND user_id = ?',
      [receiptId, userId]
    )
    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })

    // Delete the file from disk
    try {
      const fullPath = path.join(process.cwd(), receipt.file_path)
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
      }
    } catch (fileErr) {
      console.warn('Failed to delete receipt file:', fileErr)
    }

    await db.run('DELETE FROM receipts WHERE id = ? AND user_id = ?', [receiptId, userId])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Receipt DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete receipt' }, { status: 500 })
  }
}
