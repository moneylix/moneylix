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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const item = await db.get<Record<string, unknown>>(
      'SELECT * FROM inventory_items WHERE id = ? AND user_id = ?',
      [parseInt(params.id), userId]
    )
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const movements = await db.all<Record<string, unknown>>(
      'SELECT * FROM inventory_movements WHERE item_id = ? ORDER BY created_at DESC LIMIT 50',
      [parseInt(params.id)]
    )

    return NextResponse.json({ item, movements })
  } catch (err) {
    console.error('Inventory item GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const itemId = parseInt(params.id)
    const existing = await db.get<{ id: number }>(
      'SELECT id FROM inventory_items WHERE id = ? AND user_id = ?',
      [itemId, userId]
    )
    if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const body = await request.json()
    const updates: string[] = []
    const values: unknown[] = []

    const fields = ['name', 'sku', 'description', 'category', 'unit', 'cost_price', 'selling_price', 'current_stock', 'low_stock_threshold', 'status'] as const
    for (const field of fields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`)
        values.push(body[field])
      }
    }

    if (updates.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    updates.push("updated_at = datetime('now')")
    values.push(itemId, userId)

    await db.run(
      `UPDATE inventory_items SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Inventory item PUT error:', err)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const itemId = parseInt(params.id)
    const existing = await db.get<{ id: number }>(
      'SELECT id FROM inventory_items WHERE id = ? AND user_id = ?',
      [itemId, userId]
    )
    if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    await db.run('DELETE FROM inventory_movements WHERE item_id = ?', [itemId])
    await db.run('DELETE FROM inventory_items WHERE id = ? AND user_id = ?', [itemId, userId])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Inventory item DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
