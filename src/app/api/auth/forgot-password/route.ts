import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import dbQuery from '@/lib/db.async'
import { sendPasswordResetEmail } from '@/lib/email/resend'

const SUCCESS_MSG = 'If an account with that email exists, a reset link has been sent.'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await dbQuery.get<{ id: number; email: string }>(
      'SELECT id, email FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    )

    if (!user) return NextResponse.json({ message: SUCCESS_MSG })

    // Invalidate existing unused tokens
    await dbQuery.run(
      "UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL",
      [user.id]
    )

    const token = crypto.randomBytes(32).toString('hex')
    await dbQuery.run(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, new Date(Date.now() + 60 * 60 * 1000).toISOString()]
    )

    try { await sendPasswordResetEmail(user.email, token) } catch (err) {
      console.error('[forgot-password] Email send failed:', err)
    }

    return NextResponse.json({ message: SUCCESS_MSG })
  } catch (err) {
    console.error('Forgot password error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
