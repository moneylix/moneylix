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
    const range = searchParams.get('range') === '30' ? 30 : 7

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }

    const biz = await db.get('SELECT id FROM businesses WHERE id = ? AND user_id = ?', [businessId, userId])
    if (!biz) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const transactions = await db.all('SELECT * FROM transactions WHERE business_id = ?', [businessId]) as any[]
    const categories = await db.all('SELECT * FROM categories') as any[]

    // Get top 5 categories by spending (debit only)
    const categoryMap = new Map<number, number>()
    transactions
      .filter(t => t.type === 'debit')
      .forEach(t => {
        const current = categoryMap.get(t.category_id) || 0
        categoryMap.set(t.category_id, current + t.amount)
      })

    const categorySpend = Array.from(categoryMap.entries())
      .map(([category_id, amount]) => {
        const cat = categories.find(c => c.id === category_id)
        return {
          categoryId: category_id,
          categoryName: cat?.name || '',
          categoryColor: cat?.color || '',
          categoryIcon: cat?.icon || '',
          amount
        }
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)

    const totalDebit = categorySpend.reduce((sum, cat) => sum + cat.amount, 0)

    const categoryData = categorySpend.map(cat => ({
      ...cat,
      percentage: totalDebit > 0 ? Math.round((cat.amount / totalDebit) * 100) : 0,
    }))

    // Get daily cashflow for the requested range
    const dailyData = []
    for (let i = range - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })

      const dayTx = transactions.filter(t => t.date === dateStr)
      const dayCredit = dayTx.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0)
      const dayDebit = dayTx.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0)

      dailyData.push({
        date: dateStr,
        day: dayName,
        credit: dayCredit,
        debit: dayDebit,
      })
    }

    return NextResponse.json({
      categorySpend: categoryData,
      dailyCashflow: dailyData,
    })
  } catch (error) {
    console.error('Charts data error:', error)
    return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 })
  }
}

