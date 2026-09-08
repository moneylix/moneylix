import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { requireAdmin } from '../_auth'
import { hashPassword } from '@/lib/auth/password'

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admins = await dbQuery.all(
    "SELECT id, username, email, created_at FROM users WHERE role = 'admin' ORDER BY created_at ASC"
  )
  return NextResponse.json({ admins })
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { username, email, password } = await request.json()
  if (!username || !email || !password) return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

  const existing = await dbQuery.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email])
  if (existing) return NextResponse.json({ error: 'Username or email already exists' }, { status: 400 })

  const hash = await hashPassword(password)
  await dbQuery.run(
    "INSERT INTO users (username, email, password, role, email_verified, created_at) VALUES (?, ?, ?, 'admin', 1, datetime('now'))",
    [username, email, hash]
  )
  return NextResponse.json({ success: true }, { status: 201 })
}
