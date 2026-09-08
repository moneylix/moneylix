import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import crypto from 'crypto'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await db.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token]
  )
  return session?.user_id ?? null
}

/**
 * GET /api/invoices
 * List invoices for user + business with optional filters.
 * Query params: businessId, status, client, startDate, endDate, search, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const status = searchParams.get('status')
    const client = searchParams.get('client')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    let sql = 'SELECT * FROM invoices WHERE user_id = ?'
    const params: unknown[] = [userId]

    if (businessId) {
      sql += ' AND business_id = ?'
      params.push(parseInt(businessId, 10))
    }
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    if (client) {
      sql += ' AND client_name LIKE ?'
      params.push(`%${client}%`)
    }
    if (startDate) {
      sql += ' AND created_at >= ?'
      params.push(startDate)
    }
    if (endDate) {
      sql += ' AND created_at <= ?'
      params.push(endDate + ' 23:59:59')
    }
    if (search) {
      sql += ' AND (client_name LIKE ? OR invoice_number LIKE ? OR notes LIKE ?)'
      const s = `%${search}%`
      params.push(s, s, s)
    }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total')
    const countRow = await db.get<{ total: number }>(countSql, params)
    const total = countRow?.total ?? 0

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const invoices = await db.all<Record<string, unknown>>(sql, params)

    const parsed = invoices.map((inv) => ({
      ...inv,
      items: typeof inv.items === 'string' ? JSON.parse(inv.items as string) : inv.items,
    }))

    return NextResponse.json({ invoices: parsed, total, limit, offset })
  } catch (err) {
    console.error('Invoices GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

/**
 * POST /api/invoices
 * Create a new invoice. Auto-generates invoice_number from settings prefix + counter.
 * Body: { business_id, client_name, client_email?, client_address?, items, subtotal,
 *         tax_rate?, tax_amount?, discount_amount?, total, currency?, due_date?, notes?, terms? }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      business_id,
      client_name,
      client_email,
      client_address,
      items,
      subtotal,
      tax_rate = 0,
      tax_amount = 0,
      discount_amount = 0,
      total,
      currency = 'INR',
      due_date,
      notes,
      terms,
    } = body

    if (!client_name || !items || !Array.isArray(items) || items.length === 0 || total == null) {
      return NextResponse.json({ error: 'client_name, items (array), and total are required' }, { status: 400 })
    }

    // Get or create invoice settings for this user to derive the invoice number
    let settings = await db.get<{ invoice_prefix: string; next_invoice_number: number }>(
      'SELECT invoice_prefix, next_invoice_number FROM invoice_settings WHERE user_id = ?',
      [userId]
    )
    if (!settings) {
      await db.run(
        'INSERT INTO invoice_settings (user_id, invoice_prefix, next_invoice_number) VALUES (?, ?, ?)',
        [userId, 'INV', 1]
      )
      settings = { invoice_prefix: 'INV', next_invoice_number: 1 }
    }

    const paddedNum = String(settings.next_invoice_number).padStart(4, '0')
    const invoiceNumber = `${settings.invoice_prefix}-${paddedNum}`
    const shareToken = crypto.randomBytes(24).toString('hex')

    const result = await db.run(
      `INSERT INTO invoices (
        user_id, business_id, invoice_number, client_name, client_email, client_address,
        items, subtotal, tax_rate, tax_amount, discount_amount, total, currency,
        status, due_date, notes, terms, share_token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
      [
        userId,
        business_id || null,
        invoiceNumber,
        client_name,
        client_email || null,
        client_address || null,
        JSON.stringify(items),
        subtotal,
        tax_rate,
        tax_amount,
        discount_amount,
        total,
        currency,
        due_date || null,
        notes || null,
        terms || null,
        shareToken,
      ]
    )

    // Increment the counter
    await db.run(
      'UPDATE invoice_settings SET next_invoice_number = next_invoice_number + 1 WHERE user_id = ?',
      [userId]
    )

    const newInvoice = await db.get<Record<string, unknown>>(
      'SELECT * FROM invoices WHERE id = ?',
      [result.lastInsertRowid]
    )

    return NextResponse.json({
      invoice: newInvoice
        ? { ...newInvoice, items: JSON.parse(newInvoice.items as string) }
        : null,
    }, { status: 201 })
  } catch (err) {
    console.error('Invoices POST error:', err)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
