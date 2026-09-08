import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { hashPassword } from '@/lib/auth/password'
import { registerSchema } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = registerSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? 'Validation error' }, { status: 400 })
    }

    const { username, email, password } = validation.data

    const existing = await dbQuery.get<{ id: number }>(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    )
    if (existing) {
      return NextResponse.json({ error: 'Username or email already in use' }, { status: 409 })
    }

    const hash = await hashPassword(password)

    const result = await dbQuery.run(
      "INSERT INTO users (username, email, password, role, email_verified, created_at) VALUES (?, ?, ?, 'user', 1, datetime('now'))",
      [username, email, hash]
    )
    const userId = result.lastInsertRowid as number

    // Auto-create default business for every new user
    const now = new Date().toISOString()
    await dbQuery.run(
      'INSERT INTO businesses (name, user_id, created_at) VALUES (?, ?, ?)',
      ['My Finances', userId, now]
    )

    return NextResponse.json(
      { message: 'Account created successfully.', userId },
      { status: 201 }
    )
  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
