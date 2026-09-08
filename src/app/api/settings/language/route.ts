import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await db.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token]
  )
  return session?.user_id ?? null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const setting = await db.get<{ value: string }>(
      "SELECT value FROM user_settings WHERE user_id = ? AND key = 'language'",
      [userId]
    )

    return NextResponse.json({ language: setting?.value ?? 'en' })
  } catch (err) {
    console.error('Language GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch language' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { language } = body

    if (!language || !['en', 'ta', 'hi'].includes(language)) {
      return NextResponse.json({ error: 'Invalid language. Supported: en, ta, hi' }, { status: 400 })
    }

    // Upsert user_settings
    const existing = await db.get<{ user_id: number }>(
      "SELECT user_id FROM user_settings WHERE user_id = ? AND key = 'language'",
      [userId]
    )

    if (existing) {
      await db.run(
        "UPDATE user_settings SET value = ? WHERE user_id = ? AND key = 'language'",
        [language, userId]
      )
    } else {
      await db.run(
        "INSERT INTO user_settings (user_id, key, value) VALUES (?, 'language', ?)",
        [userId, language]
      )
    }

    return NextResponse.json({ success: true, language })
  } catch (err) {
    console.error('Language PUT error:', err)
    return NextResponse.json({ error: 'Failed to update language' }, { status: 500 })
  }
}
