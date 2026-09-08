import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import db from '@/lib/db.async'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-razorpay-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing Signature' }, { status: 400 })
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || ''
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex')

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: 'Invalid Signature' }, { status: 400 })
    }

    const event = JSON.parse(rawBody)

    switch (event.event) {
      case 'payment.captured': {
        console.log('[webhook] Payment captured:', event.payload.payment.entity.id)

        // Auto-confirm invoice payments via payment links
        const payment = event.payload.payment.entity
        const invoiceId = payment?.notes?.invoice_id
        const invoiceNumber = payment?.notes?.invoice_number

        if (invoiceId) {
          const invoice = await db.get<{ id: number; user_id: number; total: number; status: string }>(
            'SELECT id, user_id, total, status FROM invoices WHERE id = ?',
            [parseInt(invoiceId)]
          )

          if (invoice && invoice.status !== 'paid') {
            const paidAmount = (payment.amount || 0) / 100 // Razorpay sends paise

            await db.run(
              `UPDATE invoices SET
                status = 'paid',
                paid_date = datetime('now'),
                paid_amount = ?,
                updated_at = datetime('now')
               WHERE id = ?`,
              [paidAmount, invoice.id]
            )

            // Create a credit transaction for the payment
            await db.run(
              `INSERT INTO transactions (type, amount, category_id, business_id, currency, date, note, method, status, client_name)
               SELECT 'credit', ?, COALESCE((SELECT id FROM categories WHERE type IN ('credit','both') LIMIT 1), 1),
                      i.business_id, i.currency, date('now'),
                      'Payment for Invoice ' || i.invoice_number, 'razorpay', 'completed', i.client_name
               FROM invoices i WHERE i.id = ?`,
              [paidAmount, invoice.id]
            )

            console.log(`[webhook] Invoice ${invoiceNumber || invoiceId} marked as paid — ₹${paidAmount}`)
          }
        }
        break
      }

      case 'subscription.activated':
      case 'subscription.charged': {
        const sub = event.payload.subscription?.entity
        const userId = sub?.notes?.userId
        if (userId) {
          await db.run(
            `UPDATE subscriptions SET status = 'active', updated_at = datetime('now') WHERE user_id = ? AND status != 'active'`,
            [parseInt(userId)]
          )
          console.log(`[webhook] ${event.event} — user ${userId} activated`)
        }
        break
      }

      case 'subscription.cancelled':
      case 'payment.failed': {
        const subEntity = event.payload.subscription?.entity
        const payEntity = event.payload.payment?.entity
        const userId = subEntity?.notes?.userId ?? payEntity?.notes?.userId
        if (userId) {
          await db.run(
            `UPDATE subscriptions SET status = 'cancelled', updated_at = datetime('now') WHERE user_id = ?`,
            [parseInt(userId)]
          )
          console.warn(`[webhook] ${event.event} — user ${userId} cancelled/failed`)
        }
        break
      }

      default:
        console.log(`[webhook] Unhandled event: ${event.event}`)
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[webhook] Handler error:', error)
    return NextResponse.json({ error: 'Webhook Handler Failed' }, { status: 500 })
  }
}
