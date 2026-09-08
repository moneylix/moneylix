import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { businessSchema } from '@/lib/schemas'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
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

    const businesses = await db.all(
      'SELECT * FROM businesses WHERE user_id = ? ORDER BY created_at ASC',
      [userId]
    )
    return NextResponse.json(businesses)
  } catch (error) {
    console.error('Failed to fetch businesses:', error)
    return NextResponse.json({ error: 'Failed to fetch businesses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const validation = businessSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const { name } = validation.data
    const now = new Date().toISOString()
    const newBusiness = await db.transaction((tx) => {
      const result = tx.prepare('INSERT INTO businesses (name, user_id, created_at) VALUES (?, ?, ?)').run(name, userId, now)
      return tx.prepare('SELECT * FROM businesses WHERE id = ?').get(result.lastInsertRowid)
    })
    return NextResponse.json(newBusiness, { status: 201 })
  } catch (error) {
    console.error('Failed to create business:', error)
    return NextResponse.json({ error: 'Failed to create business' }, { status: 500 })
  }
}
