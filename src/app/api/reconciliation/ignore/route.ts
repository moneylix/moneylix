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
 * POST /api/reconciliation/ignore
 * Mark a bank transaction as ignored within a reconciliation session
 * (i.e. the user has reviewed it and decided no match is needed).
 * Body: { sessionId, bankTransactionId, notes? }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { sessionId, bankTransactionId, notes } = body

    if (!sessionId || !bankTransactionId) {
      return NextResponse.json(
        { error: 'sessionId and bankTransactionId are required' },
        { status: 400 }
      )
    }

    // Verify session belongs to user and is in progress
    const session = await db.get<{ id: number; status: string }>(
      'SELECT id, status FROM reconciliation_sessions WHERE id = ? AND user_id = ?',
      [sessionId, userId]
    )
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (session.status !== 'in_progress') {
      return NextResponse.json({ error: 'Session is not in progress' }, { status: 400 })
    }

    // Verify bank transaction belongs to user
    const bankTxn = await db.get<{ id: number }>(
      'SELECT id FROM bank_transactions WHERE id = ? AND user_id = ?',
      [bankTransactionId, userId]
    )
    if (!bankTxn) {
      return NextResponse.json({ error: 'Bank transaction not found' }, { status: 404 })
    }

    // Check for existing match record in this session
    const existing = await db.get<{ id: number }>(
      'SELECT id FROM reconciliation_matches WHERE session_id = ? AND bank_transaction_id = ?',
      [sessionId, bankTransactionId]
    )

    if (existing) {
      await db.run(
        `UPDATE reconciliation_matches
         SET manual_transaction_id = NULL, status = 'ignored', matched_by = 'user',
             notes = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [notes || 'Ignored by user', existing.id]
      )
    } else {
      await db.run(
        `INSERT INTO reconciliation_matches
           (session_id, bank_transaction_id, manual_transaction_id, match_type, confidence, status, matched_by, notes)
         VALUES (?, ?, NULL, 'manual', 0, 'ignored', 'user', ?)`,
        [sessionId, bankTransactionId, notes || 'Ignored by user']
      )
    }

    // Update session counts
    const counts = await db.get<{ matched: number; unmatched: number }>(
      `SELECT
         SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) AS matched,
         SUM(CASE WHEN status IN ('unmatched', 'disputed') THEN 1 ELSE 0 END) AS unmatched
       FROM reconciliation_matches WHERE session_id = ?`,
      [sessionId]
    )
    await db.run(
      `UPDATE reconciliation_sessions
       SET matched_count = ?, unmatched_count = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [counts?.matched ?? 0, counts?.unmatched ?? 0, sessionId]
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[reconciliation/ignore] POST error:', err)
    return NextResponse.json({ error: 'Failed to ignore transaction' }, { status: 500 })
  }
}
