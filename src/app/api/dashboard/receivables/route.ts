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
 * GET /api/dashboard/receivables
 *
 * Lightweight feed for the header's pending-amount badge (ReceivableBadge in
 * src/app/dashboard/layout.tsx) and any other summary widget — the same
 * "receivable" universe the Receivables page itself uses (transactions that
 * are pending/received, or have a client_name), just without the full
 * transaction list a normal /api/transactions call would pull in.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const businessIdParam = searchParams.get('businessId')

    const conditions: string[] = ["(t.status IN ('pending', 'received') OR t.client_name IS NOT NULL)"]
    const params: unknown[] = []

    if (businessIdParam) {
      const businessId = parseInt(businessIdParam, 10)
      const biz = await db.get('SELECT id FROM businesses WHERE id = ? AND user_id = ?', [businessId, userId])
      if (!biz) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      conditions.push('t.business_id = ?')
      params.push(businessId)
    } else {
      conditions.push('t.business_id IN (SELECT id FROM businesses WHERE user_id = ?)')
      params.push(userId)
    }

    const rows = await db.all<{
      id: number; type: string; amount: number; status: string
      date: string; due_date: string | null; client_name: string | null; note: string | null
    }>(
      `SELECT t.id, t.type, t.amount, t.status, t.date, t.due_date, t.client_name, t.note
       FROM transactions t
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.due_date ASC, t.date DESC`,
      params
    )

    return NextResponse.json({ receivables: rows })
  } catch (err) {
    console.error('Dashboard receivables GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch receivables' }, { status: 500 })
  }
}
