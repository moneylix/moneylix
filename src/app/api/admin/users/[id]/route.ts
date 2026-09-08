import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../../admin/_auth'
import dbQuery from '@/lib/db.async'
import { audit, AUDIT_ACTIONS } from '@/lib/audit'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = parseInt(params.id)
  const user = await dbQuery.get(
    `SELECT u.id, u.username, u.email, u.created_at,
            s.id as sub_id, s.plan, s.status as sub_status,
            s.started_at, s.expires_at, s.amount_paid, s.payment_method, s.notes
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
     WHERE u.id = ? AND u.role = 'user'`,
    [userId]
  )
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const history = await dbQuery.all(
    'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  )

  return NextResponse.json({ user, subscriptionHistory: history })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = parseInt(params.id)
  const body = await request.json()
  const { plan, status, expires_at, amount_paid, payment_method, notes } = body

  const existing = await dbQuery.get<{ id: number }>(
    "SELECT id FROM subscriptions WHERE user_id = ? AND status = 'active'",
    [userId]
  )

  if (existing) {
    await dbQuery.run(
      `UPDATE subscriptions SET plan = ?, status = ?, expires_at = ?, amount_paid = ?,
       payment_method = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`,
      [plan, status, expires_at ?? null, amount_paid ?? 0, payment_method ?? null, notes ?? null, existing.id]
    )
  } else {
    await dbQuery.run(
      `INSERT INTO subscriptions (user_id, plan, status, expires_at, amount_paid, payment_method, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, plan ?? 'free', status ?? 'active', expires_at ?? null, amount_paid ?? 0, payment_method ?? null, notes ?? null]
    )
  }

  return NextResponse.json({ success: true })
}

/**
 * DELETE /api/admin/users/[id]
 * Admin-initiated permanent account deletion. Mirrors the self-service
 * /api/user/delete-account cascade, minus password confirmation (the admin
 * is already authenticated as admin, not as the target user).
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = parseInt(params.id)
  const user = await dbQuery.get<{ id: number; role: string; username: string }>(
    'SELECT id, role, username FROM users WHERE id = ?',
    [userId]
  )
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.role === 'admin') {
    return NextResponse.json({ error: 'Admin accounts cannot be deleted via this endpoint' }, { status: 403 })
  }

  await dbQuery.transaction((db) => {
    const businesses = db.prepare('SELECT id FROM businesses WHERE user_id = ?').all(userId) as { id: number }[]
    const bizIds = businesses.map(b => b.id)

    if (bizIds.length > 0) {
      const placeholders = bizIds.map(() => '?').join(',')
      db.prepare(`DELETE FROM transactions WHERE business_id IN (${placeholders})`).run(...bizIds)
    }

    db.prepare('DELETE FROM bank_transactions WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM bank_connections WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM businesses WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM users WHERE id = ?').run(userId)
  })

  await audit({
    userId: admin.id,
    action: AUDIT_ACTIONS.USER_DELETED_BY_ADMIN,
    category: 'admin',
    resourceType: 'user',
    resourceId: userId,
    description: `Admin permanently deleted user "${user.username}" and all associated data`,
    request,
  })

  return NextResponse.json({ success: true })
}
