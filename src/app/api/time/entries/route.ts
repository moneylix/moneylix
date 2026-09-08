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

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const project = searchParams.get('project')
    const client = searchParams.get('client')
    const billable = searchParams.get('billable')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let sql = 'SELECT * FROM time_entries WHERE user_id = ?'
    const params: unknown[] = [userId]

    if (businessId) { sql += ' AND business_id = ?'; params.push(parseInt(businessId)) }
    if (project) { sql += ' AND project_name = ?'; params.push(project) }
    if (client) { sql += ' AND client_name = ?'; params.push(client) }
    if (billable === 'true') { sql += ' AND is_billable = 1' }
    if (billable === 'false') { sql += ' AND is_billable = 0' }
    if (status) { sql += ' AND status = ?'; params.push(status) }
    if (startDate) { sql += ' AND start_time >= ?'; params.push(startDate) }
    if (endDate) { sql += ' AND start_time <= ?'; params.push(endDate + 'T23:59:59') }

    sql += ' ORDER BY start_time DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const entries = await db.all<Record<string, unknown>>(sql, params)

    // Also fetch running timer if any
    const runningTimer = await db.get<Record<string, unknown>>(
      "SELECT * FROM time_entries WHERE user_id = ? AND status = 'running' LIMIT 1",
      [userId]
    )

    return NextResponse.json({ entries, running_timer: runningTimer || null })
  } catch (err) {
    console.error('Time entries GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      business_id, client_name, project_name, description,
      start_time, end_time, duration_minutes, hourly_rate,
      is_billable = true, start_timer = false,
    } = body

    // If starting a timer, check no other timer is running
    if (start_timer) {
      const existing = await db.get<{ id: number }>(
        "SELECT id FROM time_entries WHERE user_id = ? AND status = 'running'",
        [userId]
      )
      if (existing) {
        return NextResponse.json({ error: 'A timer is already running. Stop it first.' }, { status: 400 })
      }

      const result = await db.run(
        `INSERT INTO time_entries (user_id, business_id, client_name, project_name, description, start_time, hourly_rate, is_billable, status)
         VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, 'running')`,
        [userId, business_id || null, client_name || null, project_name || null, description || null, hourly_rate || null, is_billable ? 1 : 0]
      )
      return NextResponse.json({ id: Number(result.lastInsertRowid), status: 'running' }, { status: 201 })
    }

    // Manual entry
    if (!start_time) {
      return NextResponse.json({ error: 'start_time is required for manual entries' }, { status: 400 })
    }

    let minutes = duration_minutes
    let totalAmount = null

    if (end_time && !minutes) {
      const diff = new Date(end_time).getTime() - new Date(start_time).getTime()
      minutes = Math.round(diff / 60000)
    }

    if (hourly_rate && minutes) {
      totalAmount = Math.round(((hourly_rate * minutes) / 60) * 100) / 100
    }

    const result = await db.run(
      `INSERT INTO time_entries (user_id, business_id, client_name, project_name, description, start_time, end_time, duration_minutes, hourly_rate, total_amount, is_billable, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
      [
        userId, business_id || null, client_name || null, project_name || null,
        description || null, start_time, end_time || null, minutes || null,
        hourly_rate || null, totalAmount, is_billable ? 1 : 0,
      ]
    )

    return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 })
  } catch (err) {
    console.error('Time entries POST error:', err)
    return NextResponse.json({ error: 'Failed to create time entry' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, stop_timer = false, ...fields } = body

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const existing = await db.get<{ id: number; status: string; start_time: string; hourly_rate: number }>(
      'SELECT * FROM time_entries WHERE id = ? AND user_id = ?',
      [id, userId]
    )
    if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    if (stop_timer && existing.status === 'running') {
      const now = new Date().toISOString()
      const diff = new Date(now).getTime() - new Date(existing.start_time).getTime()
      const minutes = Math.round(diff / 60000)
      const totalAmount = existing.hourly_rate ? Math.round(((existing.hourly_rate * minutes) / 60) * 100) / 100 : null

      await db.run(
        `UPDATE time_entries SET end_time = ?, duration_minutes = ?, total_amount = ?, status = 'completed', updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`,
        [now, minutes, totalAmount, id, userId]
      )

      return NextResponse.json({ success: true, duration_minutes: minutes, total_amount: totalAmount })
    }

    // General update
    const updates: string[] = []
    const values: unknown[] = []
    const allowedFields = ['client_name', 'project_name', 'description', 'start_time', 'end_time', 'duration_minutes', 'hourly_rate', 'total_amount', 'is_billable', 'status'] as const

    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        updates.push(`${field} = ?`)
        values.push(fields[field])
      }
    }

    if (updates.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    updates.push("updated_at = datetime('now')")
    values.push(id, userId)

    await db.run(
      `UPDATE time_entries SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Time entries PUT error:', err)
    return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    await db.run('DELETE FROM time_entries WHERE id = ? AND user_id = ?', [parseInt(id), userId])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Time entries DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete time entry' }, { status: 500 })
  }
}
