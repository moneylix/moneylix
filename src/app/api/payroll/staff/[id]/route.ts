import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'

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
 * GET /api/payroll/staff/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const staffId = parseInt(params.id, 10)
    if (!staffId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const member = await db.get<Record<string, unknown>>(
      'SELECT * FROM staff_members WHERE id = ? AND user_id = ?',
      [staffId, userId],
    )
    if (!member) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

    return NextResponse.json({ staff: member })
  } catch (err) {
    console.error('Staff GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch staff member' }, { status: 500 })
  }
}

/**
 * PUT /api/payroll/staff/:id
 * Update a staff member.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const staffId = parseInt(params.id, 10)
    if (!staffId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const existing = await db.get<{ id: number }>(
      'SELECT id FROM staff_members WHERE id = ? AND user_id = ?',
      [staffId, userId],
    )
    if (!existing) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

    const body = await request.json()
    const {
      name, role_title, email, phone,
      salary_amount, salary_frequency, status, joined_date,
    } = body

    const updates: string[] = []
    const values: unknown[] = []

    if (name !== undefined) { updates.push('name = ?'); values.push(name.trim()) }
    if (role_title !== undefined) { updates.push('role_title = ?'); values.push(role_title || null) }
    if (email !== undefined) { updates.push('email = ?'); values.push(email || null) }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone || null) }
    if (salary_amount !== undefined) { updates.push('salary_amount = ?'); values.push(parseFloat(salary_amount) || null) }
    if (salary_frequency !== undefined) {
      const valid = ['monthly', 'weekly', 'biweekly']
      if (!valid.includes(salary_frequency)) {
        return NextResponse.json({ error: 'Invalid salary_frequency' }, { status: 400 })
      }
      updates.push('salary_frequency = ?')
      values.push(salary_frequency)
    }
    if (status !== undefined) {
      const valid = ['active', 'inactive']
      if (!valid.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updates.push('status = ?')
      values.push(status)
    }
    if (joined_date !== undefined) { updates.push('joined_date = ?'); values.push(joined_date || null) }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    updates.push("updated_at = datetime('now')")
    values.push(staffId, userId)

    await db.run(
      `UPDATE staff_members SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values,
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Staff PUT error:', err)
    return NextResponse.json({ error: 'Failed to update staff member' }, { status: 500 })
  }
}

/**
 * DELETE /api/payroll/staff/:id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const staffId = parseInt(params.id, 10)
    if (!staffId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const existing = await db.get<{ id: number }>(
      'SELECT id FROM staff_members WHERE id = ? AND user_id = ?',
      [staffId, userId],
    )
    if (!existing) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

    await db.run('DELETE FROM staff_members WHERE id = ? AND user_id = ?', [staffId, userId])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Staff DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete staff member' }, { status: 500 })
  }
}
