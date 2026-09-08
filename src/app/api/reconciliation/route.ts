import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { autoMatchTransactions, persistReconciliation } from '@/lib/reconciliation'

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
 * GET /api/reconciliation
 * List reconciliation sessions for the authenticated user.
 * Query params: businessId, status, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    const conditions: string[] = ['rs.user_id = ?']
    const params: unknown[] = [userId]

    if (businessId) {
      conditions.push('rs.business_id = ?')
      params.push(parseInt(businessId))
    }

    if (status && ['in_progress', 'completed', 'cancelled'].includes(status)) {
      conditions.push('rs.status = ?')
      params.push(status)
    }

    const whereClause = conditions.join(' AND ')

    const total = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM reconciliation_sessions rs WHERE ${whereClause}`,
      params
    )

    const sessions = await db.all<Record<string, unknown>>(
      `SELECT rs.*,
              bc.bank_name, bc.masked_account_number,
              b.name AS business_name
       FROM reconciliation_sessions rs
       LEFT JOIN bank_connections bc ON bc.id = rs.bank_connection_id
       LEFT JOIN businesses b ON b.id = rs.business_id
       WHERE ${whereClause}
       ORDER BY rs.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return NextResponse.json({
      sessions,
      total: total?.count ?? 0,
      limit,
      offset,
    })
  } catch (err) {
    console.error('[reconciliation] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch reconciliation sessions' }, { status: 500 })
  }
}

/**
 * POST /api/reconciliation
 * Start a new reconciliation session.
 * Body: { bankConnectionId, businessId?, periodStart, periodEnd }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { bankConnectionId, businessId, periodStart, periodEnd } = body

    if (!bankConnectionId || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'bankConnectionId, periodStart, and periodEnd are required' },
        { status: 400 }
      )
    }

    // Validate bank connection belongs to user
    const conn = await db.get<{ id: number }>(
      'SELECT id FROM bank_connections WHERE id = ? AND user_id = ?',
      [bankConnectionId, userId]
    )
    if (!conn) {
      return NextResponse.json({ error: 'Bank connection not found' }, { status: 404 })
    }

    // Validate business belongs to user (if provided)
    if (businessId) {
      const biz = await db.get<{ id: number }>(
        'SELECT id FROM businesses WHERE id = ? AND user_id = ?',
        [businessId, userId]
      )
      if (!biz) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 })
      }
    }

    // Create session
    const result = await db.run(
      `INSERT INTO reconciliation_sessions
         (user_id, business_id, bank_connection_id, period_start, period_end, status)
       VALUES (?, ?, ?, ?, ?, 'in_progress')`,
      [userId, businessId || null, bankConnectionId, periodStart, periodEnd]
    )
    const sessionId = Number(result.lastInsertRowid)

    // Run auto-match engine
    const matchResult = await autoMatchTransactions(
      userId,
      businessId || null,
      bankConnectionId,
      periodStart,
      periodEnd
    )

    // Persist matches to DB
    await persistReconciliation(sessionId, matchResult)

    // Calculate discrepancy (total bank amount minus total matched manual amount)
    const bankTotal = [...matchResult.matched, ...matchResult.suggested, ...matchResult.unmatchedBank]
      .reduce((sum, item) => {
        const bt = 'bankTxn' in item ? item.bankTxn : item
        return sum + (bt.type === 'credit' ? bt.amount : -bt.amount)
      }, 0)

    const manualTotal = matchResult.matched
      .reduce((sum, m) => sum + (m.manualTxn.type === 'credit' ? m.manualTxn.amount : -m.manualTxn.amount), 0)

    const discrepancy = Math.abs(bankTotal - manualTotal)

    await db.run(
      `UPDATE reconciliation_sessions SET discrepancy_amount = ?, updated_at = datetime('now') WHERE id = ?`,
      [discrepancy, sessionId]
    )

    // Fetch the full session record to return
    const session = await db.get<Record<string, unknown>>(
      `SELECT rs.*, bc.bank_name, bc.masked_account_number, b.name AS business_name
       FROM reconciliation_sessions rs
       LEFT JOIN bank_connections bc ON bc.id = rs.bank_connection_id
       LEFT JOIN businesses b ON b.id = rs.business_id
       WHERE rs.id = ?`,
      [sessionId]
    )

    return NextResponse.json({
      session,
      summary: {
        totalBankTxns: matchResult.matched.length + matchResult.suggested.length + matchResult.unmatchedBank.length,
        autoMatched: matchResult.matched.length,
        suggested: matchResult.suggested.length,
        unmatchedBank: matchResult.unmatchedBank.length,
        unmatchedManual: matchResult.unmatchedManual.length,
        discrepancy,
      },
    })
  } catch (err) {
    console.error('[reconciliation] POST error:', err)
    return NextResponse.json({ error: 'Failed to start reconciliation' }, { status: 500 })
  }
}
