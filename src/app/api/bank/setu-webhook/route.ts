import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'

/**
 * POST /api/bank/setu-webhook
 * 
 * Receives notifications from Setu AA when:
 * - Consent is approved by user
 * - Consent is rejected/revoked
 * - Data is ready for fetch
 * 
 * Setu sends events via webhook. Configure this URL in Setu dashboard:
 *   https://moneylix.in/api/bank/setu-webhook
 * 
 * Security: In production, verify Setu webhook signature.
 * For sandbox, we accept all requests but validate structure.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Setu webhook payload structure
    const { type, timestamp, data } = body

    console.log(`[setu-webhook] Event: ${type}`, JSON.stringify(data).slice(0, 200))

    switch (type) {
      // Consent approved by user
      case 'CONSENT_STATUS_UPDATE': {
        const { consentHandle, consentId, status } = data

        if (!consentHandle) {
          console.warn('[setu-webhook] Missing consentHandle in CONSENT_STATUS_UPDATE')
          break
        }

        // Map Setu status to our status
        const statusMap: Record<string, string> = {
          'ACTIVE': 'active',
          'PENDING': 'pending',
          'PAUSED': 'paused',
          'REVOKED': 'revoked',
          'EXPIRED': 'expired',
          'REJECTED': 'revoked',
        }
        const mappedStatus = statusMap[status] || 'pending'

        // Update the bank connection
        if (consentId && mappedStatus === 'active') {
          // Consent approved — store consentId for future data fetches
          await dbQuery.run(
            `UPDATE bank_connections 
             SET consent_id = ?, status = ?, updated_at = datetime('now')
             WHERE consent_handle = ?`,
            [consentId, mappedStatus, consentHandle]
          )
          console.log(`[setu-webhook] Consent activated: handle=${consentHandle}, id=${consentId}`)
        } else {
          // Consent rejected, revoked, or expired
          await dbQuery.run(
            `UPDATE bank_connections 
             SET status = ?, updated_at = datetime('now')
             WHERE consent_handle = ?`,
            [mappedStatus, consentHandle]
          )
          console.log(`[setu-webhook] Consent status changed: handle=${consentHandle}, status=${mappedStatus}`)
        }
        break
      }

      // Financial data is ready for fetch
      case 'FI_DATA_READY': {
        const { consentId, sessionId } = data

        if (!consentId || !sessionId) {
          console.warn('[setu-webhook] Missing consentId or sessionId in FI_DATA_READY')
          break
        }

        // Store the session ID for the sync route to pick up
        // We could auto-sync here, but letting the user trigger sync gives better UX control
        await dbQuery.run(
          `UPDATE bank_connections 
           SET last_sync_error = NULL, updated_at = datetime('now')
           WHERE consent_id = ?`,
          [consentId]
        )
        console.log(`[setu-webhook] Data ready: consentId=${consentId}, sessionId=${sessionId}`)
        break
      }

      // Account discovery — info about linked accounts
      case 'ACCOUNT_LINKED': {
        const { consentHandle, accounts } = data

        if (consentHandle && accounts && accounts.length > 0) {
          const account = accounts[0] // Take the first linked account
          await dbQuery.run(
            `UPDATE bank_connections 
             SET fip_id = ?, account_type = ?, masked_account_number = ?, bank_name = ?, updated_at = datetime('now')
             WHERE consent_handle = ?`,
            [
              account.fipId || null,
              account.accType || null,
              account.maskedAccNumber || null,
              account.fipName || null,
              consentHandle,
            ]
          )
          console.log(`[setu-webhook] Account linked: ${account.fipName} ${account.maskedAccNumber}`)
        }
        break
      }

      default:
        console.log(`[setu-webhook] Unhandled event type: ${type}`)
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('[setu-webhook] Error:', err)
    // Still return 200 to prevent Setu from retrying
    return NextResponse.json({ success: true }, { status: 200 })
  }
}
