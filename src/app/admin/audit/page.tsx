'use client'

import { useEffect, useState, useCallback } from 'react'
import { ScrollText, Search, ChevronLeft, ChevronRight } from 'lucide-react'

const getToken = () => {
  try { return JSON.parse(localStorage.getItem('moneylix_admin_auth') ?? '{}').token ?? '' } catch { return '' }
}

interface Log {
  id: number; action: string; category: string; resource_type: string | null
  description: string | null; status: string; ip_address: string | null
  created_at: string; username: string | null
}

const STATUS_STYLE: Record<string, string> = {
  success: 'bg-emerald-500/20 text-emerald-400',
  failure: 'bg-rose-500/20 text-rose-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
}
const CAT_STYLE: Record<string, string> = {
  bank_sync: 'bg-cyan-500/20 text-cyan-300',
  auth: 'bg-violet-500/20 text-violet-300',
  data_access: 'bg-blue-500/20 text-blue-300',
  admin: 'bg-amber-500/20 text-amber-300',
  general: 'bg-slate-700/60 text-slate-300',
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '25' })
    if (category) params.set('category', category)
    if (status) params.set('status', status)
    if (search) params.set('search', search)
    const res = await fetch(`/api/admin/audit?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } })
    const data = await res.json()
    setLogs(data.logs ?? [])
    setTotalPages(data.totalPages ?? 1)
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page, category, status, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [category, status, search])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
          <ScrollText className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Audit Log</h1>
          <p className="text-xs text-slate-400">{total.toLocaleString()} events · read-only append-only trail</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search action, description, user..."
            className="w-full rounded-xl border border-white/10 bg-slate-800/50 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="rounded-xl border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white focus:outline-none">
          <option value="">All categories</option>
          {['bank_sync', 'auth', 'data_access', 'admin', 'general'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="rounded-xl border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white focus:outline-none">
          <option value="">All statuses</option>
          {['success', 'failure', 'pending'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-500">No audit events found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead className="border-b border-white/5 bg-white/5">
                <tr>
                  {['Time', 'User', 'Action', 'Category', 'Status', 'Description', 'IP'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-white/5 transition">
                    <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{new Date(l.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="px-3 py-2.5 text-white font-semibold">{l.username ?? '—'}</td>
                    <td className="px-3 py-2.5 text-white font-mono">{l.action}</td>
                    <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${CAT_STYLE[l.category] ?? CAT_STYLE.general}`}>{l.category}</span></td>
                    <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${STATUS_STYLE[l.status] ?? STATUS_STYLE.pending}`}>{l.status}</span></td>
                    <td className="px-3 py-2.5 text-slate-400 max-w-[240px] truncate">{l.description ?? '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500 font-mono">{l.ip_address ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white disabled:opacity-40 hover:bg-white/5 transition">
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white disabled:opacity-40 hover:bg-white/5 transition">
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
