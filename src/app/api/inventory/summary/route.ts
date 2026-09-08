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

    if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

    const bId = parseInt(businessId)

    const totalItems = await db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM inventory_items WHERE user_id = ? AND business_id = ? AND status = 'active'",
      [userId, bId]
    )

    const stockValueCost = await db.get<{ total: number }>(
      "SELECT COALESCE(SUM(current_stock * cost_price), 0) as total FROM inventory_items WHERE user_id = ? AND business_id = ? AND status = 'active'",
      [userId, bId]
    )

    const stockValueSelling = await db.get<{ total: number }>(
      "SELECT COALESCE(SUM(current_stock * selling_price), 0) as total FROM inventory_items WHERE user_id = ? AND business_id = ? AND status = 'active'",
      [userId, bId]
    )

    const lowStockCount = await db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM inventory_items WHERE user_id = ? AND business_id = ? AND status = 'active' AND current_stock <= low_stock_threshold",
      [userId, bId]
    )

    const outOfStockCount = await db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM inventory_items WHERE user_id = ? AND business_id = ? AND status = 'active' AND current_stock <= 0",
      [userId, bId]
    )

    const topSellingItems = await db.all<Record<string, unknown>>(
      `SELECT i.name, SUM(ABS(m.quantity)) as total_sold
       FROM inventory_movements m
       JOIN inventory_items i ON i.id = m.item_id
       WHERE m.user_id = ? AND m.business_id = ? AND m.type = 'sale'
       GROUP BY m.item_id
       ORDER BY total_sold DESC
       LIMIT 5`,
      [userId, bId]
    )

    return NextResponse.json({
      total_items: totalItems?.cnt ?? 0,
      stock_value_cost: Math.round((stockValueCost?.total ?? 0) * 100) / 100,
      stock_value_selling: Math.round((stockValueSelling?.total ?? 0) * 100) / 100,
      low_stock_count: lowStockCount?.cnt ?? 0,
      out_of_stock_count: outOfStockCount?.cnt ?? 0,
      top_selling: topSellingItems,
    })
  } catch (err) {
    console.error('Inventory summary error:', err)
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 })
  }
}
