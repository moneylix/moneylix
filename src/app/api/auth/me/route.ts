import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await dbQuery.get<{ id: number; username: string; email: string; role: string }>(
      `SELECT u.id, u.username, u.email, u.role
       FROM users u
       JOIN sessions s ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > datetime('now')`,
      [token]
    )

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    return NextResponse.json({ id: user.id, username: user.username, email: user.email, role: user.role })
  } catch (err) {
    console.error('Me error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
