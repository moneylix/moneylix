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
    const search = searchParams.get('search')
    const lowStock = searchParams.get('lowStock')
    const status = searchParams.get('status') || 'active'

    if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

    let sql = 'SELECT * FROM inventory_items WHERE user_id = ? AND business_id = ?'
    const params: unknown[] = [userId, parseInt(businessId)]

    if (status !== 'all') {
      sql += ' AND status = ?'
      params.push(status)
    }

    if (search) {
      sql += ' AND (name LIKE ? OR sku LIKE ? OR category LIKE ?)'
      const term = `%${search}%`
      params.push(term, term, term)
    }

    if (lowStock === 'true') {
      sql += ' AND current_stock <= low_stock_threshold'
    }

    sql += ' ORDER BY name ASC'

    const items = await db.all<Record<string, unknown>>(sql, params)
    return NextResponse.json({ items })
  } catch (err) {
    console.error('Inventory items GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      business_id, name, sku, description, category, unit,
      cost_price, selling_price, current_stock, low_stock_threshold,
    } = body

    if (!business_id || !name) {
      return NextResponse.json({ error: 'business_id and name are required' }, { status: 400 })
    }

    // Check SKU uniqueness if provided
    if (sku) {
      const existing = await db.get<{ id: number }>(
        "SELECT id FROM inventory_items WHERE business_id = ? AND sku = ? AND sku != ''",
        [business_id, sku]
      )
      if (existing) return NextResponse.json({ error: 'SKU already exists in this business' }, { status: 409 })
    }

    const result = await db.run(
      `INSERT INTO inventory_items (user_id, business_id, name, sku, description, category, unit, cost_price, selling_price, current_stock, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, business_id, name, sku || null, description || null,
        category || null, unit || 'pcs', cost_price || 0, selling_price || 0,
        current_stock || 0, low_stock_threshold ?? 10,
      ]
    )

    return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 })
  } catch (err) {
    console.error('Inventory items POST error:', err)
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
  }
}
