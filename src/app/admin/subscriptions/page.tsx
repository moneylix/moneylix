'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Filter, CreditCard, IndianRupee, TrendingUp, Calendar, Trash2, ArrowRight, Activity } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import { cn } from '@/lib/utils/format'

interface SubRow {
  id: number
  user_id: number
  username: string
  email: string
  plan: string
  status: string
  started_at: string
  expires_at: string | null
  amount_paid: number
  payment_method: string | null
  notes: string | null
  created_at: string
}

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<SubRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [planFilter, setPlanFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const getToken = () => {
    try { return JSON.parse(localStorage.getItem('moneylix_admin_auth') ?? '{}').token ?? '' } catch { return '' }
  }

  const load = useCallback(async () => {
    setLoading(true)
    const token = getToken()
    const params = new URLSearchParams({
      page: String(page),
      ...(planFilter   ? { plan: planFilter }     : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    })
    const res = await fetch(`/api/admin/subscriptions?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    setSubs(data.subscriptions ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page, planFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / 20)
  const totalRevenue = subs.reduce((s, r) => s + r.amount_paid, 0)

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-10">
      {/* Header */}
      <header className="flex flex-col gap-6 rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl md:flex-row md:items-center md:justify-between shadow-2xl">
        <div className="flex items-center gap-5">
           <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-500/10">
             <CreditCard className="w-7 h-7" />
           </div>
           <div>
              <p className="text-[10px] text-emerald-400 font-black tracking-[0.2em] uppercase">Subscription Ledger</p>
              <h1 className="text-3xl font-black text-white">Revenue Streams</h1>
              <p className="text-sm text-slate-400 font-medium mt-1">Direct oversight of license renewals and payment captures.</p>
           </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="text-right">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-none mb-1">Batch Revenue</p>
              <p className="text-2xl font-black text-emerald-400 font-mono">₹{totalRevenue.toLocaleString('en-IN')}</p>
           </div>
           <div className="w-px h-10 bg-white/10" />
           <Button className="rounded-2xl px-6">Generate Invoices</Button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-white/5 backdrop-blur-xl p-4 rounded-[24px] border border-white/5 shadow-xl">
        <div className="flex items-center gap-2 px-2">
           <Filter className="w-4 h-4 text-primary" />
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Filter Matrix</span>
        </div>
        <div className="w-px h-6 bg-white/10 hidden md:block" />
        <div className="flex-1 flex flex-wrap gap-4">
           <div className="w-48">
              <Select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1) }} 
                options={[
                  { label: 'All Plans', value: '' },
                  { label: 'Free Tier', value: 'free' },
                  { label: 'Pro Tier', value: 'pro' },
                  { label: 'Premium Tier', value: 'premium' }
                ]} />
           </div>
           <div className="w-48">
              <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
                options={[
                  { label: 'All Statuses', value: '' },
                  { label: 'Active Only', value: 'active' },
                  { label: 'Trials', value: 'trial' },
                  { label: 'Cancelled', value: 'cancelled' },
                  { label: 'Expired', value: 'expired' }
                ]} />
           </div>
           {(planFilter || statusFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setPlanFilter(''); setStatusFilter(''); setPage(1) }} className="text-slate-500 font-black text-[10px] uppercase gap-1">Reset Filters</Button>
           )}
        </div>
      </div>

      {/* Subscription Table */}
      <div className="rounded-[32px] border border-white/5 bg-white/5 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-3 px-6 py-4">
            <thead>
              <tr className="text-left text-[11px] font-black text-slate-500 uppercase tracking-widest">
                <th className="px-6 py-4">Subscriber Identity</th>
                <th className="px-6 py-4 text-center text-xs w-40">Entitlement</th>
                <th className="px-6 py-4 text-center uppercase tracking-[0.2em]">Lifecycle</th>
                <th className="px-6 py-4">Session Duration</th>
                <th className="px-6 py-4 text-right">Debit / Re-eval</th>
                <th className="px-6 py-4 text-right">Gateway</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                 <tr><td colSpan={7} className="px-6 py-20 text-center"><div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" /><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-6">Indexing Subscription Stream...</p></td></tr>
              ) : subs.length === 0 ? (
                 <tr><td colSpan={7} className="px-6 py-20 text-center text-slate-500 font-black uppercase tracking-widest">No active records match filter criteria.</td></tr>
              ) : subs.map((s) => (
                <tr key={s.id} className="group bg-slate-900/60 hover:bg-slate-800 transition-all duration-300 shadow-lg border border-white/5">
                  <td className="px-6 py-5 rounded-l-[24px]">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-black text-xs text-slate-500 group-hover:text-white transition-colors">{s.username[0].toUpperCase()}</div>
                       <div>
                          <p className="font-black text-white text-sm group-hover:text-primary transition-all tracking-tight uppercase">{s.username}</p>
                          <p className="text-[11px] text-slate-500 font-bold opacity-60 group-hover:opacity-100 transition-all">{s.email}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <LicenseTierBadge plan={s.plan} />
                  </td>
                  <td className="px-6 py-5 text-center">
                    <LifecycleBadge status={s.status} />
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                       <div className="space-y-0.5">
                          <p className="text-[10px] font-black text-white">{new Date(s.started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                          <div className="flex items-center gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
                             <div className="w-1 h-1 rounded-full bg-slate-500" />
                             <p className="text-[9px] text-slate-500 font-black uppercase">{s.expires_at ? new Date(s.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'PERPETUAL'}</p>
                          </div>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right font-black text-emerald-400 font-mono text-base tabular-nums">
                    {s.amount_paid > 0 ? `₹${s.amount_paid.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-6 py-5 text-right font-black text-slate-500 uppercase text-[9px] tracking-widest">
                    {s.payment_method || 'Internal Credit'}
                  </td>
                  <td className="px-6 py-5 text-right rounded-r-[24px]">
                     <button className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100">
                        <ArrowRight className="w-4 h-4" />
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-10 py-6 border-t border-white/5 bg-black/20">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Snapshot <span className="text-white">{page}</span> of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 rounded-xl border-white/5"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 rounded-xl border-white/5"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </div>

      {/* Aggregate Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Retention Rate</p>
               <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-black text-white font-mono">94.2%</p>
            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden flex">
               <div className="h-full bg-emerald-400" style={{ width: '94.2%' }} />
            </div>
         </div>
         <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Projected MRR</p>
               <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-3xl font-black text-white font-mono">₹42,850</p>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-tight">+12.4% vs last cycle</p>
         </div>
         <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Capture Efficiency</p>
               <IndianRupee className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-3xl font-black text-white font-mono">82%</p>
            <div className="flex gap-1">
               {[1,2,3,4,5,6,7,8,9,10].map(i => (
                  <div key={i} className={cn("h-1 flex-1 rounded-full", i <= 8 ? "bg-amber-400" : "bg-slate-900")} />
               ))}
            </div>
         </div>
      </div>
    </div>
  )
}

function LicenseTierBadge({ plan }: { plan: string | null }) {
  const styles: Record<string, string> = {
    premium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    pro:     'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    free:    'bg-slate-700/50 text-slate-500 border-slate-700/50',
  }
  return <Badge variant="credit" className={cn("font-black text-[9px] uppercase tracking-widest", styles[plan || 'free'])}>
    {plan || 'FREE'} {plan === 'premium' ? '★' : plan === 'pro' ? '◆' : '○'}
  </Badge>
}

function LifecycleBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    trial:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
    cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    expired:   'bg-slate-700/50 text-slate-500 border-slate-700/50',
  }
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase border tracking-widest", styles[status] || styles.expired)}>
       {status}
    </span>
  )
}
