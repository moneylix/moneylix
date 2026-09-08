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
 * GET /api/reconciliation/[id]
 * Get reconciliation session details with all matches.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sessionId = parseInt(params.id)
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
    }

    // Fetch session
    const session = await db.get<Record<string, unknown>>(
      `SELECT rs.*, bc.bank_name, bc.masked_account_number, b.name AS business_name
       FROM reconciliation_sessions rs
       LEFT JOIN bank_connections bc ON bc.id = rs.bank_connection_id
       LEFT JOIN businesses b ON b.id = rs.business_id
       WHERE rs.id = ? AND rs.user_id = ?`,
      [sessionId, userId]
    )

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Fetch all matches for this session with full transaction details
    const matches = await db.all<Record<string, unknown>>(
      `SELECT rm.*,
              bt.type AS bank_type, bt.amount AS bank_amount, bt.date AS bank_date,
              bt.narration AS bank_narration, bt.reference AS bank_reference,
              bt.currency AS bank_currency,
              mt.type AS manual_type, mt.amount AS manual_amount, mt.date AS manual_date,
              mt.note AS manual_note, mt.method AS manual_method,
              mt.currency AS manual_currency,
              c.name AS manual_category_name, c.color AS manual_category_color
       FROM reconciliation_matches rm
       LEFT JOIN bank_transactions bt ON bt.id = rm.bank_transaction_id
       LEFT JOIN transactions mt ON mt.id = rm.manual_transaction_id
       LEFT JOIN categories c ON c.id = mt.category_id
       WHERE rm.session_id = ?
       ORDER BY
         CASE rm.status
           WHEN 'unmatched' THEN 0
           WHEN 'matched' THEN 1
           WHEN 'ignored' THEN 2
           WHEN 'disputed' THEN 3
         END,
         bt.date DESC`,
      [sessionId]
    )

    // Group matches by status for summary
    const grouped = {
      matched: matches.filter((m: any) => m.status === 'matched'),
      unmatched: matches.filter((m: any) => m.status === 'unmatched'),
      ignored: matches.filter((m: any) => m.status === 'ignored'),
      disputed: matches.filter((m: any) => m.status === 'disputed'),
    }

    // Get the list of manual transactions that were NOT matched to any bank txn
    // (could be used for manual matching dropdown)
    const matchedManualIds = matches
      .filter((m: any) => m.manual_transaction_id && m.status === 'matched')
      .map((m: any) => m.manual_transaction_id)

    const periodStart = session.period_start as string
    const periodEnd = session.period_end as string

    // Buffer ±2 days for edge cases
    const bufStart = new Date(periodStart + 'T00:00:00')
    bufStart.setDate(bufStart.getDate() - 2)
    const bufEnd = new Date(periodEnd + 'T00:00:00')
    bufEnd.setDate(bufEnd.getDate() + 2)

    const businessFilter = session.business_id ? 'AND t.business_id = ?' : ''
    const businessParams: unknown[] = session.business_id ? [session.business_id] : []

    const availableManual = await db.all<Record<string, unknown>>(
      `SELECT t.id, t.type, t.amount, t.date, t.note, t.method, t.currency,
              c.name AS category_name, c.color AS category_color
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.business_id IN (SELECT id FROM businesses WHERE user_id = ?)
         AND t.date >= ? AND t.date <= ?
         ${businessFilter}
       ORDER BY t.date DESC`,
      [userId, bufStart.toISOString().slice(0, 10), bufEnd.toISOString().slice(0, 10), ...businessParams]
    )

    // Filter out already-matched ones
    const matchedIdSet = new Set(matchedManualIds)
    const unmatchedManual = availableManual.filter((mt: any) => !matchedIdSet.has(mt.id))

    return NextResponse.json({
      session,
      matches,
      grouped,
      unmatchedManual,
    })
  } catch (err) {
    console.error('[reconciliation/[id]] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch session details' }, { status: 500 })
  }
}

/**
 * PUT /api/reconciliation/[id]
 * Update session status (complete or cancel).
 * Body: { status: 'completed' | 'cancelled' }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sessionId = parseInt(params.id)
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
    }

    const body = await request.json()
    const { status } = body

    if (!status || !['completed', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Status must be completed or cancelled' }, { status: 400 })
    }

    // Verify ownership
    const session = await db.get<{ id: number }>(
      'SELECT id FROM reconciliation_sessions WHERE id = ? AND user_id = ?',
      [sessionId, userId]
    )
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Recalculate counts before completing
    if (status === 'completed') {
      const counts = await db.get<{ matched: number; unmatched: number; total: number }>(
        `SELECT
           SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) AS matched,
           SUM(CASE WHEN status IN ('unmatched', 'disputed') THEN 1 ELSE 0 END) AS unmatched,
           COUNT(*) AS total
         FROM reconciliation_matches WHERE session_id = ?`,
        [sessionId]
      )
      await db.run(
        `UPDATE reconciliation_sessions
         SET status = ?, matched_count = ?, unmatched_count = ?, total_bank_txns = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [status, counts?.matched ?? 0, counts?.unmatched ?? 0, counts?.total ?? 0, sessionId]
      )
    } else {
      await db.run(
        `UPDATE reconciliation_sessions SET status = ?, updated_at = datetime('now') WHERE id = ?`,
        [status, sessionId]
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[reconciliation/[id]] PUT error:', err)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}
