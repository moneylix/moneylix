import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { checkPermission, ROLE_DEFAULTS } from '@/lib/permissions'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await db.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token],
  )
  return session?.user_id ?? null
}

/**
 * PUT /api/team/:id
 * Update a team member's role and/or permissions.
 * Body: { role?, permissions? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const memberId = parseInt(params.id, 10)
    if (!memberId) return NextResponse.json({ error: 'Invalid member id' }, { status: 400 })

    // Fetch member
    const member = await db.get<{ id: number; business_id: number; user_id: number | null; role: string }>(
      'SELECT id, business_id, user_id, role FROM team_members WHERE id = ?',
      [memberId],
    )
    if (!member) return NextResponse.json({ error: 'Team member not found' }, { status: 404 })

    // Check permission
    const canManage = await checkPermission(userId, member.business_id, 'can_manage_team')
    if (!canManage) {
      return NextResponse.json({ error: 'You do not have permission to manage team members' }, { status: 403 })
    }

    const body = await request.json()
    const { role, permissions } = body

    const validRoles = ['admin', 'accountant', 'staff', 'viewer']

    const updates: string[] = []
    const values: unknown[] = []

    if (role) {
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      updates.push('role = ?')
      values.push(role)
      // Also reset permissions to role defaults when role changes
      updates.push('permissions = ?')
      values.push(JSON.stringify(ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.viewer))
    }

    if (permissions && typeof permissions === 'object') {
      updates.push('permissions = ?')
      values.push(JSON.stringify(permissions))
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    updates.push("updated_at = datetime('now')")
    values.push(memberId)

    await db.run(
      `UPDATE team_members SET ${updates.join(', ')} WHERE id = ?`,
      values,
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Team PUT error:', err)
    return NextResponse.json({ error: 'Failed to update team member' }, { status: 500 })
  }
}

/**
 * DELETE /api/team/:id
 * Remove a team member.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const memberId = parseInt(params.id, 10)
    if (!memberId) return NextResponse.json({ error: 'Invalid member id' }, { status: 400 })

    const member = await db.get<{ id: number; business_id: number }>(
      'SELECT id, business_id FROM team_members WHERE id = ?',
      [memberId],
    )
    if (!member) return NextResponse.json({ error: 'Team member not found' }, { status: 404 })

    const canManage = await checkPermission(userId, member.business_id, 'can_manage_team')
    if (!canManage) {
      return NextResponse.json({ error: 'You do not have permission to manage team members' }, { status: 403 })
    }

    await db.run('DELETE FROM team_members WHERE id = ?', [memberId])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Team DELETE error:', err)
    return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 })
  }
}
