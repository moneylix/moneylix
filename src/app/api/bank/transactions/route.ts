import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'

/**
 * GET /api/bank/transactions
 * 
 * Returns the user's bank-synced transactions.
 * Supports pagination, filtering by type, and search.
 * 
 * Query params:
 *   limit (default 100)
 *   offset (default 0)
 *   type ('credit' | 'debit' | undefined = all)
 *   search (narration search)
 *   categorised ('true' | 'false' | undefined = all)
 *   connectionId (filter by specific bank connection)
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session = await dbQuery.get<{ user_id: number }>(
      "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
      [token]
    )
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user_id
    const { searchParams } = new URL(request.url)

    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type') // 'credit' | 'debit' | null
    const search = searchParams.get('search')
    const categorised = searchParams.get('categorised') // 'true' | 'false' | null
    const connectionId = searchParams.get('connectionId')

    // Build WHERE clauses
    const conditions: string[] = ['bt.user_id = ?']
    const params: unknown[] = [userId]

    // Exclude ignored transactions by default
    conditions.push('bt.ignored = 0')

    if (type && (type === 'credit' || type === 'debit')) {
      conditions.push('bt.type = ?')
      params.push(type)
    }

    if (search) {
      conditions.push("(bt.narration LIKE ? OR bt.ai_category_suggestion LIKE ?)")
      params.push(`%${search}%`, `%${search}%`)
    }

    if (categorised === 'true') {
      conditions.push('bt.is_categorised = 1')
    } else if (categorised === 'false') {
      conditions.push('bt.is_categorised = 0')
    }

    if (connectionId) {
      conditions.push('bt.bank_connection_id = ?')
      params.push(parseInt(connectionId))
    }

    const whereClause = conditions.join(' AND ')

    // Get total count
    const countResult = await dbQuery.get<{ total: number }>(
      `SELECT COUNT(*) as total FROM bank_transactions bt WHERE ${whereClause}`,
      params
    )
    const total = countResult?.total || 0

    // Get transactions
    const transactions = await dbQuery.all<{
      id: number
      type: string
      amount: number
      currency: string
      date: string
      narration: string
      reference: string | null
      balance_after: number | null
      category_id: number | null
      ai_category_suggestion: string | null
      ai_confidence: number | null
      is_categorised: number
      is_duplicate: number
      ignored: number
      bank_name: string | null
      created_at: string
    }>(
      `SELECT bt.id, bt.type, bt.amount, bt.currency, bt.date, bt.narration,
              bt.reference, bt.balance_after, bt.category_id, bt.ai_category_suggestion,
              bt.ai_confidence, bt.is_categorised, bt.is_duplicate, bt.ignored,
              bc.bank_name, bt.created_at
       FROM bank_transactions bt
       LEFT JOIN bank_connections bc ON bt.bank_connection_id = bc.id
       WHERE ${whereClause}
       ORDER BY bt.date DESC, bt.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    // Summary stats
    const stats = await dbQuery.get<{ total_credit: number; total_debit: number; uncategorised: number }>(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_credit,
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as total_debit,
        SUM(CASE WHEN is_categorised = 0 AND ignored = 0 THEN 1 ELSE 0 END) as uncategorised
       FROM bank_transactions bt
       WHERE bt.user_id = ? AND bt.ignored = 0`,
      [userId]
    )

    return NextResponse.json({
      transactions,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      stats: {
        totalCredit: stats?.total_credit || 0,
        totalDebit: stats?.total_debit || 0,
        uncategorised: stats?.uncategorised || 0,
      },
    })
  } catch (err) {
    console.error('[bank/transactions] GET Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
