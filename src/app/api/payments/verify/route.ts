import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import db from '@/lib/db.async'
import { sendPlanUpgradeEmail } from '@/lib/email/resend'

const BILLING_DAYS: Record<string, number> = {
  monthly:    30,
  halfyearly: 180,
  annual:     365,
}

const BILLING_AMOUNTS: Record<string, Record<string, number>> = {
  pro:     { monthly: 199, halfyearly: 999,  annual: 1788 },
  premium: { monthly: 499, halfyearly: 2499, annual: 3588 },
}

export async function POST(request: NextRequest) {
  try {
    const {
      razorpay_order_id, razorpay_payment_id, razorpay_signature,
      userId, plan, billing = 'monthly'
    } = await request.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId || !plan) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || ''
    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex')

    if (generated_signature !== razorpay_signature) {
      return NextResponse.json({ error: 'Payment signature mismatch' }, { status: 400 })
    }

    const days = BILLING_DAYS[billing] ?? 30
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + days)
    const expiryIso = expiryDate.toISOString()

    const user = await db.get<{ id: number; email: string }>('SELECT id, email FROM users WHERE id = ?', [parseInt(userId)])

    if (user) {
      const amountPaid = BILLING_AMOUNTS[plan]?.[billing] ?? (plan === 'premium' ? 499 : 199)
      const notes = `Billing: ${billing} | Order: ${razorpay_order_id} | Payment: ${razorpay_payment_id}`

      await db.run(`
        INSERT INTO subscriptions (user_id, plan, status, expires_at, amount_paid, payment_method, notes)
        VALUES (?, ?, 'active', ?, ?, 'razorpay', ?)
      `, [user.id, plan, expiryIso, amountPaid, notes])

      await sendPlanUpgradeEmail(user.email, plan, expiryDate)
    }

    return NextResponse.json({ success: true, message: 'Payment verified and plan upgraded.' })
  } catch (error) {
    console.error('Razorpay Verify Error:', error)
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 })
  }
}
