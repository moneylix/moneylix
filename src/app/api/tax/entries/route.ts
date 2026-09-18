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

const VALID_TYPES = ['gst_payable', 'tds_deducted', 'advance_tax', 'tds_receivable'] as const
const VALID_STATUSES = ['pending', 'paid', 'filed'] as const

/**
 * GET /api/tax/entries?businessId=N&financialYear=2026-27&type=gst_payable&status=pending
 *
 * List tax entries for a user + business + financial year.
 * Optional filters: type, status, quarter.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const financialYear = searchParams.get('financialYear')
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const quarter = searchParams.get('quarter')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    let sql = 'SELECT * FROM tax_entries WHERE user_id = ? AND business_id = ?'
    const params: unknown[] = [userId, parseInt(businessId, 10)]

    if (financialYear) {
      sql += ' AND financial_year = ?'
      params.push(financialYear)
    }
    if (type && VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      sql += ' AND type = ?'
      params.push(type)
    }
    if (status && VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      sql += ' AND status = ?'
      params.push(status)
    }
    if (quarter) {
      sql += ' AND quarter = ?'
      params.push(quarter)
    }

    sql += ' ORDER BY created_at DESC'

    const entries = await db.all<Record<string, unknown>>(sql, params)

    // Summary totals
    const totals = {
      total: 0,
      pending: 0,
      paid: 0,
      filed: 0,
    }
    for (const e of entries) {
      const amt = (e.amount as number) ?? 0
      totals.total += amt
      if (e.status === 'pending') totals.pending += amt
      if (e.status === 'paid') totals.paid += amt
      if (e.status === 'filed') totals.filed += amt
    }

    return NextResponse.json({ entries, totals })
  } catch (err) {
    console.error('Tax entries GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch tax entries' }, { status: 500 })
  }
}

/**
 * POST /api/tax/entries
 *
 * Create a new tax entry.
 * Body: { businessId, financial_year, quarter?, month?, type, amount, description?, due_date?, reference_number? }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { businessId, financial_year, quarter, month, type, amount, description, due_date, reference_number, status } = body

    if (!businessId || !financial_year || !type || amount === undefined) {
      return NextResponse.json({ error: 'businessId, financial_year, type, and amount are required' }, { status: 400 })
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Must be one of: ' + VALID_TYPES.join(', ') }, { status: 400 })
    }

    const entryStatus = status && VALID_STATUSES.includes(status) ? status : 'pending'

    const result = await db.insert(
      `INSERT INTO tax_entries (user_id, business_id, financial_year, quarter, month, type, amount, description, status, due_date, reference_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        parseInt(businessId, 10),
        financial_year,
        quarter ?? null,
        month ?? null,
        type,
        parseFloat(amount) || 0,
        description ?? null,
        entryStatus,
        due_date ?? null,
        reference_number ?? null,
      ],
    )

    const entry = await db.get<Record<string, unknown>>(
      'SELECT * FROM tax_entries WHERE id = ?',
      [result.lastInsertRowid],
    )

    return NextResponse.json(entry, { status: 201 })
  } catch (err) {
    console.error('Tax entries POST error:', err)
    return NextResponse.json({ error: 'Failed to create tax entry' }, { status: 500 })
  }
}

/**
 * PUT /api/tax/entries
 *
 * Update a tax entry by id (passed in body).
 * Body: { id, amount?, description?, status?, due_date?, paid_date?, reference_number? }
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, amount, description, status, due_date, paid_date, reference_number } = body

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Verify ownership
    const existing = await db.get<{ user_id: number }>(
      'SELECT user_id FROM tax_entries WHERE id = ?',
      [id],
    )
    if (!existing || existing.user_id !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const sets: string[] = []
    const params: unknown[] = []

    if (amount !== undefined) { sets.push('amount = ?'); params.push(parseFloat(amount) || 0) }
    if (description !== undefined) { sets.push('description = ?'); params.push(description) }
    if (status !== undefined && VALID_STATUSES.includes(status)) { sets.push('status = ?'); params.push(status) }
    if (due_date !== undefined) { sets.push('due_date = ?'); params.push(due_date) }
    if (paid_date !== undefined) { sets.push('paid_date = ?'); params.push(paid_date) }
    if (reference_number !== undefined) { sets.push('reference_number = ?'); params.push(reference_number) }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    sets.push("updated_at = datetime('now')")
    params.push(id)

    await db.run(`UPDATE tax_entries SET ${sets.join(', ')} WHERE id = ?`, params)

    const updated = await db.get<Record<string, unknown>>(
      'SELECT * FROM tax_entries WHERE id = ?',
      [id],
    )

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Tax entries PUT error:', err)
    return NextResponse.json({ error: 'Failed to update tax entry' }, { status: 500 })
  }
}

/**
 * DELETE /api/tax/entries
 *
 * Delete a tax entry by id (query param).
 * ?id=N
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const existing = await db.get<{ user_id: number }>(
      'SELECT user_id FROM tax_entries WHERE id = ?',
      [parseInt(id, 10)],
    )
    if (!existing || existing.user_id !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await db.run('DELETE FROM tax_entries WHERE id = ?', [parseInt(id, 10)])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Tax entries DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete tax entry' }, { status: 500 })
  }
}
