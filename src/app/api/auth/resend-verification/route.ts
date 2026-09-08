import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import dbQuery from '@/lib/db.async'
import { sendVerificationEmail } from '@/lib/email/resend'

const SUCCESS_MSG = 'If that email has an unverified account, a new verification link has been sent.'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await dbQuery.get<{ id: number; username: string; email: string; email_verified: number }>(
      'SELECT id, username, email, email_verified FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    )

    if (!user || user.email_verified === 1) {
      return NextResponse.json({ message: SUCCESS_MSG })
    }

    // Invalidate existing unused tokens
    await dbQuery.run(
      "UPDATE email_verifications SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL",
      [user.id]
    )

    const token = crypto.randomBytes(3).toString('hex').toUpperCase()
    await dbQuery.run(
      'INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()]
    )

    try {
      await sendVerificationEmail(user.email, token, user.username)
    } catch (err) {
      console.error('[resend-verification] Email send failed:', err)
    }

    return NextResponse.json({ message: SUCCESS_MSG })
  } catch (err) {
    console.error('Resend verification error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
