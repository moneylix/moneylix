import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { getConsentStatus } from '@/lib/setu/client'

/**
 * GET /api/bank/consent-status
 * 
 * Checks the current consent status for the authenticated user.
 * Frontend polls this after redirect from Setu consent approval page.
 * 
 * Returns the latest bank connection status from our DB,
 * and optionally refreshes from Setu if it's still pending.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session = await dbQuery.get<{ user_id: number }>(
      "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
      [token]
    )
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get the most recent connection
    const connection = await dbQuery.get<{
      id: number
      consent_handle: string | null
      consent_id: string | null
      status: string
      bank_name: string | null
      masked_account_number: string | null
      last_synced_at: string | null
    }>(
      `SELECT id, consent_handle, consent_id, status, bank_name, masked_account_number, last_synced_at
       FROM bank_connections WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [session.user_id]
    )

    if (!connection) {
      return NextResponse.json({ connected: false, status: 'none' })
    }

    // If still pending, check with Setu for latest status
    if (connection.status === 'pending' && connection.consent_handle) {
      try {
        const setuStatus = await getConsentStatus(connection.consent_handle)

        if (setuStatus.status === 'ACTIVE' && setuStatus.consentId) {
          // Consent was approved — update DB
          await dbQuery.run(
            `UPDATE bank_connections SET consent_id = ?, status = 'active', updated_at = datetime('now') WHERE id = ?`,
            [setuStatus.consentId, connection.id]
          )
          return NextResponse.json({
            connected: true,
            status: 'active',
            bankName: connection.bank_name,
            maskedAccount: connection.masked_account_number,
            lastSyncedAt: connection.last_synced_at,
          })
        } else if (['REVOKED', 'REJECTED', 'EXPIRED'].includes(setuStatus.status)) {
          await dbQuery.run(
            "UPDATE bank_connections SET status = 'revoked', updated_at = datetime('now') WHERE id = ?",
            [connection.id]
          )
          return NextResponse.json({ connected: false, status: 'revoked' })
        }
      } catch (err) {
        console.warn('[bank/consent-status] Failed to check Setu status:', err)
        // Fall through and return DB status
      }
    }

    return NextResponse.json({
      connected: connection.status === 'active',
      status: connection.status,
      bankName: connection.bank_name,
      maskedAccount: connection.masked_account_number,
      lastSyncedAt: connection.last_synced_at,
      connectionId: connection.id,
    })
  } catch (err) {
    console.error('[bank/consent-status] Error:', err)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
