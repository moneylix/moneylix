import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'

/**
 * GET /api/bank/sync-status
 *
 * Returns a comprehensive sync status snapshot for the authenticated user:
 * - Connection health (status, bank name, masked account)
 * - Last sync time and last sync error
 * - Consent validity window and expiry countdown
 * - Total transactions imported and uncategorised count
 * - Next allowed sync time (derived from frequency_value + frequency_unit)
 * - Last 5 audit-log entries for bank_sync category (sync history)
 *
 * Auth: Bearer token → sessions table (same pattern as all other bank routes)
 */

// How long one "frequency unit" is in milliseconds
const UNIT_MS: Record<string, number> = {
  HOUR:  60 * 60 * 1000,
  DAY:   24 * 60 * 60 * 1000,
  WEEK:  7  * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  YEAR:  365 * 24 * 60 * 60 * 1000,
}

function computeNextSyncAt(
  lastSyncedAt: string | null,
  frequencyValue: number,
  frequencyUnit: string,
): string | null {
  if (!lastSyncedAt) return null
  const unitMs = UNIT_MS[frequencyUnit?.toUpperCase()] ?? UNIT_MS.MONTH
  const intervalMs = frequencyValue * unitMs
  const next = new Date(lastSyncedAt).getTime() + intervalMs
  return new Date(next).toISOString()
}

function consentHealthStatus(
  status: string,
  consentExpiry: string | null,
): 'healthy' | 'expiring_soon' | 'expired' | 'disconnected' | 'pending' {
  if (status === 'pending') return 'pending'
  if (status !== 'active') return 'disconnected'
  if (!consentExpiry) return 'healthy'

  const msLeft = new Date(consentExpiry).getTime() - Date.now()
  if (msLeft <= 0) return 'expired'
  if (msLeft < 30 * 24 * 60 * 60 * 1000) return 'expiring_soon' // < 30 days
  return 'healthy'
}

export async function GET(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session = await dbQuery.get<{ user_id: number }>(
      "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
      [token],
    )
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user_id

    // ── Active / most-recent connection ───────────────────────────────────
    const connection = await dbQuery.get<{
      id: number
      status: string
      bank_name: string | null
      masked_account_number: string | null
      account_type: string | null
      fip_id: string | null
      consent_id: string | null
      consent_start: string | null
      consent_expiry: string | null
      frequency_unit: string | null
      frequency_value: number | null
      last_synced_at: string | null
      last_sync_error: string | null
      created_at: string
    }>(
      `SELECT id, status, bank_name, masked_account_number, account_type, fip_id,
              consent_id, consent_start, consent_expiry,
              frequency_unit, frequency_value,
              last_synced_at, last_sync_error, created_at
       FROM bank_connections
       WHERE user_id = ?
       ORDER BY
         CASE status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
         created_at DESC
       LIMIT 1`,
      [userId],
    )

    // ── No connection at all ──────────────────────────────────────────────
    if (!connection) {
      return NextResponse.json({
        connected: false,
        connectionStatus: 'none',
        healthStatus: 'disconnected',
        bankName: null,
        maskedAccount: null,
        accountType: null,
        lastSyncedAt: null,
        lastSyncError: null,
        consentExpiry: null,
        consentDaysRemaining: null,
        consentStart: null,
        nextAllowedSyncAt: null,
        totalTransactions: 0,
        uncategorisedCount: 0,
        recentSyncHistory: [],
      })
    }

    // ── Transaction counts ────────────────────────────────────────────────
    const totalRow = await dbQuery.get<{ total: number }>(
      'SELECT COUNT(*) AS total FROM bank_transactions WHERE bank_connection_id = ? AND ignored = 0',
      [connection.id],
    )
    const uncatRow = await dbQuery.get<{ total: number }>(
      'SELECT COUNT(*) AS total FROM bank_transactions WHERE bank_connection_id = ? AND is_categorised = 0 AND ignored = 0',
      [connection.id],
    )

    const totalTransactions  = totalRow?.total  ?? 0
    const uncategorisedCount = uncatRow?.total  ?? 0

    // ── Next allowed sync time ────────────────────────────────────────────
    const freqUnit  = connection.frequency_unit  ?? 'MONTH'
    const freqValue = connection.frequency_value ?? 1
    const nextAllowedSyncAt = computeNextSyncAt(
      connection.last_synced_at,
      freqValue,
      freqUnit,
    )

    // Can the user sync right now?
    const canSyncNow = !nextAllowedSyncAt || new Date(nextAllowedSyncAt).getTime() <= Date.now()

    // ── Consent countdown ─────────────────────────────────────────────────
    let consentDaysRemaining: number | null = null
    if (connection.consent_expiry) {
      const msLeft = new Date(connection.consent_expiry).getTime() - Date.now()
      consentDaysRemaining = Math.max(0, Math.floor(msLeft / (24 * 60 * 60 * 1000)))
    }

    // ── Sync history: last 5 DATA_FETCHED / bank_sync audit events ────────
    // We query audit_logs; if the table doesn't exist yet we return an empty list
    const recentSyncHistory = await dbQuery.all<{
      id: number
      action: string
      description: string | null
      status: string
      error_message: string | null
      created_at: string
    }>(
      `SELECT id, action, description, status, error_message, created_at
       FROM audit_logs
       WHERE user_id = ? AND category = 'bank_sync'
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId],
    ) ?? []

    // ── Health status ─────────────────────────────────────────────────────
    const healthStatus = consentHealthStatus(connection.status, connection.consent_expiry)

    // ── Response ──────────────────────────────────────────────────────────
    return NextResponse.json({
      connected:     connection.status === 'active',
      connectionId:  connection.id,
      connectionStatus: connection.status,          // 'active' | 'pending' | 'revoked' | 'expired' | 'paused'
      healthStatus,                                  // 'healthy' | 'expiring_soon' | 'expired' | 'disconnected' | 'pending'

      // Bank identity
      bankName:      connection.bank_name,
      maskedAccount: connection.masked_account_number,
      accountType:   connection.account_type,
      fipId:         connection.fip_id,

      // Sync timing
      lastSyncedAt:     connection.last_synced_at,
      lastSyncError:    connection.last_sync_error,
      nextAllowedSyncAt,
      canSyncNow,
      syncFrequency: {
        value: freqValue,
        unit:  freqUnit,
      },

      // Consent window
      consentStart:         connection.consent_start,
      consentExpiry:        connection.consent_expiry,
      consentDaysRemaining,

      // Counts
      totalTransactions,
      uncategorisedCount,

      // Last 5 sync events from audit log
      recentSyncHistory,
    })
  } catch (err) {
    console.error('[bank/sync-status] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch sync status. Please try again.' },
      { status: 500 },
    )
  }
}
