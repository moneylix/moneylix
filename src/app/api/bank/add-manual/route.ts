import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { lookupIFSC, IFSC_REGEX } from '@/lib/ifsc'
import crypto from 'crypto'

/**
 * POST /api/bank/add-manual
 *
 * Manually registers a bank account using its account number and IFSC code.
 * The bank name and branch are fetched from the IFSC code (via Razorpay's
 * public IFSC directory) rather than entered by the user.
 *
 * Body: { accountNumber: string, ifscCode: string, accountType?: string }
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
        { error: 'You already have an active bank connection. Disconnect it first to add a new account.' },
        { status: 409 }
      )
    }

    const body = await request.json()
    const accountNumber = String(body.accountNumber || '').trim()
    const ifscCode = String(body.ifscCode || '').trim().toUpperCase()
    const accountType = String(body.accountType || 'SAVINGS').toUpperCase()

    if (!/^\d{9,18}$/.test(accountNumber)) {
      return NextResponse.json({ error: 'Enter a valid account number (9-18 digits)' }, { status: 400 })
    }

    if (!IFSC_REGEX.test(ifscCode)) {
      return NextResponse.json({ error: 'Enter a valid 11-character IFSC code' }, { status: 400 })
    }

    // Fetch real bank name and branch from the IFSC code
    const ifscDetails = await lookupIFSC(ifscCode)
    if (!ifscDetails) {
      return NextResponse.json({ error: 'Could not find a bank for that IFSC code' }, { status: 404 })
    }

    const masked = `XXXX${accountNumber.slice(-4)}`
    const consentId = `manual-${crypto.randomUUID()}`

    await dbQuery.run(
      `INSERT INTO bank_connections (
         user_id, consent_id, status, fip_id, account_type, masked_account_number,
         bank_name, ifsc_code, branch_name, consent_start, created_at, updated_at
       ) VALUES (?, ?, 'active', 'MANUAL', ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
      [userId, consentId, accountType, masked, ifscDetails.bank, ifscDetails.ifsc, ifscDetails.branch]
    )

    return NextResponse.json({
      success: true,
      bankName: ifscDetails.bank,
      branch: ifscDetails.branch,
      maskedAccount: masked,
    })
  } catch (err) {
    console.error('[bank/add-manual] Error:', err)
    return NextResponse.json({ error: 'Failed to add bank account. Please try again.' }, { status: 500 })
  }
}
