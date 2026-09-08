import { NextRequest, NextResponse } from 'next/server'
import razorpay from '@/lib/razorpay'

// Pricing in INR (paise = amount × 100)
const PLAN_PRICING: Record<string, Record<string, number>> = {
  pro: {
    monthly:    199,
    halfyearly: 999,
    annual:     1788,
  },
  premium: {
    monthly:    499,
    halfyearly: 2499,
    annual:     3588,
  },
}

export async function POST(request: NextRequest) {
  try {
    const { plan, userId, billing = 'monthly' } = await request.json()

    if (!plan || !['pro', 'premium'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 })
    }
    if (!['monthly', 'halfyearly', 'annual'].includes(billing)) {
      return NextResponse.json({ error: 'Invalid billing cycle' }, { status: 400 })
    }
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const amount = PLAN_PRICING[plan][billing] * 100 // convert to paise

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `receipt_${userId}_${Date.now()}`,
      notes: { userId: userId.toString(), plan, billing }
    })

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    })
  } catch (error) {
    console.error('Razorpay Create Order Error:', error)
    return NextResponse.json({ error: 'Failed to initialize payment gateway' }, { status: 500 })
  }
}
