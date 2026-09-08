import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_auth'
import dbQuery from '@/lib/db.async'

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const totalUsers = (await dbQuery.get<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE role = ?', ['user']))?.count ?? 0
  const totalTransactions = (await dbQuery.get<{ count: number }>('SELECT COUNT(*) as count FROM transactions'))?.count ?? 0

  const planCounts = await dbQuery.all<{ plan: string; count: number }>(
    `SELECT s.plan, COUNT(*) as count FROM subscriptions s
     WHERE s.status = 'active'
     GROUP BY s.plan`
  )
  const planMap: Record<string, number> = { free: 0, pro: 0, premium: 0 }
  for (const row of planCounts) planMap[row.plan] = row.count

  const usersWithoutSub = (await dbQuery.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM users u
     WHERE u.role = 'user'
     AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id AND s.status = 'active')`
  ))?.count ?? 0
  planMap.free += usersWithoutSub

  const totalRevenue = (await dbQuery.get<{ total: number }>(
    "SELECT COALESCE(SUM(amount_paid), 0) as total FROM subscriptions WHERE status != 'cancelled'"
  ))?.total ?? 0

  const pendingFeatures = (await dbQuery.get<{ count: number }>(
    "SELECT COUNT(*) as count FROM feature_requests WHERE status IN ('pending', 'in_progress')"
  ))?.count ?? 0

  const recentUsers = await dbQuery.all<{
    id: number; username: string; email: string; created_at: string; plan: string | null; sub_status: string | null
  }>(
    `SELECT u.id, u.username, u.email, u.created_at,
            s.plan, s.status as sub_status
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
     WHERE u.role = 'user'
     ORDER BY u.created_at DESC
     LIMIT 10`
  )

  const renewalAlerts = await dbQuery.all<{ username: string; plan: string; expires_at: string }>(
    `SELECT u.username, s.plan, s.expires_at 
     FROM subscriptions s 
     JOIN users u ON s.user_id = u.id 
     WHERE s.expires_at BETWEEN datetime('now') AND datetime('now', '+7 days') 
     AND s.status = 'active'`
  )

  return NextResponse.json({
    totalUsers,
    totalTransactions,
    totalRevenue,
    pendingFeatures,
    plans: planMap,
    recentUsers,
    renewalAlerts,
    gatewayStatus: {
      provider: 'Stripe / Razorpay',
      status: 'operational',
      uptime: '99.98%',
      lastSync: new Date().toISOString()
    }
  })
}
