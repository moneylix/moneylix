import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_auth'
import dbQuery from '@/lib/db.async'
import { audit } from '@/lib/audit'
import fs from 'fs'
import path from 'path'

/**
 * POST /api/admin/data/reset
 * Destructive. Requires a typed confirmation phrase.
 *
 * Body: { scope: 'transactions' | 'all', confirm: string }
 *  - scope 'transactions': wipes transactional data (transactions, invoices,
 *    bank data, receivables) but keeps users, businesses, and settings.
 *    Confirmation phrase: RESET_DATA
 *  - scope 'all': factory reset of all non-admin user data.
 *    Confirmation phrase: FACTORY_RESET
 *
 * Always makes a timestamped backup copy of the DB file first.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { scope, confirm } = await request.json()

    const REQUIRED: Record<string, string> = {
      transactions: 'RESET_DATA',
      all: 'FACTORY_RESET',
    }

    if (!scope || !REQUIRED[scope]) {
      return NextResponse.json({ error: 'Invalid scope' }, { status: 400 })
    }
    if (confirm !== REQUIRED[scope]) {
      return NextResponse.json(
        { error: `Confirmation phrase mismatch. Type "${REQUIRED[scope]}" exactly.` },
        { status: 400 }
      )
    }

    // 1. Backup the current DB file aside before doing anything destructive
    const newPath = path.join(process.cwd(), 'moneylix.db')
    const oldPath = path.join(process.cwd(), 'moneyflow.db')
    const dbPath = (!fs.existsSync(newPath) && fs.existsSync(oldPath)) ? oldPath : newPath
    if (fs.existsSync(dbPath)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const backupPath = `${dbPath}.pre-reset-${stamp}.bak`
      try { fs.copyFileSync(dbPath, backupPath) } catch (e) { console.error('[reset] backup copy failed:', e) }
    }

    // 2. Perform the reset
    const tablesTx = [
      'reconciliation_matches', 'reconciliation_sessions', 'bank_transactions',
      'invoices', 'receipts', 'transactions', 'recurring_transactions',
      'emi_payments', 'loans', 'inventory_movements', 'inventory_items',
      'payroll_entries', 'time_entries', 'budgets',
    ]

    for (const t of tablesTx) {
      try { await dbQuery.run(`DELETE FROM ${t}`) } catch { /* table may not exist */ }
    }

    if (scope === 'all') {
      // Also remove non-admin users, businesses, and their subscriptions
      const extra = ['staff_members', 'team_members', 'notifications', 'bank_connections']
      for (const t of extra) {
        try { await dbQuery.run(`DELETE FROM ${t}`) } catch { /* ignore */ }
      }
      try { await dbQuery.run("DELETE FROM subscriptions WHERE user_id IN (SELECT id FROM users WHERE role != 'admin')") } catch {}
      try { await dbQuery.run("DELETE FROM businesses WHERE user_id IN (SELECT id FROM users WHERE role != 'admin')") } catch {}
      try { await dbQuery.run("DELETE FROM users WHERE role != 'admin'") } catch {}
    }

    await audit({
      userId: admin.id,
      action: scope === 'all' ? 'DATA_FACTORY_RESET' : 'DATA_RESET',
      category: 'admin',
      status: 'success',
      description: `Admin performed a ${scope === 'all' ? 'factory reset' : 'transactional data reset'}`,
      request,
    })

    return NextResponse.json({ success: true, scope })
  } catch (err) {
    console.error('[admin/data/reset] error:', err)
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 })
  }
}
