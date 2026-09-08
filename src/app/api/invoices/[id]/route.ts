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

/**
 * GET /api/invoices/[id]
 * Get a single invoice by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const invoiceId = parseInt(params.id, 10)
    if (isNaN(invoiceId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const invoice = await db.get<Record<string, unknown>>(
      'SELECT * FROM invoices WHERE id = ? AND user_id = ?',
      [invoiceId, userId]
    )
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    // Fetch invoice settings for branding
    const settings = await db.get<Record<string, unknown>>(
      'SELECT * FROM invoice_settings WHERE user_id = ?',
      [userId]
    )

    return NextResponse.json({
      invoice: {
        ...invoice,
        items: typeof invoice.items === 'string' ? JSON.parse(invoice.items as string) : invoice.items,
      },
      settings: settings || null,
    })
  } catch (err) {
    console.error('Invoice GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 })
  }
}

/**
 * PUT /api/invoices/[id]
 * Update an invoice. Only allowed if status is 'draft'.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const invoiceId = parseInt(params.id, 10)
    if (isNaN(invoiceId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const existing = await db.get<{ id: number; status: string }>(
      'SELECT id, status FROM invoices WHERE id = ? AND user_id = ?',
      [invoiceId, userId]
    )
    if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const body = await request.json()

    // If marking as paid directly
    if (body.status === 'paid') {
      await db.run(
        `UPDATE invoices SET status = 'paid', paid_date = datetime('now'), paid_amount = total,
         updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
        [invoiceId, userId]
      )
      const updated = await db.get<Record<string, unknown>>(
        'SELECT * FROM invoices WHERE id = ?', [invoiceId]
      )
      return NextResponse.json({
        invoice: updated
          ? { ...updated, items: typeof updated.items === 'string' ? JSON.parse(updated.items as string) : updated.items }
          : null,
      })
    }

    // If cancelling
    if (body.status === 'cancelled') {
      await db.run(
        "UPDATE invoices SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND user_id = ?",
        [invoiceId, userId]
      )
      const updated = await db.get<Record<string, unknown>>(
        'SELECT * FROM invoices WHERE id = ?', [invoiceId]
      )
      return NextResponse.json({
        invoice: updated
          ? { ...updated, items: typeof updated.items === 'string' ? JSON.parse(updated.items as string) : updated.items }
          : null,
      })
    }

    // Full edit only allowed for drafts
    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft invoices can be edited' }, { status: 400 })
    }

    const {
      client_name,
      client_email,
      client_address,
      items,
      subtotal,
      tax_rate,
      tax_amount,
      discount_amount,
      total,
      currency,
      due_date,
      notes,
      terms,
    } = body

    await db.run(
      `UPDATE invoices SET
        client_name = COALESCE(?, client_name),
        client_email = COALESCE(?, client_email),
        client_address = COALESCE(?, client_address),
        items = COALESCE(?, items),
        subtotal = COALESCE(?, subtotal),
        tax_rate = COALESCE(?, tax_rate),
        tax_amount = COALESCE(?, tax_amount),
        discount_amount = COALESCE(?, discount_amount),
        total = COALESCE(?, total),
        currency = COALESCE(?, currency),
        due_date = COALESCE(?, due_date),
        notes = COALESCE(?, notes),
        terms = COALESCE(?, terms),
        updated_at = datetime('now')
      WHERE id = ? AND user_id = ?`,
      [
        client_name || null,
        client_email !== undefined ? client_email : null,
        client_address !== undefined ? client_address : null,
        items ? JSON.stringify(items) : null,
        subtotal != null ? subtotal : null,
        tax_rate != null ? tax_rate : null,
        tax_amount != null ? tax_amount : null,
        discount_amount != null ? discount_amount : null,
        total != null ? total : null,
        currency || null,
        due_date !== undefined ? due_date : null,
        notes !== undefined ? notes : null,
        terms !== undefined ? terms : null,
        invoiceId,
        userId,
      ]
    )

    const updated = await db.get<Record<string, unknown>>(
      'SELECT * FROM invoices WHERE id = ?', [invoiceId]
    )

    return NextResponse.json({
      invoice: updated
        ? { ...updated, items: typeof updated.items === 'string' ? JSON.parse(updated.items as string) : updated.items }
        : null,
    })
  } catch (err) {
    console.error('Invoice PUT error:', err)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}

/**
 * DELETE /api/invoices/[id]
 * Delete an invoice. Only allowed if status is 'draft'.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const invoiceId = parseInt(params.id, 10)
    if (isNaN(invoiceId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const existing = await db.get<{ id: number; status: string }>(
      'SELECT id, status FROM invoices WHERE id = ? AND user_id = ?',
      [invoiceId, userId]
    )
    if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft invoices can be deleted' }, { status: 400 })
    }

    await db.run('DELETE FROM invoices WHERE id = ? AND user_id = ?', [invoiceId, userId])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Invoice DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
}
