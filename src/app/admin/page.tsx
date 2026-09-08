'use client'

import { useEffect, useState } from 'react'
import { Users, IndianRupee, Lightbulb, TrendingUp, Crown, Star, Circle, ArrowRight, ShieldCheck, Plus, Calendar, KeyRound, Eye, EyeOff } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils/format'

interface Stats {
  totalUsers: number
  totalTransactions: number
  totalRevenue: number
  pendingFeatures: number
  plans: { free: number; pro: number; premium: number }
  recentUsers: {
    id: number; username: string; email: string; created_at: string
    plan: string | null; sub_status: string | null
  }[]
  renewalAlerts: { username: string; plan: string; expires_at: string }[]
  gatewayStatus: { provider: string; status: string; uptime: string; lastSync: string }
}

function StatCard({ icon: Icon, label, value, sub, color, bg }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string; bg: string
}) {
  return (
    <div className={cn("rounded-[32px] border border-white/10 bg-gradient-to-br p-6 backdrop-blur-xl shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl", bg)}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner", color)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-3xl font-black text-white font-mono tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-tight">{sub}</p>}
    </div>
  )
}

function ChangePasswordWidget() {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [status, setStatus] = useState<'idle'|'loading'|'ok'|'err'>('idle')
  const [msg, setMsg] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    const raw = localStorage.getItem('moneylix_admin_auth')
    if (!raw) { setStatus('err'); setMsg('Not authenticated'); return }
    const { token } = JSON.parse(raw)
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword: cur, newPassword: next }),
    })
    const data = await res.json()
    if (res.ok) { setStatus('ok'); setMsg('Password changed successfully'); setCur(''); setNext('') }
    else { setStatus('err'); setMsg(data.error || 'Failed') }
  }

  return (
    <div className="rounded-[32px] border border-rose-500/20 bg-rose-500/5 p-8 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-rose-500/20 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-rose-400" />
        </div>
        <div>
          <h3 className="text-base font-black text-white">Change Admin Password</h3>
          <p className="text-[10px] text-rose-400/60 font-bold uppercase tracking-widest">Security — change default immediately</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="relative">
          <input type={showCur ? 'text' : 'password'} placeholder="Current password" value={cur} onChange={e => setCur(e.target.value)} required
            className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-rose-500/50 pr-10" />
          <button type="button" onClick={() => setShowCur(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
            {showCur ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="relative">
          <input type={showNext ? 'text' : 'password'} placeholder="New password (min 8 chars)" value={next} onChange={e => setNext(e.target.value)} required minLength={8}
            className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-rose-500/50 pr-10" />
          <button type="button" onClick={() => setShowNext(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
            {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {msg && <p className={`text-xs font-bold ${status === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>{msg}</p>}
        <Button type="submit" loading={status === 'loading'} variant="danger" className="w-full rounded-xl">
          Update Password
        </Button>
      </form>
    </div>
  )
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const raw = localStorage.getItem('moneylix_admin_auth')
    if (!raw) return
    const { token } = JSON.parse(raw)
    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error('Unauthorized')
        return r.json()
      })
      .then(setStats)
      .catch((err) => {
        console.error('Fetch error:', err)
        setStats(null)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!stats || !stats.plans) return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-4">
       <div className="p-4 rounded-full bg-white/5"><ShieldCheck className="w-10 h-10" /></div>
       <p className="font-bold">Access restricted or failed to load stats.</p>
    </div>
  )

  const paidUsers = (stats.plans?.pro ?? 0) + (stats.plans?.premium ?? 0)
  const revenue = stats.totalRevenue.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-10">
      {/* Header */}
      <header className="flex flex-col gap-6 rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl md:flex-row md:items-center md:justify-between shadow-2xl">
        <div>
          <p className="text-[10px] text-primary font-black tracking-[0.2em] uppercase">Control Panel</p>
          <h1 className="text-3xl font-black text-white mt-1">Platform Intelligence</h1>
          <p className="text-sm text-slate-400 font-medium mt-2">Real-time oversight of users, revenue, and platform health.</p>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" className="rounded-2xl px-6">Export Reports</Button>
           <Button className="rounded-2xl px-6">System Health</Button>
        </div>
      </header>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Users} label="Total Userbase" value={stats.totalUsers} color="bg-blue-500/20 text-blue-400" bg="from-blue-500/10 to-white/5" />
        <StatCard icon={TrendingUp} label="Platform Activity" value={stats.totalTransactions.toLocaleString()} sub="global transactions" color="bg-emerald-500/20 text-emerald-400" bg="from-emerald-500/10 to-white/5" />
        <StatCard icon={IndianRupee} label="Gross Revenue" value={revenue} color="bg-amber-500/20 text-amber-400" bg="from-amber-500/10 to-white/5" />
        <StatCard icon={Lightbulb} label="Product Backlog" value={stats.pendingFeatures} sub="voted features" color="bg-violet-500/20 text-violet-400" bg="from-violet-500/10 to-white/5" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="space-y-8 lg:col-span-1">
          {/* Plan distribution */}
          <div className="rounded-[32px] border border-white/5 bg-white/5 p-8 backdrop-blur-xl shadow-2xl flex flex-col">
            <h3 className="text-2xl font-black text-white tracking-tight mb-6 text-center">Plan Distribution</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-900 shadow-inner group hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500"><Circle className="w-5 h-5" /></div>
                  <div><p className="text-xs font-black text-white">Free Tier</p><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Growth Engine</p></div>
                </div>
                <p className="text-xl font-black text-white font-mono">{stats.plans.free ?? 0}</p>
              </div>
              <div className="flex items-center justify-between p-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 group hover:bg-cyan-500/15 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400"><Star className="w-5 h-5" /></div>
                  <div><p className="text-xs font-black text-cyan-400">Pro Tier</p><p className="text-[10px] font-bold text-cyan-500/40 uppercase tracking-widest">Mainstream</p></div>
                </div>
                <p className="text-xl font-black text-white font-mono">{stats.plans.pro ?? 0}</p>
              </div>
              <div className="flex items-center justify-between p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 group hover:bg-amber-500/15 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400"><Crown className="w-5 h-5" /></div>
                  <div><p className="text-xs font-black text-amber-400">Premium Tier</p><p className="text-[10px] font-bold text-amber-500/40 uppercase tracking-widest">High Value</p></div>
                </div>
                <p className="text-xl font-black text-white font-mono">{stats.plans.premium ?? 0}</p>
              </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-white/5">
               <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Premium Conversion</span>
                  <span className="text-sm font-black text-amber-400 font-mono">{stats.totalUsers > 0 ? Math.round((paidUsers / stats.totalUsers) * 100) : 0}%</span>
               </div>
               <div className="h-3 bg-slate-900 rounded-full overflow-hidden shadow-inner flex">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-amber-400" style={{ width: `${(paidUsers / Math.max(1, stats.totalUsers)) * 100}%` }} />
               </div>
            </div>
          </div>

          {/* Change Password */}
          <ChangePasswordWidget />

          {/* Gateway Status */}
          <div className="rounded-[32px] border border-white/5 bg-white/5 p-8 backdrop-blur-xl shadow-2xl flex flex-col">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-white tracking-tight">Payment Gateway</h3>
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                   <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Live</span>
                </div>
             </div>
             <div className="p-5 rounded-2xl bg-slate-900 border border-white/5 space-y-4 shadow-inner">
                <div className="flex items-center justify-between">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Provider</p>
                   <p className="text-xs font-black text-white">{stats.gatewayStatus.provider}</p>
                </div>
                <div className="flex items-center justify-between">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Uptime Score</p>
                   <p className="text-xs font-black text-emerald-400 font-mono">{stats.gatewayStatus.uptime}</p>
                </div>
                <div className="flex items-center justify-between">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Current Status</p>
                   <p className="text-[10px] font-black text-white bg-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-tighter">{stats.gatewayStatus.status}</p>
                </div>
             </div>
             <div className="mt-6 flex items-center gap-3 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                <div className="w-8 h-[2px] bg-white/10" />
                Last check: {new Date(stats.gatewayStatus.lastSync).toLocaleTimeString()}
             </div>
          </div>
        </div>

        {/* Right Column (Scrollable Lists) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Renewal Alerts */}
          <div className="rounded-[32px] border border-amber-500/10 bg-amber-500/5 p-8 backdrop-blur-xl shadow-2xl flex flex-col">
             <div className="flex items-center justify-between mb-8">
                <div>
                   <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">Renewal Alerts <Badge variant="pending" className="rounded-lg">{stats.renewalAlerts.length}</Badge></h3>
                   <p className="text-[10px] text-amber-500/60 font-black uppercase tracking-widest mt-1">Ending in next 7 orbits (Days)</p>
                </div>
                <Button variant="ghost" className="text-amber-500 font-black text-[10px] uppercase gap-2 hover:bg-amber-500/10">Batch Notify <Plus className="w-4 h-4" /></Button>
             </div>
             
             <div className="space-y-3">
                {stats.renewalAlerts.length === 0 ? (
                  <div className="py-12 text-center text-slate-600 font-black uppercase tracking-widest text-[10px]">No immediate renewals detected.</div>
                ) : stats.renewalAlerts.map((alert, i) => (
                  <div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-slate-900 border border-white/5 group hover:border-amber-500/30 transition-all">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500"><Calendar className="w-5 h-5" /></div>
                        <div>
                           <p className="text-sm font-black text-white uppercase tracking-tight">{alert.username}</p>
                           <p className="text-[10px] text-slate-500 font-black uppercase opacity-60 group-hover:opacity-100 transition-opacity tracking-widest">{alert.plan} tier</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Final Date</p>
                        <p className="text-sm font-black text-white font-mono">{new Date(alert.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                     </div>
                  </div>
                ))}
             </div>
          </div>

          {/* Recent users table */}
          <div className="rounded-[32px] border border-white/5 bg-white/5 p-8 backdrop-blur-xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">Recent Onboarding</h3>
                  <p className="text-sm text-slate-400 font-medium uppercase tracking-widest text-[10px] mt-1">Global User Acquisition</p>
               </div>
               <Button variant="ghost" className="text-emerald-400 font-black text-[10px] uppercase gap-2 hover:bg-emerald-400/10" onClick={() => (window.location.href = '/admin/users')}>Manage Users <ArrowRight className="w-4 h-4" /></Button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-4">
                    <th className="px-6 py-2">Identities</th>
                    <th className="px-6 py-2">Contact</th>
                    <th className="px-6 py-2 text-center">License</th>
                    <th className="px-6 py-2 text-right">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentUsers.map((u) => (
                    <tr key={u.id} className="rounded-2xl bg-slate-900/60 group hover:bg-slate-800 transition-all duration-300 shadow-md">
                      <td className="rounded-l-2xl px-6 py-5">
                         <p className="font-black text-white group-hover:text-primary transition-colors">{u.username}</p>
                         <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">UID: {u.id}</p>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-400 font-medium">{u.email}</td>
                      <td className="px-6 py-5 text-center">
                         <LicenseBadge plan={u.plan} />
                      </td>
                      <td className="rounded-r-2xl px-6 py-5 text-right font-bold text-slate-500 text-xs">
                         {new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LicenseBadge({ plan }: { plan: string | null }) {
  if (plan === 'premium') return <Badge variant="credit" className="bg-amber-500/10 text-amber-400 border-amber-500/20 font-black">PREMIUM</Badge>
  if (plan === 'pro')     return <Badge variant="credit" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-black">PRO</Badge>
  return <Badge variant="default" className="font-black">FREE</Badge>
}
