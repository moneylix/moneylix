import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    const row = await dbQuery.get<{ id: number; username: string; email: string; password: string }>(
      "SELECT id, username, email, password FROM users WHERE (username = ? OR email = ?) AND role = 'admin'",
      [username, username]
    )
    if (!row) return NextResponse.json({ error: 'Invalid admin credentials' }, { status: 401 })

    // Support bcrypt (new) and base64 (legacy) — auto-migrate on first login
    let valid = false
    if (row.password.startsWith('$2')) {
      valid = await bcrypt.compare(password, row.password)
    } else {
      valid = row.password === Buffer.from(password).toString('base64')
      if (valid) {
        const upgraded = await bcrypt.hash(password, 12)
        await dbQuery.run('UPDATE users SET password = ? WHERE id = ?', [upgraded, row.id])
      }
    }
    if (!valid) return NextResponse.json({ error: 'Invalid admin credentials' }, { status: 401 })

    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    await dbQuery.run(
      "INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?, ?, ?, datetime('now'))",
      [row.id, sessionToken, expiresAt]
    )

    return NextResponse.json({ sessionToken, userId: row.id, username: row.username })
  } catch (err) {
    console.error('Admin login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
