import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import razorpay from '@/lib/razorpay'

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
 * POST /api/invoices/[id]/payment-link
 * Generate a Razorpay payment link for the invoice amount and store it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const invoiceId = parseInt(params.id, 10)
    if (isNaN(invoiceId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const invoice = await db.get<{
      id: number
      user_id: number
      invoice_number: string
      client_name: string
      client_email: string | null
      total: number
      currency: string
      due_date: string | null
      payment_link: string | null
      status: string
    }>(
      'SELECT * FROM invoices WHERE id = ? AND user_id = ?',
      [invoiceId, userId]
    )

    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    if (invoice.payment_link) {
      return NextResponse.json({ payment_link: invoice.payment_link, message: 'Payment link already exists' })
    }

    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot generate payment link for paid/cancelled invoice' }, { status: 400 })
    }

    const settings = await db.get<{ business_name: string | null }>(
      'SELECT business_name FROM invoice_settings WHERE user_id = ?',
      [userId]
    )

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moneylix.in'

    // Create Razorpay Payment Link
    const paymentLink = await (razorpay as any).paymentLink.create({
      amount: Math.round(invoice.total * 100), // Razorpay expects paise
      currency: invoice.currency || 'INR',
      accept_partial: false,
      description: `Invoice ${invoice.invoice_number} - ${settings?.business_name || 'Moneylix'}`,
      customer: {
        name: invoice.client_name,
        email: invoice.client_email || undefined,
      },
      notify: {
        sms: false,
        email: !!invoice.client_email,
      },
      reminder_enable: true,
      notes: {
        invoice_id: String(invoice.id),
        invoice_number: invoice.invoice_number,
        user_id: String(userId),
      },
      callback_url: `${appUrl}/api/invoices/${invoice.id}/payment-callback`,
      callback_method: 'get',
      expire_by: invoice.due_date
        ? Math.floor(new Date(invoice.due_date + 'T23:59:59').getTime() / 1000)
        : Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days default
    })

    const linkUrl = paymentLink.short_url || paymentLink.url || ''
    const linkId = paymentLink.id || ''

    await db.run(
      "UPDATE invoices SET payment_link = ?, razorpay_payment_link_id = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
      [linkUrl, linkId, invoiceId, userId]
    )

    return NextResponse.json({ payment_link: linkUrl, razorpay_id: linkId })
  } catch (err) {
    console.error('Payment link creation error:', err)
    return NextResponse.json({ error: 'Failed to create payment link' }, { status: 500 })
  }
}
