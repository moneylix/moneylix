import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../../_auth'
import dbQuery from '@/lib/db.async'
import { audit, AUDIT_ACTIONS } from '@/lib/audit'

/**
 * GET /api/admin/users/[id]/data
 * Read-only view of a user's businesses and most recent transactions, for
 * support/dispute investigation. Every view is audit-logged since this is
 * access to someone else's financial data.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = parseInt(params.id)
  const user = await dbQuery.get<{ id: number; username: string; email: string }>(
    "SELECT id, username, email FROM users WHERE id = ? AND role = 'user'",
    [userId]
  )
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const businesses = await dbQuery.all<{ id: number; name: string }>(
    'SELECT id, name FROM businesses WHERE user_id = ? ORDER BY id',
    [userId]
  )
  const bizIds = businesses.map(b => b.id)

  let transactions: unknown[] = []
  if (bizIds.length > 0) {
    const placeholders = bizIds.map(() => '?').join(',')
    transactions = await dbQuery.all(
      `SELECT t.id, t.date, t.type, t.amount, t.description, t.status, b.name as business_name
       FROM transactions t
       JOIN businesses b ON b.id = t.business_id
       WHERE t.business_id IN (${placeholders})
       ORDER BY t.date DESC, t.id DESC
       LIMIT 50`,
      bizIds
    )
  }

  await audit({
    userId: admin.id,
    action: AUDIT_ACTIONS.USER_DATA_VIEWED_BY_ADMIN,
    category: 'admin',
    resourceType: 'user',
    resourceId: userId,
    description: `Admin viewed financial data for user "${user.username}" (${businesses.length} business(es), ${transactions.length} recent transaction(s) shown)`,
    request,
  })

  return NextResponse.json({ user, businesses, transactions })
}
