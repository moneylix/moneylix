import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { toPgQuery } from '@/lib/db.postgres'
import { sendWelcomeEmail } from '@/lib/email/resend'

export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token')
    if (!token) {
      return NextResponse.redirect(new URL('/auth/login?error=invalid_token', request.url))
    }

    const record = await dbQuery.get<{
      id: number; user_id: number; expires_at: string; used_at: string | null
      username: string; email: string
    }>(
      `SELECT ev.id, ev.user_id, ev.expires_at, ev.used_at, u.username, u.email
       FROM email_verifications ev
       JOIN users u ON u.id = ev.user_id
       WHERE ev.token = ?`,
      [token]
    )

    if (!record) {
      return NextResponse.redirect(new URL('/auth/login?error=invalid_token', request.url))
    }
    if (record.used_at) {
      return NextResponse.redirect(new URL('/auth/login?verified=true', request.url))
    }
    if (new Date() > new Date(record.expires_at)) {
      return NextResponse.redirect(new URL('/auth/login?error=token_expired', request.url))
    }

    await dbQuery.transaction(async (client) => {
      // email_verified is a real BOOLEAN column in Postgres (unlike the
      // INTEGER flag columns elsewhere) — TRUE, not 1.
      await client.query(toPgQuery('UPDATE users SET email_verified = TRUE WHERE id = ?'), [record.user_id])
      await client.query(toPgQuery("UPDATE email_verifications SET used_at = datetime('now') WHERE id = ?"), [record.id])
    })

    try { await sendWelcomeEmail(record.email, record.username) } catch { /* non-blocking */ }

    return NextResponse.redirect(new URL('/auth/login?verified=true', request.url))
  } catch (err) {
    console.error('Verify email error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
