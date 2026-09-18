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
    const status = searchParams.get('status') || 'active'

    let sql = 'SELECT * FROM time_projects WHERE user_id = ?'
    const params: unknown[] = [userId]

    if (businessId) { sql += ' AND business_id = ?'; params.push(parseInt(businessId)) }
    if (status !== 'all') { sql += ' AND status = ?'; params.push(status) }

    sql += ' ORDER BY name ASC'

    const projects = await db.all<Record<string, unknown>>(sql, params)
    return NextResponse.json({ projects })
  } catch (err) {
    console.error('Time projects GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { business_id, name, client_name, hourly_rate, color } = body

    if (!name) return NextResponse.json({ error: 'Project name is required' }, { status: 400 })

    const result = await db.insert(
      `INSERT INTO time_projects (user_id, business_id, name, client_name, hourly_rate, color)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, business_id || null, name, client_name || null, hourly_rate || null, color || '#10B981']
    )

    return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 })
  } catch (err) {
    console.error('Time projects POST error:', err)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
