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
 * GET /api/payroll/entries?businessId=N&period=YYYY-MM&status=pending
 * List payroll entries for a business and period.
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

    const period = searchParams.get('period')
    const status = searchParams.get('status')

    let sql = `
      SELECT pe.*, sm.name AS staff_name, sm.role_title AS staff_role, sm.email AS staff_email
      FROM payroll_entries pe
      LEFT JOIN staff_members sm ON sm.id = pe.staff_member_id
      WHERE pe.user_id = ? AND pe.business_id = ?`
    const params: unknown[] = [userId, businessId]

    if (period) {
      sql += ' AND pe.period = ?'
      params.push(period)
    }

    if (status && ['pending', 'paid', 'cancelled'].includes(status)) {
      sql += ' AND pe.status = ?'
      params.push(status)
    }

    sql += ' ORDER BY pe.period DESC, sm.name ASC'

    const entries = await db.all<Record<string, unknown>>(sql, params)

    // Summary
    const summaryRows = await db.all<{ status: string; total: number; cnt: number }>(
      `SELECT status, COALESCE(SUM(net_amount), 0) AS total, COUNT(*) AS cnt
       FROM payroll_entries
       WHERE user_id = ? AND business_id = ? ${period ? 'AND period = ?' : ''}
       GROUP BY status`,
      period ? [userId, businessId, period] : [userId, businessId],
    )

    const summary: Record<string, { total: number; count: number }> = {}
    for (const r of summaryRows) {
      summary[r.status] = { total: r.total, count: r.cnt }
    }

    return NextResponse.json({ entries, summary })
  } catch (err) {
    console.error('Payroll entries GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch payroll entries' }, { status: 500 })
  }
}

/**
 * POST /api/payroll/entries
 * Generate payroll for a period (creates entries for all active staff).
 * Body: { businessId, period }  (period = "YYYY-MM")
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { businessId, period } = body

    if (!businessId || !period) {
      return NextResponse.json({ error: 'businessId and period (YYYY-MM) are required' }, { status: 400 })
    }

    // Validate period format
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: 'period must be in YYYY-MM format' }, { status: 400 })
    }

    // Verify ownership
    const biz = await db.get<{ id: number }>(
      'SELECT id FROM businesses WHERE id = ? AND user_id = ?',
      [businessId, userId],
    )
    if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    // Get all active staff
    const staff = await db.all<{
      id: number
      name: string
      salary_amount: number | null
    }>(
      "SELECT id, name, salary_amount FROM staff_members WHERE user_id = ? AND business_id = ? AND status = 'active'",
      [userId, businessId],
    )

    if (staff.length === 0) {
      return NextResponse.json({ error: 'No active staff members found' }, { status: 400 })
    }

    let created = 0
    let skipped = 0

    for (const s of staff) {
      // Check if entry already exists
      const existing = await db.get<{ id: number }>(
        'SELECT id FROM payroll_entries WHERE staff_member_id = ? AND period = ?',
        [s.id, period],
      )
      if (existing) {
        skipped++
        continue
      }

      const baseSalary = s.salary_amount ?? 0
      const netAmount = baseSalary // Will be adjusted via PUT with allowances/deductions

      await db.run(
        `INSERT INTO payroll_entries (user_id, business_id, staff_member_id, period, base_salary, allowances, deductions, net_amount, status)
         VALUES (?, ?, ?, ?, ?, 0, 0, ?, 'pending')`,
        [userId, businessId, s.id, period, baseSalary, netAmount],
      )
      created++
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      message: `Created ${created} payroll entries, skipped ${skipped} (already exist)`,
    })
  } catch (err) {
    console.error('Payroll entries POST error:', err)
    return NextResponse.json({ error: 'Failed to generate payroll' }, { status: 500 })
  }
}

/**
 * PUT /api/payroll/entries
 * Update a payroll entry (adjust allowances, deductions, notes).
 * Body: { id, allowances?, deductions?, notes?, status? }
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, allowances, deductions, notes, status } = body

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const entry = await db.get<{
      id: number
      base_salary: number
      allowances: number
      deductions: number
      status: string
    }>(
      'SELECT id, base_salary, allowances, deductions, status FROM payroll_entries WHERE id = ? AND user_id = ?',
      [id, userId],
    )
    if (!entry) return NextResponse.json({ error: 'Payroll entry not found' }, { status: 404 })

    if (entry.status === 'paid') {
      return NextResponse.json({ error: 'Cannot modify a paid entry' }, { status: 400 })
    }

    const newAllowances = allowances !== undefined ? parseFloat(allowances) || 0 : entry.allowances
    const newDeductions = deductions !== undefined ? parseFloat(deductions) || 0 : entry.deductions
    const newNet = entry.base_salary + newAllowances - newDeductions

    const updates: string[] = [
      'allowances = ?',
      'deductions = ?',
      'net_amount = ?',
      "updated_at = datetime('now')",
    ]
    const values: unknown[] = [newAllowances, newDeductions, newNet]

    if (notes !== undefined) {
      updates.push('notes = ?')
      values.push(notes)
    }

    if (status && ['pending', 'cancelled'].includes(status)) {
      updates.push('status = ?')
      values.push(status)
    }

    values.push(id, userId)

    await db.run(
      `UPDATE payroll_entries SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values,
    )

    return NextResponse.json({ success: true, net_amount: newNet })
  } catch (err) {
    console.error('Payroll entries PUT error:', err)
    return NextResponse.json({ error: 'Failed to update payroll entry' }, { status: 500 })
  }
}
