import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'

/**
 * GET /api/portal/[token]
 * PUBLIC endpoint — no auth required.
 * Looks up an invoice by its share_token and returns it for the client portal.
 * Also marks the invoice as 'viewed' if it was previously 'sent'.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const shareToken = params.token
    if (!shareToken || shareToken.length < 10) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    const invoice = await db.get<Record<string, unknown>>(
      'SELECT * FROM invoices WHERE share_token = ?',
      [shareToken]
    )

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Mark as viewed if currently 'sent'
    if (invoice.status === 'sent') {
      await db.run(
        "UPDATE invoices SET status = 'viewed', updated_at = datetime('now') WHERE id = ?",
        [invoice.id]
      )
      invoice.status = 'viewed'
    }

    // Fetch branding settings for the invoice owner
    const settings = await db.get<Record<string, unknown>>(
      'SELECT business_name, logo_url, address, email, phone, bank_details FROM invoice_settings WHERE user_id = ?',
      [invoice.user_id]
    )

    // Parse items JSON
    const parsedItems = typeof invoice.items === 'string'
      ? JSON.parse(invoice.items as string)
      : invoice.items

    return NextResponse.json({
      invoice: {
        invoice_number: invoice.invoice_number,
        client_name: invoice.client_name,
        client_email: invoice.client_email,
        client_address: invoice.client_address,
        items: parsedItems,
        subtotal: invoice.subtotal,
        tax_rate: invoice.tax_rate,
        tax_amount: invoice.tax_amount,
        discount_amount: invoice.discount_amount,
        total: invoice.total,
        currency: invoice.currency,
        status: invoice.status,
        due_date: invoice.due_date,
        paid_date: invoice.paid_date,
        paid_amount: invoice.paid_amount,
        payment_link: invoice.payment_link,
        notes: invoice.notes,
        terms: invoice.terms,
        created_at: invoice.created_at,
      },
      business: settings || {
        business_name: 'Business',
        logo_url: null,
        address: null,
        email: null,
        phone: null,
        bank_details: null,
      },
    })
  } catch (err) {
    console.error('Portal GET error:', err)
    return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 })
  }
}
