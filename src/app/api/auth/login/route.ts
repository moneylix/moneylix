import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import dbQuery from '@/lib/db.async'
import { verifyPassword } from '@/lib/auth/password'
import { loginSchema } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = loginSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? 'Validation error' },
        { status: 400 }
      )
    }

    const { username, password } = validation.data

    const user = await dbQuery.get<{
      id: number; username: string; email: string
      password: string; email_verified: number; suspended: number
    }>(
      'SELECT id, username, email, password, email_verified, suspended FROM users WHERE username = ? OR email = ?',
      [username, username]
    )

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Support both bcrypt (new accounts) and base64 (legacy demo/admin)
    let passwordOk = false
    if (user.password.startsWith('$2')) {
      passwordOk = await verifyPassword(password, user.password)
    } else {
      passwordOk = user.password === Buffer.from(password).toString('base64')
    }

    if (!passwordOk) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (user.suspended) {
      return NextResponse.json(
        { error: 'This account has been suspended. Contact support for help.' },
        { status: 403 }
      )
    }

    const sessionToken = crypto.randomUUID()
    await dbQuery.run(
      "INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?, ?, ?, datetime('now'))",
      [user.id, sessionToken, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()]
    )

    return NextResponse.json({ message: 'Login successful', userId: user.id, sessionToken })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
