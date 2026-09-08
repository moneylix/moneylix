import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { forecastCashFlow } from '@/lib/forecasting'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await db.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token],
  )
  return session?.user_id ?? null
}

/**
 * GET /api/forecast
 *
 * Query params:
 *   businessId — optional; null = forecast across all businesses
 *   days       — 30 | 60 | 90 (default 30)
 *
 * Returns { forecast: ForecastDay[], summary: ForecastSummary }
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const businessIdRaw = searchParams.get('businessId')
    const daysRaw = searchParams.get('days')

    const businessId = businessIdRaw ? parseInt(businessIdRaw, 10) : null
    const daysParam = daysRaw ? parseInt(daysRaw, 10) : 30
    const days = ([30, 60, 90] as const).includes(daysParam as 30 | 60 | 90)
      ? (daysParam as 30 | 60 | 90)
      : 30

    // Verify business ownership if specified
    if (businessId) {
      const biz = await db.get<{ id: number }>(
        'SELECT id FROM businesses WHERE id = ? AND user_id = ?',
        [businessId, userId],
      )
      if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const result = await forecastCashFlow(userId, businessId, days)

    return NextResponse.json({
      forecast: result.days,
      summary: result.summary,
    })
  } catch (err) {
    console.error('Forecast GET error:', err)
    return NextResponse.json({ error: 'Failed to generate forecast' }, { status: 500 })
  }
}
