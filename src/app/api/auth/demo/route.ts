import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import crypto from 'crypto'

// Instant demo login — no password required.
// Accepts ?role=parent|child|user (all map to the 'demo' account for now).
export async function GET(request: NextRequest) {
  try {
    const user = await dbQuery.get<{ id: number; username: string }>(
      "SELECT id, username FROM users WHERE username = 'demo'"
    )

    if (!user) {
      return NextResponse.json({ error: 'Demo account not available' }, { status: 503 })
    }

    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await dbQuery.run(
      "INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?, ?, ?, datetime('now'))",
      [user.id, sessionToken, expiresAt]
    )

    return NextResponse.json({
      message: 'Demo login successful',
      userId: user.id,
      sessionToken,
    })
  } catch (err) {
    console.error('Demo login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request)
}
