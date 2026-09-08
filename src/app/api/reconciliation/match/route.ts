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
 * POST /api/reconciliation/match
 * Manually match a bank transaction to a manual transaction.
 * Body: { sessionId, bankTransactionId, manualTransactionId, notes? }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { sessionId, bankTransactionId, manualTransactionId, notes } = body

    if (!sessionId || !bankTransactionId || !manualTransactionId) {
      return NextResponse.json(
        { error: 'sessionId, bankTransactionId, and manualTransactionId are required' },
        { status: 400 }
      )
    }

    // Verify session belongs to user
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

    // Verify manual transaction belongs to user
    const manualTxn = await db.get<{ id: number }>(
      `SELECT t.id FROM transactions t
       JOIN businesses b ON b.id = t.business_id
       WHERE t.id = ? AND b.user_id = ?`,
      [manualTransactionId, userId]
    )
    if (!manualTxn) {
      return NextResponse.json({ error: 'Manual transaction not found' }, { status: 404 })
    }

    // Check if there's already a match record for this bank txn in this session
    const existing = await db.get<{ id: number }>(
      'SELECT id FROM reconciliation_matches WHERE session_id = ? AND bank_transaction_id = ?',
      [sessionId, bankTransactionId]
    )

    if (existing) {
      // Update the existing match record
      await db.run(
        `UPDATE reconciliation_matches
         SET manual_transaction_id = ?, match_type = 'manual', confidence = 100,
             status = 'matched', matched_by = 'user', notes = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [manualTransactionId, notes || null, existing.id]
      )
    } else {
      // Create a new match record
      await db.run(
        `INSERT INTO reconciliation_matches
           (session_id, bank_transaction_id, manual_transaction_id, match_type, confidence, status, matched_by, notes)
         VALUES (?, ?, ?, 'manual', 100, 'matched', 'user', ?)`,
        [sessionId, bankTransactionId, manualTransactionId, notes || null]
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
    console.error('[reconciliation/match] POST error:', err)
    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 })
  }
}

/**
 * DELETE /api/reconciliation/match
 * Unmatch a bank transaction from a manual transaction.
 * Body: { sessionId, bankTransactionId }
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { sessionId, bankTransactionId } = body

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

    // Reset the match back to unmatched
    await db.run(
      `UPDATE reconciliation_matches
       SET manual_transaction_id = NULL, match_type = 'auto', confidence = 0,
           status = 'unmatched', matched_by = 'system', notes = NULL, updated_at = datetime('now')
       WHERE session_id = ? AND bank_transaction_id = ?`,
      [sessionId, bankTransactionId]
    )

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
    console.error('[reconciliation/match] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to unmatch' }, { status: 500 })
  }
}
