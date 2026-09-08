import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { createConsent, isSetuConfigured } from '@/lib/setu/client'
import { audit, AUDIT_ACTIONS } from '@/lib/audit'
import crypto from 'crypto'

/**
 * POST /api/bank/create-consent
 *
 * Verifies the OTP sent via /api/bank/send-otp, then initiates a Setu AA
 * consent request for the authenticated user (or, in local/demo mode,
 * simulates an instantly-approved connection to the selected bank).
 *
 * Body: { mobileNumber: "9XXXXXXXXX", bankName: string, otp: string }
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

    const userId = session.user_id

    // Check if user already has an active connection
    const existing = await dbQuery.get<{ id: number }>(
      "SELECT id FROM bank_connections WHERE user_id = ? AND status = 'active'",
      [userId]
    )
    if (existing) {
      return NextResponse.json(
        { error: 'You already have an active bank connection. Revoke it first to connect a new account.' },
        { status: 409 }
      )
    }

    // Parse body
    const body = await request.json()
    const mobileNumber = String(body.mobileNumber || '').trim()
    const bankName = String(body.bankName || '').trim()
    const otp = String(body.otp || '').trim()

    if (!mobileNumber || !/^[6-9]\d{9}$/.test(mobileNumber)) {
      return NextResponse.json(
        { error: 'Please enter a valid 10-digit Indian mobile number' },
        { status: 400 }
      )
    }
    if (!bankName) {
      return NextResponse.json({ error: 'Please select your bank' }, { status: 400 })
    }
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: 'Please enter the 6-digit OTP' }, { status: 400 })
    }

    // Verify OTP issued by /api/bank/send-otp
    const otpRecord = await dbQuery.get<{ id: number }>(
      `SELECT id FROM bank_otp_verifications
       WHERE user_id = ? AND mobile_number = ? AND bank_name = ? AND otp = ?
         AND verified_at IS NULL AND expires_at > datetime('now')
       ORDER BY id DESC LIMIT 1`,
      [userId, mobileNumber, bankName, otp]
    )
    if (!otpRecord) {
      return NextResponse.json({ error: 'Invalid or expired OTP. Please request a new one.' }, { status: 400 })
    }
    await dbQuery.run("UPDATE bank_otp_verifications SET verified_at = datetime('now') WHERE id = ?", [otpRecord.id])

    // No Setu credentials configured — simulate an instantly-approved AA
    // connection to the bank the user selected, so the bank-sync UI can be
    // exercised locally.
    if (!isSetuConfigured()) {
      const consentId = `mock-${crypto.randomUUID()}`
      const consentExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      const masked = `XXXX${mobileNumber.slice(-4)}`

      await dbQuery.run(
        `INSERT INTO bank_connections (
           user_id, consent_id, status, fip_id, account_type, masked_account_number, bank_name,
           consent_start, consent_expiry, created_at, updated_at
         ) VALUES (?, ?, 'active', 'MOCK', 'SAVINGS', ?, ?, datetime('now'), ?, datetime('now'), datetime('now'))`,
        [userId, consentId, masked, bankName, consentExpiry]
      )

      return NextResponse.json({
        success: true,
        mock: true,
        redirectUrl: '/dashboard/settings?bank_consent=success',
      })
    }

    // Create consent with Setu
    const { consentHandle, redirectUrl } = await createConsent(userId, mobileNumber)

    // Save to database
    await dbQuery.run(
      `INSERT INTO bank_connections (user_id, consent_handle, status, created_at, updated_at)
       VALUES (?, ?, 'pending', datetime('now'), datetime('now'))`,
      [userId, consentHandle]
    )

    audit({
      userId,
      action: AUDIT_ACTIONS.CONSENT_CREATED,
      category: 'bank_sync',
      resourceType: 'bank_connection',
      description: `Consent initiated for mobile ${mobileNumber.slice(0, 2)}****${mobileNumber.slice(-2)}`,
      request,
    })

    return NextResponse.json({
      success: true,
      consentHandle,
      redirectUrl, // Frontend opens this URL for user to approve consent
    })
  } catch (err) {
    console.error('[bank/create-consent] Error:', err)
    return NextResponse.json(
      { error: 'Failed to initiate bank connection. Please try again.' },
      { status: 500 }
    )
  }
}
