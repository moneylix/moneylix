'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  GitCompareArrows, Plus, X, CheckCircle2, AlertCircle, HelpCircle,
  ArrowDownLeft, ArrowUpRight, Search, Filter, RefreshCw, Eye,
  EyeOff, Link2, Unlink, ChevronDown, Calendar, Building2,
  Loader2, Check, XCircle,
} from 'lucide-react'
import { useBusiness } from '@/lib/contexts/BusinessContext'
import { useCurrency } from '@/lib/contexts/CurrencyContext'
import { usePlan } from '@/lib/contexts/PlanContext'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BankConnection {
  id: number
  bank_name: string | null
  masked_account_number: string | null
  status: string
}

interface ReconSession {
  id: number
  business_id: number | null
  bank_connection_id: number
  bank_name: string | null
  masked_account_number: string | null
  business_name: string | null
  period_start: string
  period_end: string
  status: 'in_progress' | 'completed' | 'cancelled'
  total_bank_txns: number
  matched_count: number
  unmatched_count: number
  discrepancy_amount: number
  created_at: string
}

interface MatchRow {
  id: number
  session_id: number
  bank_transaction_id: number
  manual_transaction_id: number | null
  match_type: 'auto' | 'manual' | 'suggested'
  confidence: number
  status: 'matched' | 'unmatched' | 'disputed' | 'ignored'
  matched_by: string
  notes: string | null
  bank_type: 'credit' | 'debit'
  bank_amount: number
  bank_date: string
  bank_narration: string | null
  bank_reference: string | null
  bank_currency: string
  manual_type: string | null
  manual_amount: number | null
  manual_date: string | null
  manual_note: string | null
  manual_method: string | null
  manual_currency: string | null
  manual_category_name: string | null
  manual_category_color: string | null
}

interface ManualTxnOption {
  id: number
  type: string
  amount: number
  date: string
  note: string | null
  method: string | null
  currency: string
  category_name: string | null
  category_color: string | null
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ReconciliationPage() {
  const { activeBusiness } = useBusiness()
  const { currentCurrency, currencies } = useCurrency()
  const { can } = usePlan()

  const [sessions, setSessions] = useState<ReconSession[]>([])
  const [connections, setConnections] = useState<BankConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  // Active session drill-down
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [unmatchedManual, setUnmatchedManual] = useState<ManualTxnOption[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // New session modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [newForm, setNewForm] = useState({ bankConnectionId: '', periodStart: '', periodEnd: '' })

  // UI state
  const [matchFilter, setMatchFilter] = useState<'all' | 'matched' | 'unmatched' | 'ignored'>('all')
  const [matchSearch, setMatchSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  const getToken = () => localStorage.getItem('moneylix_session_token') || ''
  const authHeaders = (): Record<string, string> => {
    const t = getToken()
    return t ? { Authorization: `Bearer ${t}` } : {}
  }
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const fmt = useCallback((n: number) => {
    const sym = currencies.find(c => c.code === currentCurrency)?.symbol ?? '₹'
    return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }, [currencies, currentCurrency])

  const fmtDate = (d: string) => {
    if (!d) return '—'
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  /* ---------------------------------------------------------------- */
  /*  Data fetching                                                    */
  /* ---------------------------------------------------------------- */

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reconciliation', { headers: authHeaders() })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSessions(data.sessions ?? [])
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/bank/connections', { headers: authHeaders() })
      if (!res.ok) return
      const data = await res.json()
      setConnections((data.connections ?? data ?? []).filter((c: BankConnection) => c.status === 'active'))
    } catch {
      /* silent */
    }
  }, [])

  const fetchSessionDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/reconciliation/${id}`, { headers: authHeaders() })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMatches(data.matches ?? [])
      setUnmatchedManual(data.unmatchedManual ?? [])
    } catch {
      showToast('Failed to load session details')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => { fetchSessions(); fetchConnections() }, [fetchSessions, fetchConnections])
  useEffect(() => { if (activeSessionId) fetchSessionDetail(activeSessionId) }, [activeSessionId, fetchSessionDetail])

  /* ---------------------------------------------------------------- */
  /*  Actions                                                          */
  /* ---------------------------------------------------------------- */

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newForm.bankConnectionId || !newForm.periodStart || !newForm.periodEnd) return
    setCreating(true)
    try {
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          bankConnectionId: parseInt(newForm.bankConnectionId),
          businessId: activeBusiness?.id || null,
          periodStart: newForm.periodStart,
          periodEnd: newForm.periodEnd,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        showToast(d.error || 'Failed')
        return
      }
      const data = await res.json()
      showToast(`Reconciliation complete — ${data.summary?.autoMatched ?? 0} auto-matched`)
      setShowNewModal(false)
      setNewForm({ bankConnectionId: '', periodStart: '', periodEnd: '' })
      fetchSessions()
      if (data.session?.id) {
        setActiveSessionId(data.session.id)
      }
    } catch {
      showToast('Error starting reconciliation')
    } finally {
      setCreating(false)
    }
  }

  const handleManualMatch = async (bankTransactionId: number, manualTransactionId: number) => {
    if (!activeSessionId) return
    try {
      const res = await fetch('/api/reconciliation/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ sessionId: activeSessionId, bankTransactionId, manualTransactionId }),
      })
      if (!res.ok) { showToast('Match failed'); return }
      showToast('Matched!')
      fetchSessionDetail(activeSessionId)
      fetchSessions()
    } catch {
      showToast('Error')
    }
  }

  const handleUnmatch = async (bankTransactionId: number) => {
    if (!activeSessionId) return
    try {
      const res = await fetch('/api/reconciliation/match', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ sessionId: activeSessionId, bankTransactionId }),
      })
      if (!res.ok) { showToast('Unmatch failed'); return }
      showToast('Unmatched')
      fetchSessionDetail(activeSessionId)
      fetchSessions()
    } catch {
      showToast('Error')
    }
  }

  const handleIgnore = async (bankTransactionId: number) => {
    if (!activeSessionId) return
    try {
      const res = await fetch('/api/reconciliation/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ sessionId: activeSessionId, bankTransactionId }),
      })
      if (!res.ok) { showToast('Ignore failed'); return }
      showToast('Ignored')
      fetchSessionDetail(activeSessionId)
      fetchSessions()
    } catch {
      showToast('Error')
    }
  }

  const handleCompleteSession = async () => {
    if (!activeSessionId) return
    try {
      const res = await fetch(`/api/reconciliation/${activeSessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: 'completed' }),
      })
      if (!res.ok) { showToast('Failed'); return }
      showToast('Session completed')
      setActiveSessionId(null)
      fetchSessions()
    } catch {
      showToast('Error')
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Derived data                                                     */
  /* ---------------------------------------------------------------- */

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null
  const filteredMatches = matches
    .filter(m => matchFilter === 'all' || m.status === matchFilter)
    .filter(m => {
      if (!matchSearch) return true
      const q = matchSearch.toLowerCase()
      return (
        (m.bank_narration ?? '').toLowerCase().includes(q) ||
        (m.manual_note ?? '').toLowerCase().includes(q) ||
        (m.manual_category_name ?? '').toLowerCase().includes(q) ||
        String(m.bank_amount).includes(q)
      )
    })

  const statusCfg: Record<string, { label: string; cls: string }> = {
    matched: { label: 'Matched', cls: 'bg-lime-100 text-lime-700' },
    unmatched: { label: 'Unmatched', cls: 'bg-rose-100 text-rose-700' },
    ignored: { label: 'Ignored', cls: 'bg-neutral-100 text-neutral-500' },
    disputed: { label: 'Disputed', cls: 'bg-amber-100 text-amber-700' },
    in_progress: { label: 'In Progress', cls: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Completed', cls: 'bg-lime-100 text-lime-700' },
    cancelled: { label: 'Cancelled', cls: 'bg-neutral-100 text-neutral-500' },
  }

  /* ---------------------------------------------------------------- */
  /*  Render — Session detail view                                     */
  /* ---------------------------------------------------------------- */

  if (activeSessionId && activeSession) {
    const matchedCount = matches.filter(m => m.status === 'matched').length
    const unmatchedCount = matches.filter(m => m.status === 'unmatched').length
    const ignoredCount = matches.filter(m => m.status === 'ignored').length
    const matchRate = matches.length > 0 ? Math.round((matchedCount / matches.length) * 100) : 0

    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveSessionId(null)} className="text-xs text-neutral-400 hover:text-neutral-900 transition">
            ← Back
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-neutral-900">
              Reconciliation — {activeSession.bank_name ?? 'Bank'} ({activeSession.masked_account_number ?? '****'})
            </h1>
            <p className="text-[10px] text-neutral-400">
              {fmtDate(activeSession.period_start)} — {fmtDate(activeSession.period_end)}
              {activeSession.business_name && ` · ${activeSession.business_name}`}
            </p>
          </div>
          {activeSession.status === 'in_progress' && (
            <button onClick={handleCompleteSession} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-lime-400 text-neutral-900 hover:bg-lime-300 transition font-bold">
              <CheckCircle2 className="w-3 h-3" /> Complete
            </button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {[
            { label: 'Total Bank Txns', value: matches.length, cls: 'text-neutral-700' },
            { label: 'Matched', value: matchedCount, cls: 'text-lime-700' },
            { label: 'Unmatched', value: unmatchedCount, cls: 'text-rose-700' },
            { label: 'Ignored', value: ignoredCount, cls: 'text-neutral-500' },
            { label: 'Match Rate', value: `${matchRate}%`, cls: matchRate >= 80 ? 'text-lime-700' : matchRate >= 50 ? 'text-amber-700' : 'text-rose-700' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl shadow-sm px-3 py-2">
              <p className="text-[10px] text-neutral-400">{c.label}</p>
              <p className={`text-sm font-bold font-mono ${c.cls}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {activeSession.discrepancy_amount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Discrepancy amount: <strong className="font-mono">{fmt(activeSession.discrepancy_amount)}</strong></span>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              value={matchSearch}
              onChange={e => setMatchSearch(e.target.value)}
              placeholder="Search narration, note, category…"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'matched', 'unmatched', 'ignored'] as const).map(f => (
              <button
                key={f}
                onClick={() => setMatchFilter(f)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                  matchFilter === f ? 'bg-lime-100 text-lime-700' : 'bg-white text-neutral-400 hover:text-neutral-900 border border-neutral-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Matches table */}
        {detailLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-xs text-neutral-400">
            No matches found for this filter.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMatches.map(m => (
              <MatchCard
                key={m.id}
                match={m}
                fmt={fmt}
                fmtDate={fmtDate}
                statusCfg={statusCfg}
                unmatchedManual={unmatchedManual}
                onMatch={handleManualMatch}
                onUnmatch={handleUnmatch}
                onIgnore={handleIgnore}
                sessionStatus={activeSession.status}
              />
            ))}
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl">
            {toast}
          </div>
        )}
      </div>
    )
  }

  /* ---------------------------------------------------------------- */
  /*  Render — Sessions list view                                      */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-bold text-neutral-900">Bank Reconciliation</h1>
          <p className="text-[10px] text-neutral-400">Match bank statements to your recorded transactions</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-lime-400 text-neutral-900 hover:bg-lime-300 transition font-bold"
        >
          <Plus className="w-3 h-3" /> New Session
        </button>
      </div>

      {/* Sessions list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <GitCompareArrows className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500 font-semibold">No reconciliation sessions yet</p>
          <p className="text-[10px] text-neutral-400 mt-1 mb-4">Start a session to auto-match bank transactions with your records</p>
          <button
            onClick={() => setShowNewModal(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-lime-400 text-neutral-900 hover:bg-lime-300 transition font-bold"
          >
            Start Reconciliation
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => {
            const rate = s.total_bank_txns > 0 ? Math.round((s.matched_count / s.total_bank_txns) * 100) : 0
            const cfg = statusCfg[s.status] ?? statusCfg.in_progress
            return (
              <button
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className="w-full bg-white rounded-2xl shadow-sm p-4 text-left hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                      <span className="text-xs font-bold text-neutral-900 truncate">
                        {s.bank_name ?? 'Bank'} — {s.masked_account_number ?? '****'}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-400">
                      {fmtDate(s.period_start)} — {fmtDate(s.period_end)}
                      {s.business_name && ` · ${s.business_name}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-mono font-bold text-neutral-900">{rate}%</p>
                    <p className="text-[10px] text-neutral-400">matched</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-2 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-lime-400 transition-all"
                    style={{ width: `${rate}%` }}
                  />
                </div>

                <div className="flex items-center gap-3 mt-2 text-[10px] text-neutral-400">
                  <span>{s.total_bank_txns} bank txns</span>
                  <span className="text-lime-600">{s.matched_count} matched</span>
                  <span className="text-rose-500">{s.unmatched_count} unmatched</span>
                  {s.discrepancy_amount > 0 && (
                    <span className="text-amber-600">discrepancy {fmt(s.discrepancy_amount)}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* New session modal */}
      {showNewModal && isMounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNewModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-neutral-900">New Reconciliation Session</h2>
              <button onClick={() => setShowNewModal(false)} className="p-1 text-neutral-400 hover:text-neutral-900 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSession} className="space-y-4">
              {/* Bank connection */}
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Bank Account</label>
                {connections.length === 0 ? (
                  <p className="text-xs text-neutral-400 mt-1">No active bank connections. <a href="/dashboard/bank" className="text-lime-600 underline">Connect one</a></p>
                ) : (
                  <select
                    value={newForm.bankConnectionId}
                    onChange={e => setNewForm(f => ({ ...f, bankConnectionId: e.target.value }))}
                    required
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-lime-400"
                  >
                    <option value="">Select bank account…</option>
                    {connections.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.bank_name ?? 'Bank'} — {c.masked_account_number ?? '****'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Period */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">From</label>
                  <input
                    type="date"
                    value={newForm.periodStart}
                    onChange={e => setNewForm(f => ({ ...f, periodStart: e.target.value }))}
                    required
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-lime-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">To</label>
                  <input
                    type="date"
                    value={newForm.periodEnd}
                    onChange={e => setNewForm(f => ({ ...f, periodEnd: e.target.value }))}
                    required
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-lime-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creating || connections.length === 0}
                className="w-full flex items-center justify-center gap-2 text-xs px-3 py-2.5 rounded-lg bg-lime-400 text-neutral-900 hover:bg-lime-300 transition font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitCompareArrows className="w-3.5 h-3.5" />}
                {creating ? 'Running…' : 'Start Reconciliation'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  MatchCard sub-component                                            */
/* ------------------------------------------------------------------ */

interface MatchCardProps {
  match: MatchRow
  fmt: (n: number) => string
  fmtDate: (d: string) => string
  statusCfg: Record<string, { label: string; cls: string }>
  unmatchedManual: ManualTxnOption[]
  onMatch: (bankId: number, manualId: number) => void
  onUnmatch: (bankId: number) => void
  onIgnore: (bankId: number) => void
  sessionStatus: string
}

function MatchCard({ match, fmt, fmtDate, statusCfg, unmatchedManual, onMatch, onUnmatch, onIgnore, sessionStatus }: MatchCardProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const m = match
  const cfg = statusCfg[m.status] ?? statusCfg.unmatched
  const isEditable = sessionStatus === 'in_progress'
  const isCredit = m.bank_type === 'credit'

  // Filter manual options to same type and similar amount (±50%)
  const relevantManual = unmatchedManual.filter(mt => {
    if (mt.type !== m.bank_type) return false
    const ratio = mt.amount / Math.max(m.bank_amount, 0.01)
    return ratio >= 0.5 && ratio <= 2.0
  })

  return (
    <div className={`bg-white rounded-xl shadow-sm overflow-hidden border-l-4 ${
      m.status === 'matched' ? 'border-lime-400' :
      m.status === 'ignored' ? 'border-neutral-300' :
      m.match_type === 'suggested' ? 'border-amber-400' :
      'border-rose-400'
    }`}>
      <div className="p-3">
        {/* Top: Bank txn info + status badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isCredit
              ? <ArrowDownLeft className="w-3.5 h-3.5 text-lime-600 flex-shrink-0" />
              : <ArrowUpRight className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
            }
            <div className="min-w-0">
              <p className="text-xs font-semibold text-neutral-900 truncate">
                {m.bank_narration || 'No narration'}
              </p>
              <p className="text-[10px] text-neutral-400">{fmtDate(m.bank_date)} · {m.bank_reference || 'No ref'}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`text-xs font-bold font-mono ${isCredit ? 'text-lime-700' : 'text-rose-600'}`}>
              {isCredit ? '+' : '-'}{fmt(m.bank_amount)}
            </p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
              {cfg.label}
              {m.match_type === 'suggested' && m.status === 'unmatched' && ` (${Math.round(m.confidence)}%)`}
            </span>
          </div>
        </div>

        {/* Matched manual transaction */}
        {m.status === 'matched' && m.manual_transaction_id && (
          <div className="flex items-center gap-2 bg-lime-50 rounded-lg px-3 py-2 mt-1">
            <Link2 className="w-3 h-3 text-lime-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-lime-800 truncate">
                {m.manual_category_name ?? 'Uncategorised'} — {m.manual_note || 'No note'}
              </p>
              <p className="text-[10px] text-lime-600">
                {fmtDate(m.manual_date ?? '')} · {m.manual_method ?? ''} · {fmt(m.manual_amount ?? 0)}
              </p>
            </div>
            <span className="text-[10px] text-lime-600 bg-lime-100 px-1.5 py-0.5 rounded font-mono">
              {m.match_type}
            </span>
            {isEditable && (
              <button
                onClick={() => onUnmatch(m.bank_transaction_id)}
                className="text-[10px] text-rose-500 hover:text-rose-700 font-bold ml-1"
                title="Unmatch"
              >
                <Unlink className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Suggested match */}
        {m.match_type === 'suggested' && m.status === 'unmatched' && m.manual_transaction_id && (
          <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2 mt-1">
            <HelpCircle className="w-3 h-3 text-amber-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-amber-800 truncate">
                Suggested: {m.manual_category_name ?? 'Uncategorised'} — {m.manual_note || 'No note'}
              </p>
              <p className="text-[10px] text-amber-600">
                {fmtDate(m.manual_date ?? '')} · {fmt(m.manual_amount ?? 0)} · {Math.round(m.confidence)}% confidence
              </p>
            </div>
            {isEditable && (
              <div className="flex gap-1">
                <button
                  onClick={() => onMatch(m.bank_transaction_id, m.manual_transaction_id!)}
                  className="text-[10px] px-2 py-1 rounded bg-lime-400 text-neutral-900 font-bold hover:bg-lime-300"
                >
                  Accept
                </button>
                <button
                  onClick={() => onIgnore(m.bank_transaction_id)}
                  className="text-[10px] px-2 py-1 rounded bg-neutral-200 text-neutral-600 font-bold hover:bg-neutral-300"
                >
                  Ignore
                </button>
              </div>
            )}
          </div>
        )}

        {/* Unmatched — show manual match dropdown */}
        {m.status === 'unmatched' && m.match_type !== 'suggested' && isEditable && (
          <div className="flex items-center gap-2 mt-2">
            <div className="relative flex-1">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-500 hover:border-lime-400 transition"
              >
                <span>Match manually…</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-neutral-200 shadow-lg z-20 max-h-48 overflow-y-auto">
                  {relevantManual.length === 0 ? (
                    <p className="px-3 py-2 text-[10px] text-neutral-400">No matching transactions found</p>
                  ) : (
                    relevantManual.map(mt => (
                      <button
                        key={mt.id}
                        onClick={() => { onMatch(m.bank_transaction_id, mt.id); setShowDropdown(false) }}
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-lime-50 transition"
                      >
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-neutral-900 truncate">
                            {mt.category_name ?? 'Uncategorised'} — {mt.note || 'No note'}
                          </p>
                          <p className="text-[10px] text-neutral-400">{fmtDate(mt.date)} · {mt.method ?? ''}</p>
                        </div>
                        <span className={`text-xs font-mono font-bold flex-shrink-0 ml-2 ${mt.type === 'credit' ? 'text-lime-700' : 'text-rose-600'}`}>
                          {fmt(mt.amount)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => onIgnore(m.bank_transaction_id)}
              className="text-[10px] px-2 py-1.5 rounded-lg bg-neutral-100 text-neutral-500 font-bold hover:bg-neutral-200 transition flex-shrink-0"
              title="Ignore this transaction"
            >
              <EyeOff className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Ignored note */}
        {m.status === 'ignored' && (
          <p className="text-[10px] text-neutral-400 mt-1 italic">{m.notes || 'Ignored by user'}</p>
        )}
      </div>
    </div>
  )
}
