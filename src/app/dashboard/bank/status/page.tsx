'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Building2, RefreshCw, WifiOff, Wifi, AlertTriangle,
  CheckCircle2, Clock, ShieldAlert, PlugZap, CalendarClock,
  Activity, Hash, Tag, ArrowRight, Loader2, RotateCcw,
  XCircle, ChevronRight, Info,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncHistoryItem {
  id: number
  action: string
  description: string | null
  status: 'success' | 'failure' | 'pending'
  error_message: string | null
  created_at: string
}

interface SyncStatus {
  connected: boolean
  connectionId: number | null
  connectionStatus: 'active' | 'pending' | 'revoked' | 'expired' | 'paused' | 'none'
  healthStatus: 'healthy' | 'expiring_soon' | 'expired' | 'disconnected' | 'pending'

  bankName: string | null
  maskedAccount: string | null
  accountType: string | null
  fipId: string | null

  lastSyncedAt: string | null
  lastSyncError: string | null
  nextAllowedSyncAt: string | null
  canSyncNow: boolean
  syncFrequency: { value: number; unit: string }

  consentStart: string | null
  consentExpiry: string | null
  consentDaysRemaining: number | null

  totalTransactions: number
  uncategorisedCount: number

  recentSyncHistory: SyncHistoryItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getToken = () =>
  typeof window !== 'undefined'
    ? localStorage.getItem('moneylix_session_token') || ''
    : ''

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return 'just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days  < 30)  return `${days}d ago`
  return fmtDateTime(iso)
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function HealthDot({ health }: { health: SyncStatus['healthStatus'] }) {
  const map: Record<SyncStatus['healthStatus'], { color: string; pulse: boolean; label: string }> = {
    healthy:       { color: 'bg-emerald-400', pulse: true,  label: 'Healthy'       },
    expiring_soon: { color: 'bg-amber-400',   pulse: true,  label: 'Expiring Soon' },
    expired:       { color: 'bg-rose-500',    pulse: false, label: 'Expired'       },
    disconnected:  { color: 'bg-slate-500',   pulse: false, label: 'Disconnected'  },
    pending:       { color: 'bg-blue-400',    pulse: true,  label: 'Pending'       },
  }
  const { color, pulse, label } = map[health]
  return (
    <span className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-60`} />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
      </span>
      <span className="text-xs font-semibold text-white">{label}</span>
    </span>
  )
}

function ConsentBar({ daysRemaining }: { daysRemaining: number | null }) {
  if (daysRemaining === null) return null
  // Setu consents are typically 1 year = 365 days total
  const totalDays = 365
  const pct = Math.max(0, Math.min(100, (daysRemaining / totalDays) * 100))
  const color =
    daysRemaining <= 0   ? 'bg-rose-500'  :
    daysRemaining <= 30  ? 'bg-amber-400' :
    daysRemaining <= 90  ? 'bg-yellow-400':
    'bg-emerald-400'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-400">Consent remaining</span>
        <span className={`font-bold ${daysRemaining <= 30 ? 'text-amber-400' : 'text-slate-300'}`}>
          {daysRemaining <= 0 ? 'Expired' : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function SyncHistoryRow({ item }: { item: SyncHistoryItem }) {
  const isSuccess = item.status === 'success'
  const isFailure = item.status === 'failure'

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
      {/* Icon */}
      <div className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isSuccess ? 'bg-emerald-500/15' :
        isFailure ? 'bg-rose-500/15' :
        'bg-slate-500/15'
      }`}>
        {isSuccess ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        ) : isFailure ? (
          <XCircle className="w-3.5 h-3.5 text-rose-400" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-slate-400" />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-white leading-tight truncate">
          {item.description || item.action.replace(/_/g, ' ')}
        </p>
        {item.error_message && (
          <p className="text-[10px] text-rose-400 mt-0.5 truncate">{item.error_message}</p>
        )}
      </div>

      {/* Time */}
      <span className="text-[10px] text-slate-500 flex-shrink-0 mt-0.5">{timeAgo(item.created_at)}</span>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BankSyncStatusPage() {
  const [status, setStatus]       = useState<SyncStatus | null>(null)
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [toast, setToast]         = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/bank/sync-status', {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('Failed to fetch')
      const data: SyncStatus = await res.json()
      setStatus(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/bank/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Sync failed', 'err')
      } else {
        showToast(data.message || 'Sync complete', 'ok')
        // Refresh status after a short delay so audit log entry has been written
        setTimeout(fetchStatus, 1200)
      }
    } catch {
      showToast('Sync failed. Please try again.', 'err')
    } finally {
      setSyncing(false)
    }
  }

  // ── Skeleton ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-6 w-48 bg-white/10 rounded-xl" />
        <div className="h-36 rounded-2xl bg-white/5 border border-white/10" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 rounded-2xl bg-white/5 border border-white/10" />
          <div className="h-24 rounded-2xl bg-white/5 border border-white/10" />
        </div>
        <div className="h-48 rounded-2xl bg-white/5 border border-white/10" />
      </div>
    )
  }

  const s = status

  // ── No connection ────────────────────────────────────────────────────────
  if (!s || s.connectionStatus === 'none') {
    return (
      <div className="space-y-5">
        <PageHeader />
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-white/10 bg-white/5">
          <div className="w-16 h-16 rounded-3xl bg-slate-500/10 flex items-center justify-center mb-4">
            <WifiOff className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">No Bank Connected</h3>
          <p className="text-[11px] text-slate-400 max-w-xs mb-5">
            Connect your bank via Account Aggregator to start importing transactions automatically.
          </p>
          <Link
            href="/dashboard/bank"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition"
          >
            <Building2 className="w-4 h-4" /> Go to Bank Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const isExpired    = s.healthStatus === 'expired' || s.connectionStatus === 'expired'
  const isRevoked    = s.connectionStatus === 'revoked'
  const isPending    = s.connectionStatus === 'pending'
  const needsReconnect = isExpired || isRevoked

  // ── Connection health banner colour ──────────────────────────────────────
  const bannerBorder =
    s.healthStatus === 'healthy'       ? 'border-emerald-500/25 bg-emerald-500/5'  :
    s.healthStatus === 'expiring_soon' ? 'border-amber-500/25  bg-amber-500/5'     :
    s.healthStatus === 'expired'       ? 'border-rose-500/25   bg-rose-500/5'      :
    s.healthStatus === 'pending'       ? 'border-blue-500/25   bg-blue-500/5'      :
    'border-white/10 bg-white/5'

  const bankIcon =
    s.healthStatus === 'healthy'       ? <Wifi        className="w-5 h-5 text-emerald-400" /> :
    s.healthStatus === 'expiring_soon' ? <AlertTriangle className="w-5 h-5 text-amber-400" /> :
    s.healthStatus === 'expired'       ? <ShieldAlert  className="w-5 h-5 text-rose-400"   /> :
    s.healthStatus === 'pending'       ? <Clock        className="w-5 h-5 text-blue-400 animate-pulse" /> :
    <WifiOff className="w-5 h-5 text-slate-500" />

  return (
    <div className="space-y-5">
      <PageHeader />

      {/* ── Connection Health Card ── */}
      <div className={`rounded-2xl border p-5 space-y-4 ${bannerBorder}`}>
        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              s.healthStatus === 'healthy'       ? 'bg-emerald-500/20' :
              s.healthStatus === 'expiring_soon' ? 'bg-amber-500/20'   :
              s.healthStatus === 'expired'       ? 'bg-rose-500/20'    :
              s.healthStatus === 'pending'       ? 'bg-blue-500/20'    :
              'bg-slate-500/20'
            }`}>
              {bankIcon}
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">
                {s.bankName || 'Bank Account'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {s.maskedAccount ? `${s.maskedAccount} · ` : ''}
                {s.accountType || 'Account'}
                {s.fipId ? ` · ${s.fipId}` : ''}
              </p>
            </div>
          </div>
          <HealthDot health={s.healthStatus} />
        </div>

        {/* Consent countdown bar */}
        <ConsentBar daysRemaining={s.consentDaysRemaining} />

        {/* Consent dates */}
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div className="rounded-xl bg-white/5 border border-white/8 p-3">
            <p className="text-slate-500 uppercase tracking-wider font-bold text-[9px] mb-1">Consent Start</p>
            <p className="text-white font-semibold">{fmtDate(s.consentStart)}</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/8 p-3">
            <p className="text-slate-500 uppercase tracking-wider font-bold text-[9px] mb-1">Consent Expiry</p>
            <p className={`font-semibold ${
              (s.consentDaysRemaining ?? 99) <= 30 ? 'text-amber-400' : 'text-white'
            }`}>
              {fmtDate(s.consentExpiry)}
            </p>
          </div>
        </div>

        {/* Error notice */}
        {s.lastSyncError && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-rose-300 leading-relaxed">{s.lastSyncError}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {!needsReconnect && !isPending && (
            <button
              onClick={handleSync}
              disabled={syncing || !s.canSyncNow}
              title={!s.canSyncNow && s.nextAllowedSyncAt
                ? `Next sync available ${fmtDateTime(s.nextAllowedSyncAt)}`
                : undefined}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 font-semibold hover:bg-emerald-500/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {syncing
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing…</>
                : <><RefreshCw className="w-3.5 h-3.5" /> Sync Now</>
              }
            </button>
          )}

          {(needsReconnect || s.healthStatus === 'expiring_soon') && (
            <Link
              href="/dashboard/bank"
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border border-blue-500/25 bg-blue-500/10 text-blue-300 font-semibold hover:bg-blue-500/20 active:scale-95 transition-all"
            >
              <PlugZap className="w-3.5 h-3.5" />
              {needsReconnect ? 'Reconnect Bank' : 'Renew Consent'}
            </Link>
          )}
        </div>

        {/* Next allowed sync notice */}
        {!s.canSyncNow && s.nextAllowedSyncAt && (
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <CalendarClock className="w-3.5 h-3.5" />
            Next sync available: <span className="text-slate-300 font-semibold">{fmtDateTime(s.nextAllowedSyncAt)}</span>
            <span className="text-slate-600">
              (frequency: every {s.syncFrequency.value} {s.syncFrequency.unit.toLowerCase()})
            </span>
          </div>
        )}
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Hash className="w-4 h-4 text-blue-400" />}
          label="Total Imported"
          value={s.totalTransactions.toLocaleString('en-IN')}
          bg="bg-blue-500/10"
        />
        <StatCard
          icon={<Tag className="w-4 h-4 text-amber-400" />}
          label="Uncategorised"
          value={s.uncategorisedCount.toLocaleString('en-IN')}
          bg={s.uncategorisedCount > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'}
          valueClass={s.uncategorisedCount > 0 ? 'text-amber-400' : 'text-emerald-400'}
        />
        <StatCard
          icon={<Clock className="w-4 h-4 text-slate-400" />}
          label="Last Sync"
          value={timeAgo(s.lastSyncedAt)}
          bg="bg-white/5"
          valueClass="text-slate-200"
        />
        <StatCard
          icon={<Activity className="w-4 h-4 text-violet-400" />}
          label="Sync Frequency"
          value={`${s.syncFrequency.value}×/${s.syncFrequency.unit.toLowerCase()}`}
          bg="bg-violet-500/10"
          valueClass="text-violet-300"
        />
      </div>

      {/* ── Sync History ── */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />
            <h2 className="text-xs font-bold text-white">Recent Sync Activity</h2>
          </div>
          <button
            onClick={fetchStatus}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition"
          >
            <RotateCcw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {/* Rows */}
        <div className="px-5 divide-y divide-white/5">
          {s.recentSyncHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Info className="w-6 h-6 text-slate-600 mb-2" />
              <p className="text-[11px] text-slate-500">No sync history yet.</p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                Run a sync to see activity appear here.
              </p>
            </div>
          ) : (
            s.recentSyncHistory.map(item => (
              <SyncHistoryRow key={item.id} item={item} />
            ))
          )}
        </div>

        {/* Footer link */}
        <div className="px-5 py-3 border-t border-white/8">
          <Link
            href="/dashboard/bank"
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-emerald-400 transition font-semibold"
          >
            View all transactions <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── Quick links ── */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/dashboard/bank"
          className="flex items-center justify-between px-4 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition group"
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-white">Transactions</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition" />
        </Link>
        <Link
          href="/dashboard/settings"
          className="flex items-center justify-between px-4 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition group"
        >
          <div className="flex items-center gap-2">
            <PlugZap className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-white">Bank Settings</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition" />
        </Link>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full shadow-2xl z-50 text-xs font-semibold border flex items-center gap-2 ${
          toast.type === 'ok'
            ? 'bg-slate-900 border-emerald-500/30 text-emerald-300'
            : 'bg-slate-900 border-rose-500/30 text-rose-300'
        }`}>
          {toast.type === 'ok'
            ? <CheckCircle2 className="w-3.5 h-3.5" />
            : <XCircle className="w-3.5 h-3.5" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ─── Small local components ───────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-base font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          Bank Sync Status
        </h1>
        <p className="text-[10px] text-slate-400 mt-0.5">
          Connection health, consent validity, and sync history
        </p>
      </div>
      <Link
        href="/dashboard/bank"
        className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-white transition"
      >
        <Building2 className="w-3.5 h-3.5" /> Transactions
        <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  )
}

function StatCard({
  icon, label, value, bg, valueClass = 'text-white',
}: {
  icon: React.ReactNode
  label: string
  value: string
  bg?: string
  valueClass?: string
}) {
  return (
    <div className={`rounded-2xl border border-white/10 p-3 ${bg || 'bg-white/5'}`}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">{label}</p>
      </div>
      <p className={`text-base font-black ${valueClass}`}>{value}</p>
    </div>
  )
}
