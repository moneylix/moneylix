import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_auth'
import dbQuery from '@/lib/db.async'

/**
 * GET /api/admin/audit
 * Read-only, filterable, paginated view of the audit_logs table.
 * Query params: category, status, action, search, page, limit
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || ''
  const status = searchParams.get('status') || ''
  const search = searchParams.get('search') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '25', 10)))
  const offset = (page - 1) * limit

  const where: string[] = []
  const params: unknown[] = []

  if (category) { where.push('a.category = ?'); params.push(category) }
  if (status) { where.push('a.status = ?'); params.push(status) }
  if (search) {
    where.push('(a.action LIKE ? OR a.description LIKE ? OR u.username LIKE ?)')
    const s = `%${search}%`
    params.push(s, s, s)
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const total = (await dbQuery.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ${whereClause}`,
    params
  ))?.count ?? 0

  const logs = await dbQuery.all<Record<string, unknown>>(
    `SELECT a.id, a.action, a.category, a.resource_type, a.resource_id,
            a.description, a.status, a.error_message, a.ip_address,
            a.created_at, u.username
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  return NextResponse.json({
    logs,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  })
}
