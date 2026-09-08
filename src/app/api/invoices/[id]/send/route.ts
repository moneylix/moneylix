import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { resend } from '@/lib/email/resend'

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
 * POST /api/invoices/[id]/send
 * Mark invoice as sent and email the client with a share link.
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
      share_token: string
      status: string
      payment_link: string | null
    }>(
      'SELECT * FROM invoices WHERE id = ? AND user_id = ?',
      [invoiceId, userId]
    )

    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (!invoice.client_email) {
      return NextResponse.json({ error: 'Client email is required to send invoice' }, { status: 400 })
    }

    const settings = await db.get<{ business_name: string | null; email: string | null }>(
      'SELECT business_name, email FROM invoice_settings WHERE user_id = ?',
      [userId]
    )

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const portalLink = `${appUrl}/portal/${invoice.share_token}`
    const businessName = settings?.business_name || 'Moneylix User'
    const currencySymbol = invoice.currency === 'INR' ? '₹' : invoice.currency === 'USD' ? '$' : invoice.currency

    await resend.emails.send({
      from: 'Moneylix <noreply@moneylix.in>',
      to: invoice.client_email,
      subject: `Invoice ${invoice.invoice_number} from ${businessName}`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #334155;">
          <h1 style="color: #10b981; margin-bottom: 8px;">Invoice ${invoice.invoice_number}</h1>
          <p style="font-size: 14px; color: #94a3b8; margin-bottom: 24px;">From ${businessName}</p>

          <div style="background-color: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <p style="font-size: 14px; color: #cbd5e1; margin: 0 0 8px;">Hi ${invoice.client_name},</p>
            <p style="font-size: 14px; color: #cbd5e1; margin: 0 0 16px;">
              You have a new invoice for <strong style="color: #ffffff;">${currencySymbol}${invoice.total.toLocaleString('en-IN')}</strong>.
            </p>
            ${invoice.due_date ? `<p style="font-size: 13px; color: #f59e0b; margin: 0;">Due by: ${new Date(invoice.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>` : ''}
          </div>

          <a href="${portalLink}" style="display: inline-block; background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; font-weight: 800; border-radius: 8px; font-size: 16px; margin-bottom: 16px;">
            View Invoice & Pay
          </a>

          ${invoice.payment_link ? `
          <p style="margin-top: 16px;">
            <a href="${invoice.payment_link}" style="color: #38bdf8; font-size: 14px; text-decoration: underline;">
              Or pay directly here →
            </a>
          </p>` : ''}

          <p style="font-size: 12px; color: #64748b; margin-top: 32px;">
            This invoice was sent via <a href="https://moneylix.in" style="color: #38bdf8;">Moneylix</a>.
          </p>
        </div>
      `,
    })

    // Update status to sent
    await db.run(
      "UPDATE invoices SET status = 'sent', updated_at = datetime('now') WHERE id = ? AND user_id = ?",
      [invoiceId, userId]
    )

    return NextResponse.json({ success: true, message: 'Invoice sent successfully' })
  } catch (err) {
    console.error('Invoice send error:', err)
    return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 })
  }
}
