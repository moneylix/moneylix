import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { hashPassword } from '@/lib/auth/password'

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json()

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const record = await dbQuery.get<{
      id: number; user_id: number; expires_at: string; used_at: string | null
    }>(
      'SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token = ?',
      [token]
    )

    if (!record) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    if (record.used_at || new Date() > new Date(record.expires_at)) {
      return NextResponse.json({ error: 'Token has expired or already been used' }, { status: 400 })
    }

    const hashed = await hashPassword(newPassword)

    await dbQuery.transaction((db) => {
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, record.user_id)
      db.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE id = ?").run(record.id)
    })

    return NextResponse.json({ message: 'Password has been successfully reset' })
  } catch (err) {
    console.error('Reset password error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
