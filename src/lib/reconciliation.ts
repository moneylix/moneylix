/**
 * Bank Reconciliation Engine
 *
 * Matches bank-imported transactions (from Setu AA) against manually
 * entered transactions.  Scoring:
 *   - Exact amount match        = 50 pts
 *   - Same date                 = 30 pts
 *   - Date within ±1 day        = 20 pts
 *   - Date within ±2 days       = 10 pts
 *   - Narration ↔ category hit  = 20 pts
 *
 * Thresholds:
 *   ≥ 60 → auto-match
 *   ≥ 40 → suggested (manual review)
 *   < 40 → unmatched
 */

import db from '@/lib/db.async'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BankTxn {
  id: number
  type: 'credit' | 'debit'
  amount: number
  date: string
  narration: string | null
  reference: string | null
  bank_connection_id: number
}

export interface ManualTxn {
  id: number
  type: 'credit' | 'debit'
  amount: number
  date: string
  note: string | null
  method: string | null
  category_name: string | null
}

export interface MatchCandidate {
  bankTxn: BankTxn
  manualTxn: ManualTxn
  score: number
  breakdown: {
    amountScore: number
    dateScore: number
    narrationScore: number
  }
}

export interface ReconciliationResult {
  matched: MatchCandidate[]
  suggested: MatchCandidate[]
  unmatchedBank: BankTxn[]
  unmatchedManual: ManualTxn[]
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00')
  const db2 = new Date(b + 'T00:00:00')
  return Math.abs(Math.round((da.getTime() - db2.getTime()) / 86_400_000))
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

function narrationMatchesCategory(narration: string | null, categoryName: string | null): boolean {
  if (!narration || !categoryName) return false
  const n = normalise(narration)
  const c = normalise(categoryName)
  if (!c) return false
  // Check if any word from category name appears in narration
  const words = c.split(' ').filter(w => w.length > 2)
  return words.some(w => n.includes(w))
}

function scoreMatch(bank: BankTxn, manual: ManualTxn): { score: number; breakdown: { amountScore: number; dateScore: number; narrationScore: number } } {
  let amountScore = 0
  let dateScore = 0
  let narrationScore = 0

  // Types must match
  if (bank.type !== manual.type) {
    return { score: 0, breakdown: { amountScore: 0, dateScore: 0, narrationScore: 0 } }
  }

  // Amount scoring — exact match is 50, very close (<1% diff) is 35
  const diff = Math.abs(bank.amount - manual.amount)
  if (diff === 0) {
    amountScore = 50
  } else if (diff / Math.max(bank.amount, 0.01) < 0.01) {
    amountScore = 35
  } else if (diff / Math.max(bank.amount, 0.01) < 0.05) {
    amountScore = 15
  }

  // Date scoring
  const gap = daysBetween(bank.date, manual.date)
  if (gap === 0) {
    dateScore = 30
  } else if (gap === 1) {
    dateScore = 20
  } else if (gap === 2) {
    dateScore = 10
  }

  // Narration → category name
  if (narrationMatchesCategory(bank.narration, manual.category_name)) {
    narrationScore = 20
  }

  return {
    score: amountScore + dateScore + narrationScore,
    breakdown: { amountScore, dateScore, narrationScore },
  }
}

/* ------------------------------------------------------------------ */
/*  Main engine                                                        */
/* ------------------------------------------------------------------ */

export async function autoMatchTransactions(
  userId: number,
  businessId: number | null,
  bankConnectionId: number,
  periodStart: string,
  periodEnd: string
): Promise<ReconciliationResult> {

  // 1) Fetch bank transactions in the period
  const bankTxns = await db.all<BankTxn>(
    `SELECT id, type, amount, date, narration, reference, bank_connection_id
     FROM bank_transactions
     WHERE user_id = ? AND bank_connection_id = ? AND date >= ? AND date <= ? AND ignored = 0
     ORDER BY date ASC`,
    [userId, bankConnectionId, periodStart, periodEnd]
  )

  // 2) Fetch manual transactions in the period (±2 day buffer for edge cases)
  const bufferStart = new Date(periodStart + 'T00:00:00')
  bufferStart.setDate(bufferStart.getDate() - 2)
  const bufferEnd = new Date(periodEnd + 'T00:00:00')
  bufferEnd.setDate(bufferEnd.getDate() + 2)

  const bsStr = bufferStart.toISOString().slice(0, 10)
  const beStr = bufferEnd.toISOString().slice(0, 10)

  const businessFilter = businessId ? 'AND t.business_id = ?' : ''
  const businessParams: unknown[] = businessId ? [businessId] : []

  const manualTxns = await db.all<ManualTxn>(
    `SELECT t.id, t.type, t.amount, t.date, t.note, t.method, c.name AS category_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.business_id IN (SELECT id FROM businesses WHERE user_id = ?)
       AND t.date >= ? AND t.date <= ?
       ${businessFilter}
     ORDER BY t.date ASC`,
    [userId, bsStr, beStr, ...businessParams]
  )

  // 3) Score every bank ↔ manual pair
  const allCandidates: MatchCandidate[] = []
  for (const bt of bankTxns) {
    for (const mt of manualTxns) {
      const { score, breakdown } = scoreMatch(bt, mt)
      if (score > 0) {
        allCandidates.push({ bankTxn: bt, manualTxn: mt, score, breakdown })
      }
    }
  }

  // Sort by descending score
  allCandidates.sort((a, b) => b.score - a.score)

  // 4) Greedy one-to-one matching (each txn matched at most once)
  const usedBank = new Set<number>()
  const usedManual = new Set<number>()

  const matched: MatchCandidate[] = []
  const suggested: MatchCandidate[] = []

  for (const c of allCandidates) {
    if (usedBank.has(c.bankTxn.id) || usedManual.has(c.manualTxn.id)) continue

    if (c.score >= 60) {
      matched.push(c)
      usedBank.add(c.bankTxn.id)
      usedManual.add(c.manualTxn.id)
    } else if (c.score >= 40) {
      suggested.push(c)
      // Don't mark as used — let the user decide
    }
  }

  // Remove suggested pairs that overlap with already-matched items
  const filteredSuggested = suggested.filter(
    s => !usedBank.has(s.bankTxn.id) && !usedManual.has(s.manualTxn.id)
  )

  // 5) Determine unmatched
  const matchedBankIds = new Set([...matched.map(m => m.bankTxn.id)])
  const matchedManualIds = new Set([...matched.map(m => m.manualTxn.id)])
  const suggestedBankIds = new Set(filteredSuggested.map(s => s.bankTxn.id))
  const suggestedManualIds = new Set(filteredSuggested.map(s => s.manualTxn.id))

  const unmatchedBank = bankTxns.filter(
    bt => !matchedBankIds.has(bt.id) && !suggestedBankIds.has(bt.id)
  )
  const unmatchedManual = manualTxns.filter(
    mt => !matchedManualIds.has(mt.id) && !suggestedManualIds.has(mt.id)
  )

  return {
    matched,
    suggested: filteredSuggested,
    unmatchedBank,
    unmatchedManual,
  }
}

/* ------------------------------------------------------------------ */
/*  Persist results to DB                                              */
/* ------------------------------------------------------------------ */

export async function persistReconciliation(
  sessionId: number,
  result: ReconciliationResult
): Promise<void> {
  // Insert auto-matched
  for (const m of result.matched) {
    await db.run(
      `INSERT INTO reconciliation_matches
         (session_id, bank_transaction_id, manual_transaction_id, match_type, confidence, status, matched_by)
       VALUES (?, ?, ?, 'auto', ?, 'matched', 'system')`,
      [sessionId, m.bankTxn.id, m.manualTxn.id, m.score]
    )
  }

  // Insert suggested
  for (const s of result.suggested) {
    await db.run(
      `INSERT INTO reconciliation_matches
         (session_id, bank_transaction_id, manual_transaction_id, match_type, confidence, status, matched_by)
       VALUES (?, ?, ?, 'suggested', ?, 'unmatched', 'system')`,
      [sessionId, s.bankTxn.id, s.manualTxn.id, s.score]
    )
  }

  // Insert unmatched bank txns (no manual match)
  for (const bt of result.unmatchedBank) {
    await db.run(
      `INSERT INTO reconciliation_matches
         (session_id, bank_transaction_id, manual_transaction_id, match_type, confidence, status, matched_by)
       VALUES (?, ?, NULL, 'auto', 0, 'unmatched', 'system')`,
      [sessionId, bt.id]
    )
  }

  // Update session counts
  const totalBank = result.matched.length + result.suggested.length + result.unmatchedBank.length
  await db.run(
    `UPDATE reconciliation_sessions
     SET matched_count = ?, unmatched_count = ?, total_bank_txns = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [result.matched.length, result.unmatchedBank.length + result.suggested.length, totalBank, sessionId]
  )
}
