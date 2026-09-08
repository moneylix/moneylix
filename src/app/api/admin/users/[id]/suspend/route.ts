import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../../_auth'
import dbQuery from '@/lib/db.async'
import { audit, AUDIT_ACTIONS } from '@/lib/audit'

/**
 * POST /api/admin/users/[id]/suspend
 * Suspends a user: blocks future logins and immediately kills any active
 * session, so an already-logged-in user is signed out on their next request.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = parseInt(params.id)
  const user = await dbQuery.get<{ id: number; role: string; username: string }>(
    'SELECT id, role, username FROM users WHERE id = ?',
    [userId]
  )
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.role === 'admin') {
    return NextResponse.json({ error: 'Admin accounts cannot be suspended' }, { status: 403 })
  }

  await dbQuery.run(
    "UPDATE users SET suspended = 1, suspended_at = datetime('now') WHERE id = ?",
    [userId]
  )
  await dbQuery.run('DELETE FROM sessions WHERE user_id = ?', [userId])

  await audit({
    userId: admin.id,
    action: AUDIT_ACTIONS.USER_SUSPENDED,
    category: 'admin',
    resourceType: 'user',
    resourceId: userId,
    description: `Admin suspended user "${user.username}" and terminated their active session`,
    request,
  })

  return NextResponse.json({ success: true })
}

/**
 * DELETE /api/admin/users/[id]/suspend
 * Lifts a suspension, restoring normal login access.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = parseInt(params.id)
  const user = await dbQuery.get<{ id: number; username: string }>(
    'SELECT id, username FROM users WHERE id = ?',
    [userId]
  )
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await dbQuery.run(
    'UPDATE users SET suspended = 0, suspended_at = NULL WHERE id = ?',
    [userId]
  )

  await audit({
    userId: admin.id,
    action: AUDIT_ACTIONS.USER_UNSUSPENDED,
    category: 'admin',
    resourceType: 'user',
    resourceId: userId,
    description: `Admin lifted suspension for user "${user.username}"`,
    request,
  })

  return NextResponse.json({ success: true })
}
