import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../admin/_auth'
import dbQuery from '@/lib/db.async'

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const plan = searchParams.get('plan')
  const status = searchParams.get('status')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 20
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: unknown[] = []
  if (plan)   { conditions.push('s.plan = ?');   params.push(plan) }
  if (status) { conditions.push('s.status = ?'); params.push(status) }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  const subs = await dbQuery.all(
    `SELECT s.*, u.username, u.email FROM subscriptions s
     JOIN users u ON u.id = s.user_id
     ${where}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  const totalRow = await dbQuery.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM subscriptions s ${where}`,
    params
  )

  return NextResponse.json({ subscriptions: subs, total: totalRow?.count ?? 0, page, limit })
}
