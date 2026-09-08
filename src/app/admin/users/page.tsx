'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, Edit2, X, Check, Users, Shield, Mail, Calendar, CreditCard, ArrowRight, Ban, ShieldCheck, Trash2, Eye } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { cn } from '@/lib/utils/format'

interface UserRow {
  id: number
  username: string
  email: string
  created_at: string
  plan: string | null
  sub_status: string | null
  sub_expires: string | null
  amount_paid: number | null
  suspended: number
}

interface UserDataView {
  user: { id: number; username: string; email: string }
  businesses: { id: number; name: string }[]
  transactions: {
    id: number; date: string; type: string; amount: number
    description: string | null; status: string; business_name: string
  }[]
}

interface EditState {
  userId: number
  plan: string
  status: string
  expires_at: string
  amount_paid: string
  notes: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyUserId, setBusyUserId] = useState<number | null>(null)
  const [dataView, setDataView] = useState<UserDataView | null>(null)
  const [dataViewLoading, setDataViewLoading] = useState(false)

  const getToken = () => {
    try { return JSON.parse(localStorage.getItem('moneylix_admin_auth') ?? '{}').token ?? '' } catch { return '' }
  }

  const load = useCallback(async () => {
    setLoading(true)
    const token = getToken()
    const params = new URLSearchParams({ page: String(page), ...(search ? { search } : {}) })
    const res = await fetch(`/api/admin/users?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    setUsers(data.users ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page, search])

  useEffect(() => { load() }, [load])

  const startEdit = (u: UserRow) => {
    setEditing({
      userId: u.id,
      plan: u.plan ?? 'free',
      status: u.sub_status ?? 'active',
      expires_at: u.sub_expires ? u.sub_expires.slice(0, 10) : '',
      amount_paid: String(u.amount_paid ?? 0),
      notes: '',
    })
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    const token = getToken()
    await fetch(`/api/admin/users/${editing.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        plan: editing.plan,
        status: editing.status,
        expires_at: editing.expires_at || null,
        amount_paid: parseFloat(editing.amount_paid) || 0,
        notes: editing.notes || null,
      }),
    })
    setEditing(null)
    setSaving(false)
    load()
  }

  const toggleSuspend = async (u: UserRow) => {
    const suspending = !u.suspended
    const verb = suspending ? 'suspend' : 'unsuspend'
    if (!confirm(`${suspending ? 'Suspend' : 'Unsuspend'} "${u.username}"?${suspending ? ' They will be signed out immediately and unable to log back in until unsuspended.' : ''}`)) return
    setBusyUserId(u.id)
    const token = getToken()
    await fetch(`/api/admin/users/${u.id}/suspend`, {
      method: suspending ? 'POST' : 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setBusyUserId(null)
    load()
  }

  const deleteUser = async (u: UserRow) => {
    if (!confirm(`Permanently delete "${u.username}" and all their data? This cannot be undone.`)) return
    if (!confirm(`Really delete "${u.username}"? Type OK in the next box only if you're certain.`)) return
    setBusyUserId(u.id)
    const token = getToken()
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setBusyUserId(null)
    if (res.ok) load()
    else alert('Delete failed. Check the audit log or server console for details.')
  }

  const viewData = async (u: UserRow) => {
    setDataViewLoading(true)
    const token = getToken()
    const res = await fetch(`/api/admin/users/${u.id}/data`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    setDataView(data)
    setDataViewLoading(false)
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-10">
      {/* Header */}
      <header className="flex flex-col gap-6 rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl md:flex-row md:items-center md:justify-between shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <div className="p-1 rounded bg-violet-500/20 text-violet-400"><Users className="w-3 h-3" /></div>
             <p className="text-[10px] text-violet-400 font-black tracking-[0.2em] uppercase">User Management</p>
          </div>
          <h1 className="text-3xl font-black text-white">Client Identities</h1>
          <p className="text-sm text-slate-400 font-medium mt-2">Oversee all registered accounts and their tier standings.</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-2xl border border-white/5">
           <div className="px-4 text-center">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Total Clients</p>
              <p className="text-xl font-black text-white font-mono">{total}</p>
           </div>
           <div className="w-px h-8 bg-white/10" />
           <Button variant="primary" size="sm" className="rounded-xl px-6">Broadcast News</Button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search identities by username or email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/50 pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-[32px] border border-white/5 bg-white/5 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 px-6 py-4">
            <thead>
              <tr className="text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                <th className="px-6 py-4">Identity</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4 text-center">License Tier</th>
                <th className="px-6 py-4 text-center">Lifecycle</th>
                <th className="px-6 py-4 text-right">Revenue Contrib.</th>
                <th className="px-6 py-4 text-center">Registered</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                 <tr><td colSpan={7} className="px-6 py-20 text-center"><div className="w-10 h-10 border-3 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" /><p className="text-xs text-slate-500 font-black uppercase tracking-widest mt-4">Retrieving Identities...</p></td></tr>
              ) : users.length === 0 ? (
                 <tr><td colSpan={7} className="px-6 py-20 text-center text-slate-500 font-bold">No matching identities found.</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="group bg-slate-900/60 hover:bg-slate-800 transition-all duration-300 shadow-md">
                  <td className="px-6 py-4 rounded-l-2xl font-black text-white group-hover:text-violet-400 transition-colors uppercase text-xs tracking-tight">
                    <div className="flex items-center gap-2">
                      {u.username}
                      {!!u.suspended && (
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20">Suspended</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400 font-medium">
                    {u.email}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <LicenseTierBadge plan={u.plan} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    {u.sub_status ? (
                      <LifecycleBadge status={u.sub_status} />
                    ) : <span className="text-slate-600 font-black text-[10px]">INACTIVE</span>}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-emerald-400 font-mono text-sm">
                    {u.amount_paid ? `₹${u.amount_paid.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-center">
                     <p className="text-[10px] font-black text-white">{new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                     <p className="text-[9px] text-slate-600 font-bold uppercase">{new Date(u.created_at).getFullYear()}</p>
                  </td>
                  <td className="px-6 py-4 text-right rounded-r-2xl">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => viewData(u)}
                        title="View financial data (read-only)"
                        className="p-2.5 rounded-xl text-slate-500 hover:text-white hover:bg-cyan-500/20 transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => startEdit(u)}
                        title="Edit subscription"
                        className="p-2.5 rounded-xl text-slate-500 hover:text-white hover:bg-violet-500/20 transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleSuspend(u)}
                        disabled={busyUserId === u.id}
                        title={u.suspended ? 'Unsuspend' : 'Suspend'}
                        className="p-2.5 rounded-xl text-slate-500 hover:text-white hover:bg-amber-500/20 transition-all disabled:opacity-40"
                      >
                        {u.suspended ? <ShieldCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => deleteUser(u)}
                        disabled={busyUserId === u.id}
                        title="Delete permanently"
                        className="p-2.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/20 transition-all disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-10 py-6 border-t border-white/5 bg-black/20">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Page <span className="text-white">{page}</span> of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 rounded-xl border-white/5"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 rounded-xl border-white/5"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal - uses shared Modal component */}
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Modify Client Entitlements">
        {editing && (
          <div className="space-y-6 py-2">
             <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400 font-black text-xl">U</div>
                <div>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest uppercase mb-0.5 whitespace-nowrap">Operator: # {editing.userId}</p>
                   <p className="text-lg font-black text-white leading-tight">Configuring Subscription Entity</p>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <Select label="Deployment Tier" value={editing.plan} onChange={e => setEditing({ ...editing, plan: e.target.value })} 
                  options={[{ label: 'Free Tier', value: 'free' }, { label: 'Professional Tier', value: 'pro' }, { label: 'Premium Enterprise', value: 'premium' }]} />
                <Select label="Entity Status" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}
                  options={[{ label: 'Active', value: 'active' }, { label: 'Trial Period', value: 'trial' }, { label: 'Cancelled', value: 'cancelled' }, { label: 'Expired', value: 'expired' }]} />
             </div>

             <div className="grid grid-cols-2 gap-4">
                <Input label="Expiration Sequence" type="date" value={editing.expires_at} onChange={e => setEditing({ ...editing, expires_at: e.target.value })} />
                <Input label="LTV Impact (₹)" type="number" value={editing.amount_paid} onChange={e => setEditing({ ...editing, amount_paid: e.target.value })} />
             </div>

             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Log Entries / Internal Notes</label>
                <textarea
                  value={editing.notes}
                  onChange={e => setEditing({ ...editing, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-[24px] border border-white/10 bg-slate-900 px-5 py-4 text-sm text-white outline-none focus:border-violet-500 transition shadow-inner resize-none placeholder:text-slate-600 font-medium"
                  placeholder="System logs, internal justifications..."
                />
             </div>

             <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={() => setEditing(null)} className="flex-1 font-black text-xs uppercase tracking-widest">Abort</Button>
                <Button onClick={saveEdit} disabled={saving} className="flex-1 font-black text-xs uppercase tracking-widest gap-2 bg-gradient-to-r from-violet-500 to-purple-600">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />} Commit Changes
                </Button>
             </div>
          </div>
        )}
      </Modal>

      {/* Read-only data view modal */}
      <Modal isOpen={!!dataView || dataViewLoading} onClose={() => setDataView(null)} title="Client Financial Data (Read-Only)">
        {dataViewLoading ? (
          <div className="py-16 text-center">
            <div className="w-10 h-10 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : dataView && (
          <div className="space-y-5 py-2">
            <div className="p-4 rounded-2xl bg-slate-900 border border-white/5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Viewing</p>
              <p className="text-lg font-black text-white">{dataView.user.username}</p>
              <p className="text-xs text-slate-400">{dataView.user.email}</p>
              <p className="text-[10px] text-cyan-400 font-bold mt-2">
                {dataView.businesses.length} business{dataView.businesses.length === 1 ? '' : 'es'} · showing last {dataView.transactions.length} transaction{dataView.transactions.length === 1 ? '' : 's'}
              </p>
            </div>

            <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-white/5">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-900">
                  <tr className="text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Business</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {dataView.transactions.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500 font-bold">No transactions.</td></tr>
                  ) : dataView.transactions.map(t => (
                    <tr key={t.id} className="border-t border-white/5">
                      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                      <td className="px-4 py-2.5 text-slate-300">{t.business_name}</td>
                      <td className="px-4 py-2.5 text-slate-300 truncate max-w-[180px]">{t.description || '—'}</td>
                      <td className={cn("px-4 py-2.5 text-right font-mono font-bold whitespace-nowrap", t.type === 'credit' ? 'text-emerald-400' : 'text-rose-400')}>
                        {t.type === 'credit' ? '+' : '−'}₹{Math.abs(t.amount).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest text-center">This view was recorded in the audit log</p>
          </div>
        )}
      </Modal>
    </div>
  )
}

function LicenseTierBadge({ plan }: { plan: string | null }) {
  if (plan === 'premium') return <Badge variant="credit" className="bg-amber-500/10 text-amber-400 border-amber-500/20 font-black text-[9px]">PREMIUM</Badge>
  if (plan === 'pro')     return <Badge variant="credit" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-black text-[9px]">PRO</Badge>
  return <Badge variant="default" className="font-black text-[9px]">FREE</Badge>
}

function LifecycleBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    trial:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
    cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    expired:   'bg-slate-700/50 text-slate-500 border-slate-700/50',
  }
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase border tracking-widest shadow-sm", styles[status] || styles.expired)}>
       {status}
    </span>
  )
}
