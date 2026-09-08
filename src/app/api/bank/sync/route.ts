import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { createDataSession, fetchSessionData } from '@/lib/setu/client'
import { audit, AUDIT_ACTIONS } from '@/lib/audit'
import crypto from 'crypto'

const MOCK_NARRATIONS: Array<{ type: 'credit' | 'debit'; narration: string; min: number; max: number }> = [
  { type: 'credit', narration: 'SALARY CREDIT - ACME CORP', min: 45000, max: 90000 },
  { type: 'debit', narration: 'SWIGGY ORDER', min: 150, max: 800 },
  { type: 'debit', narration: 'ELECTRICITY BILL PAYMENT', min: 800, max: 2500 },
  { type: 'debit', narration: 'AMAZON SHOPPING', min: 300, max: 4000 },
  { type: 'debit', narration: 'RENT PAYMENT', min: 8000, max: 25000 },
  { type: 'debit', narration: 'UPI-GROCERY STORE', min: 200, max: 1500 },
  { type: 'credit', narration: 'INTEREST CREDIT', min: 50, max: 500 },
]

function generateMockTransactions(count: number) {
  const txns = []
  for (let i = 0; i < count; i++) {
    const pick = MOCK_NARRATIONS[Math.floor(Math.random() * MOCK_NARRATIONS.length)]
    const amount = Math.round(pick.min + Math.random() * (pick.max - pick.min))
    const daysAgo = Math.floor(Math.random() * 30)
    const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    txns.push({
      transactionId: `mock-${crypto.randomUUID()}`,
      type: pick.type === 'credit' ? 'CREDIT' : 'DEBIT',
      amount,
      currentBalance: null,
      transactionTimestamp: `${date}T00:00:00Z`,
      narration: pick.narration,
      reference: null,
    })
  }
  return txns
}

/**
 * POST /api/bank/sync
 * 
 * Triggers a bank transaction sync for the authenticated user.
 * 1. Creates a data session with Setu
 * 2. Fetches transaction data
 * 3. Stores new transactions in bank_transactions table
 * 4. Returns sync summary
 * 
 * Requires an active bank connection with a valid consent_id.
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

    // Get active bank connection
    const connection = await dbQuery.get<{ id: number; consent_id: string; bank_name: string | null }>(
      "SELECT id, consent_id, bank_name FROM bank_connections WHERE user_id = ? AND status = 'active' AND consent_id IS NOT NULL",
      [userId]
    )

    if (!connection) {
      return NextResponse.json(
        { error: 'No active bank connection found. Please connect a bank account first.' },
        { status: 404 }
      )
    }

    // Mock connection (no Setu credentials configured) — generate fake data instead
    if (connection.consent_id.startsWith('mock-')) {
      const mockData = generateMockTransactions(3 + Math.floor(Math.random() * 3))
      let synced = 0

      for (const txn of mockData) {
        const txnDate = txn.transactionTimestamp.split('T')[0]
        const type = txn.type === 'CREDIT' ? 'credit' : 'debit'

        await dbQuery.run(
          `INSERT INTO bank_transactions (
            bank_connection_id, user_id, txn_id, type, amount, currency, date,
            narration, reference, balance_after, is_categorised, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
          [connection.id, userId, txn.transactionId, type, txn.amount, txnDate, txn.narration, txn.reference, txn.currentBalance]
        )
        synced++
      }

      await dbQuery.run(
        "UPDATE bank_connections SET last_synced_at = datetime('now'), last_sync_error = NULL, updated_at = datetime('now') WHERE id = ?",
        [connection.id]
      )

      audit({
        userId,
        action: AUDIT_ACTIONS.DATA_FETCHED,
        category: 'bank_sync',
        resourceType: 'bank_connection',
        resourceId: connection.id,
        description: `Synced ${synced} mock transactions`,
        request,
      })

      return NextResponse.json({
        success: true,
        message: `Synced ${synced} new transaction${synced !== 1 ? 's' : ''}`,
        synced,
        skipped: 0,
        bankName: connection.bank_name,
      })
    }

    // Create a data session with Setu
    let sessionId: string
    try {
      sessionId = await createDataSession(connection.consent_id)
    } catch (err: any) {
      await dbQuery.run(
        "UPDATE bank_connections SET last_sync_error = ?, updated_at = datetime('now') WHERE id = ?",
        [err.message || 'Failed to create data session', connection.id]
      )
      return NextResponse.json(
        { error: 'Failed to request bank data. Your consent may have expired.' },
        { status: 502 }
      )
    }

    // Fetch the data (may need retries in production — data might not be ready immediately)
    let bankData: any[] = []
    let retries = 0
    const maxRetries = 3

    while (retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000 * (retries + 1))) // 2s, 4s, 6s
      try {
        bankData = await fetchSessionData(sessionId)
        if (bankData.length > 0) break
      } catch (err) {
        console.warn(`[bank/sync] Retry ${retries + 1}: data not ready yet`)
      }
      retries++
    }

    if (bankData.length === 0) {
      // Data not ready yet — tell the user to try again in a minute
      return NextResponse.json({
        success: true,
        message: 'Sync initiated. Data is being prepared by your bank. Try again in 1-2 minutes.',
        synced: 0,
        skipped: 0,
      })
    }

    // Process and store transactions
    let synced = 0
    let skipped = 0

    for (const account of bankData) {
      const transactions = account.data || []

      for (const txn of transactions) {
        // Check if we already have this transaction (by txn_id)
        if (txn.transactionId) {
          const existing = await dbQuery.get<{ id: number }>(
            'SELECT id FROM bank_transactions WHERE bank_connection_id = ? AND txn_id = ?',
            [connection.id, txn.transactionId]
          )
          if (existing) {
            skipped++
            continue
          }
        }

        // Parse date from ISO timestamp
        const txnDate = txn.transactionTimestamp
          ? txn.transactionTimestamp.split('T')[0]
          : new Date().toISOString().split('T')[0]

        // Map type
        const type = txn.type === 'CREDIT' ? 'credit' : 'debit'

        // Insert bank transaction
        await dbQuery.run(
          `INSERT INTO bank_transactions (
            bank_connection_id, user_id, txn_id, type, amount, currency, date,
            narration, reference, balance_after, is_categorised, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
          [
            connection.id,
            userId,
            txn.transactionId || null,
            type,
            Math.abs(txn.amount),
            txnDate,
            txn.narration || null,
            txn.reference || null,
            txn.currentBalance ?? null,
          ]
        )
        synced++
      }
    }

    // Update last sync time
    await dbQuery.run(
      "UPDATE bank_connections SET last_synced_at = datetime('now'), last_sync_error = NULL, updated_at = datetime('now') WHERE id = ?",
      [connection.id]
    )

    audit({
      userId,
      action: AUDIT_ACTIONS.DATA_FETCHED,
      category: 'bank_sync',
      resourceType: 'bank_connection',
      resourceId: connection.id,
      description: `Synced ${synced} transactions, skipped ${skipped} duplicates`,
      request,
    })

    return NextResponse.json({
      success: true,
      message: `Synced ${synced} new transaction${synced !== 1 ? 's' : ''}${skipped > 0 ? `, ${skipped} already existed` : ''}`,
      synced,
      skipped,
      bankName: connection.bank_name,
    })
  } catch (err) {
    console.error('[bank/sync] Error:', err)
    return NextResponse.json(
      { error: 'Bank sync failed. Please try again later.' },
      { status: 500 }
    )
  }
}
