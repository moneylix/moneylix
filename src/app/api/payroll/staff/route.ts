import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'

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
 * GET /api/payroll/staff?businessId=N
 * List staff members for a business.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const businessId = parseInt(searchParams.get('businessId') ?? '', 10)
    if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

    // Verify ownership
    const biz = await db.get<{ id: number }>(
      'SELECT id FROM businesses WHERE id = ? AND user_id = ?',
      [businessId, userId],
    )
    if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    const statusFilter = searchParams.get('status')
    const search = searchParams.get('search')

    let sql = 'SELECT * FROM staff_members WHERE user_id = ? AND business_id = ?'
    const params: unknown[] = [userId, businessId]

    if (statusFilter && (statusFilter === 'active' || statusFilter === 'inactive')) {
      sql += ' AND status = ?'
      params.push(statusFilter)
    }

    if (search) {
      sql += ' AND (name LIKE ? OR role_title LIKE ? OR email LIKE ?)'
      const like = `%${search}%`
      params.push(like, like, like)
    }

    sql += ' ORDER BY status ASC, name ASC'

    const staff = await db.all<Record<string, unknown>>(sql, params)

    return NextResponse.json({ staff })
  } catch (err) {
    console.error('Payroll staff GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }
}

/**
 * POST /api/payroll/staff
 * Add a new staff member.
 * Body: { businessId, name, role_title?, email?, phone?, salary_amount?, salary_frequency?, joined_date? }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      businessId, name, role_title, email, phone,
      salary_amount, salary_frequency, joined_date,
    } = body

    if (!businessId || !name) {
      return NextResponse.json({ error: 'businessId and name are required' }, { status: 400 })
    }

    // Verify ownership
    const biz = await db.get<{ id: number }>(
      'SELECT id FROM businesses WHERE id = ? AND user_id = ?',
      [businessId, userId],
    )
    if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    const freq = salary_frequency || 'monthly'
    const validFreqs = ['monthly', 'weekly', 'biweekly']
    if (!validFreqs.includes(freq)) {
      return NextResponse.json({ error: 'Invalid salary_frequency' }, { status: 400 })
    }

    const result = await db.run(
      `INSERT INTO staff_members (user_id, business_id, name, role_title, email, phone, salary_amount, salary_frequency, joined_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, businessId, name.trim(),
        role_title || null, email || null, phone || null,
        salary_amount ? parseFloat(salary_amount) : null,
        freq,
        joined_date || null,
      ],
    )

    return NextResponse.json({
      success: true,
      id: result.lastInsertRowid,
    })
  } catch (err) {
    console.error('Payroll staff POST error:', err)
    return NextResponse.json({ error: 'Failed to add staff member' }, { status: 500 })
  }
}
