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

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const itemId = searchParams.get('itemId')
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

    let sql = `SELECT m.*, i.name as item_name, i.sku as item_sku
               FROM inventory_movements m
               JOIN inventory_items i ON i.id = m.item_id
               WHERE m.user_id = ? AND m.business_id = ?`
    const params: unknown[] = [userId, parseInt(businessId)]

    if (itemId) { sql += ' AND m.item_id = ?'; params.push(parseInt(itemId)) }
    if (type) { sql += ' AND m.type = ?'; params.push(type) }

    sql += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const movements = await db.all<Record<string, unknown>>(sql, params)
    return NextResponse.json({ movements })
  } catch (err) {
    console.error('Inventory movements GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch movements' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { item_id, business_id, type, quantity, unit_price, reference, notes, create_transaction } = body

    if (!item_id || !business_id || !type || quantity === undefined) {
      return NextResponse.json({ error: 'item_id, business_id, type, and quantity are required' }, { status: 400 })
    }

    if (!['purchase', 'sale', 'adjustment', 'return'].includes(type)) {
      return NextResponse.json({ error: 'Invalid movement type' }, { status: 400 })
    }

    // Verify item ownership
    const item = await db.get<{ id: number; current_stock: number; selling_price: number; cost_price: number; name: string }>(
      'SELECT id, current_stock, selling_price, cost_price, name FROM inventory_items WHERE id = ? AND user_id = ?',
      [item_id, userId]
    )
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const totalAmount = (unit_price || (type === 'sale' ? item.selling_price : item.cost_price)) * Math.abs(quantity)

    // Calculate new stock
    let stockChange = 0
    if (type === 'purchase' || type === 'return') stockChange = Math.abs(quantity)
    else if (type === 'sale') stockChange = -Math.abs(quantity)
    else stockChange = quantity // adjustment can be positive or negative

    const newStock = item.current_stock + stockChange
    if (newStock < 0 && type === 'sale') {
      return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 })
    }

    let transactionId: number | null = null

    // Create a transaction record for sales if requested
    if (create_transaction && type === 'sale') {
      const txResult = await db.run(
        `INSERT INTO transactions (type, amount, category_id, business_id, currency, date, note, method, status)
         VALUES ('credit', ?, (SELECT id FROM categories WHERE name = 'Business Income' LIMIT 1), ?, 'INR', date('now'), ?, 'bank', 'completed')`,
        [totalAmount, business_id, `Sale: ${item.name} x${Math.abs(quantity)}`]
      )
      transactionId = Number(txResult.lastInsertRowid)
    }

    if (create_transaction && type === 'purchase') {
      const txResult = await db.run(
        `INSERT INTO transactions (type, amount, category_id, business_id, currency, date, note, method, status)
         VALUES ('debit', ?, (SELECT id FROM categories WHERE name = 'Shopping' LIMIT 1), ?, 'INR', date('now'), ?, 'bank', 'completed')`,
        [totalAmount, business_id, `Purchase: ${item.name} x${Math.abs(quantity)}`]
      )
      transactionId = Number(txResult.lastInsertRowid)
    }

    // Record movement
    await db.run(
      `INSERT INTO inventory_movements (item_id, user_id, business_id, type, quantity, unit_price, total_amount, transaction_id, reference, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item_id, userId, business_id, type, quantity, unit_price || null, totalAmount, transactionId, reference || null, notes || null]
    )

    // Update stock
    await db.run(
      "UPDATE inventory_items SET current_stock = ?, updated_at = datetime('now') WHERE id = ?",
      [newStock, item_id]
    )

    return NextResponse.json({ success: true, new_stock: newStock, transaction_id: transactionId }, { status: 201 })
  } catch (err) {
    console.error('Inventory movements POST error:', err)
    return NextResponse.json({ error: 'Failed to record movement' }, { status: 500 })
  }
}
