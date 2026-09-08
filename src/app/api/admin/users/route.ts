import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../admin/_auth'
import dbQuery from '@/lib/db.async'

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 20
  const offset = (page - 1) * limit
  const search = searchParams.get('search') ?? ''

  const whereClause = search
    ? "WHERE u.role = 'user' AND (u.username LIKE ? OR u.email LIKE ?)"
    : "WHERE u.role = 'user'"
  const params = search ? [`%${search}%`, `%${search}%`, limit, offset] : [limit, offset]

  const users = await dbQuery.all<{
    id: number; username: string; email: string; created_at: string
    plan: string | null; sub_status: string | null; sub_expires: string | null; amount_paid: number | null
    suspended: number
    tx_count: number
  }>(
    `SELECT u.id, u.username, u.email, u.created_at, u.suspended,
            s.plan, s.status as sub_status, s.expires_at as sub_expires, s.amount_paid,
            (SELECT COUNT(*) FROM transactions t WHERE t.business_id IN
              (SELECT id FROM businesses WHERE id IN
                (SELECT DISTINCT business_id FROM transactions)
              )
            ) as tx_count
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
     ${whereClause}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    params
  )

  const totalRow = search
    ? await dbQuery.get<{ count: number }>("SELECT COUNT(*) as count FROM users u WHERE u.role = 'user' AND (u.username LIKE ? OR u.email LIKE ?)", [`%${search}%`, `%${search}%`])
    : await dbQuery.get<{ count: number }>("SELECT COUNT(*) as count FROM users WHERE role = 'user'")

  return NextResponse.json({ users, total: totalRow?.count ?? 0, page, limit })
}
