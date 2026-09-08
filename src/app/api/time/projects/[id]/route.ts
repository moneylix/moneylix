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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const project = await db.get<Record<string, unknown>>(
      'SELECT * FROM time_projects WHERE id = ? AND user_id = ?',
      [parseInt(params.id), userId]
    )
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // Get total hours for this project
    const stats = await db.get<{ total_minutes: number; total_entries: number; total_amount: number }>(
      `SELECT
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COUNT(*) as total_entries,
        COALESCE(SUM(total_amount), 0) as total_amount
       FROM time_entries
       WHERE user_id = ? AND project_name = ? AND status IN ('completed', 'invoiced')`,
      [userId, project.name]
    )

    return NextResponse.json({ project, stats })
  } catch (err) {
    console.error('Time project GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const projectId = parseInt(params.id)
    const existing = await db.get<{ id: number }>(
      'SELECT id FROM time_projects WHERE id = ? AND user_id = ?',
      [projectId, userId]
    )
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const body = await request.json()
    const updates: string[] = []
    const values: unknown[] = []

    const fields = ['name', 'client_name', 'hourly_rate', 'color', 'status'] as const
    for (const field of fields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`)
        values.push(body[field])
      }
    }

    if (updates.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    values.push(projectId, userId)

    await db.run(
      `UPDATE time_projects SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Time project PUT error:', err)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await db.run('DELETE FROM time_projects WHERE id = ? AND user_id = ?', [parseInt(params.id), userId])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Time project DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
