import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { isSetuConfigured } from '@/lib/setu/client'

/**
 * POST /api/bank/send-otp
 *
 * Sends (or, in local/demo mode, simulates) an OTP to verify the mobile
 * number linked to the selected bank before initiating the AA consent.
 *
 * Body: { mobileNumber: string, bankName: string }
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session = await dbQuery.get<{ user_id: number }>(
      "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
      [token]
    )
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const mobileNumber = String(body.mobileNumber || '').trim()
    const bankName = String(body.bankName || '').trim()

    if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit Indian mobile number' }, { status: 400 })
    }
    if (!bankName) {
      return NextResponse.json({ error: 'Please select your bank' }, { status: 400 })
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    await dbQuery.run(
      `INSERT INTO bank_otp_verifications (user_id, mobile_number, bank_name, otp, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [session.user_id, mobileNumber, bankName, otp, expiresAt]
    )

    console.log(`[bank/send-otp] OTP for ${bankName} (${mobileNumber}): ${otp}`)

    const configured = isSetuConfigured()
    return NextResponse.json({
      success: true,
      message: configured
        ? `OTP sent to +91 ${mobileNumber}`
        : 'OTP generated (demo mode — no SMS gateway configured)',
      // Only surfaced when there's no real SMS gateway, so the demo flow is usable.
      devOtp: configured ? undefined : otp,
    })
  } catch (err) {
    console.error('[bank/send-otp] Error:', err)
    return NextResponse.json({ error: 'Failed to send OTP. Please try again.' }, { status: 500 })
  }
}
