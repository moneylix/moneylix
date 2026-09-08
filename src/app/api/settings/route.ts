import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { settingsSchema } from '@/lib/schemas'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await dbQuery.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token]
  )
  return session?.user_id ?? null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      // Unauthenticated: return global default
      const setting = await dbQuery.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['defaultCurrency'])
      return NextResponse.json({ defaultCurrency: setting?.value || 'INR', updated_at: new Date().toISOString() })
    }

    const setting = await dbQuery.get<{ value: string }>(
      'SELECT value FROM user_settings WHERE user_id = ? AND key = ?',
      [userId, 'defaultCurrency']
    )
    return NextResponse.json({
      defaultCurrency: setting?.value || 'INR',
      updated_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const validation = settingsSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const { defaultCurrency } = validation.data

    await dbQuery.run(
      'INSERT INTO user_settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value',
      [userId, 'defaultCurrency', defaultCurrency]
    )

    return NextResponse.json({
      success: true,
      defaultCurrency,
      updated_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
