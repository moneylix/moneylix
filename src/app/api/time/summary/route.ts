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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let whereClauses = 'user_id = ?'
    const params: unknown[] = [userId]

    if (businessId) {
      whereClauses += ' AND business_id = ?'
      params.push(parseInt(businessId))
    }
    if (startDate) {
      whereClauses += ' AND start_time >= ?'
      params.push(startDate)
    }
    if (endDate) {
      whereClauses += ' AND start_time <= ?'
      params.push(endDate + 'T23:59:59')
    }

    const completedWhere = whereClauses + " AND status IN ('completed', 'invoiced')"

    // Total hours
    const totals = await db.get<{
      total_minutes: number; billable_minutes: number;
      total_amount: number; entry_count: number
    }>(
      `SELECT
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COALESCE(SUM(CASE WHEN is_billable = 1 THEN duration_minutes ELSE 0 END), 0) as billable_minutes,
        COALESCE(SUM(CASE WHEN is_billable = 1 THEN total_amount ELSE 0 END), 0) as total_amount,
        COUNT(*) as entry_count
       FROM time_entries WHERE ${completedWhere}`,
      params
    )

    // Today's hours
    const todayStart = new Date().toISOString().split('T')[0]
    const todayParams = [...params]
    const todayTotals = await db.get<{ total_minutes: number }>(
      `SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
       FROM time_entries WHERE ${completedWhere} AND date(start_time) = ?`,
      [...todayParams, todayStart]
    )

    // This week's hours
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() + 1)
    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekTotals = await db.get<{ total_minutes: number }>(
      `SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
       FROM time_entries WHERE ${completedWhere} AND date(start_time) >= ?`,
      [...params, weekStartStr]
    )

    // By project breakdown
    const byProject = await db.all<{ project_name: string; total_minutes: number; total_amount: number; entry_count: number }>(
      `SELECT
        COALESCE(project_name, 'No Project') as project_name,
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COALESCE(SUM(CASE WHEN is_billable = 1 THEN total_amount ELSE 0 END), 0) as total_amount,
        COUNT(*) as entry_count
       FROM time_entries WHERE ${completedWhere}
       GROUP BY project_name
       ORDER BY total_minutes DESC`,
      params
    )

    return NextResponse.json({
      total_hours: Math.round(((totals?.total_minutes ?? 0) / 60) * 100) / 100,
      billable_hours: Math.round(((totals?.billable_minutes ?? 0) / 60) * 100) / 100,
      total_billable_amount: Math.round((totals?.total_amount ?? 0) * 100) / 100,
      entry_count: totals?.entry_count ?? 0,
      today_hours: Math.round(((todayTotals?.total_minutes ?? 0) / 60) * 100) / 100,
      week_hours: Math.round(((weekTotals?.total_minutes ?? 0) / 60) * 100) / 100,
      by_project: byProject.map(p => ({
        ...p,
        total_hours: Math.round((p.total_minutes / 60) * 100) / 100,
        total_amount: Math.round(p.total_amount * 100) / 100,
      })),
    })
  } catch (err) {
    console.error('Time summary error:', err)
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 })
  }
}
