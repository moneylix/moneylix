'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Shield, RefreshCw } from 'lucide-react'

interface AdminUser { id: number; username: string; email: string; created_at: string }

export default function AdminAccountsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const token = () => JSON.parse(localStorage.getItem('moneylix_admin_auth') || '{}').token

  const fetchAdmins = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/admins', { headers: { Authorization: `Bearer ${token()}` } })
      const data = await res.json()
      setAdmins(data.admins || [])
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { fetchAdmins() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSubmitting(true)
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed'); return }
      setShowForm(false); setForm({ username: '', email: '', password: '' }); fetchAdmins()
    } catch { setError('Network error') } finally { setSubmitting(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this admin account?')) return
    await fetch(`/api/admin/admins/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
    fetchAdmins()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Admin Accounts</h1>
          <p className="text-sm text-slate-400 mt-1">Manage who has access to the admin panel</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAdmins} className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-black shadow-lg">
            <Plus className="w-3.5 h-3.5" /> Add Admin
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 space-y-3">
          <p className="text-xs font-black text-violet-400 uppercase tracking-widest">New Admin Account</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1">Username *</label>
              <input required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="e.g. admin2" className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1">Email *</label>
              <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="admin@moneylix.in" className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1">Password *</label>
              <input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
            </div>
          </div>
          {error && <p className="text-xs text-rose-400 font-bold">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-violet-500 text-white text-xs font-black disabled:opacity-60">{submitting ? 'Creating...' : 'Create Admin'}</button>
            <button type="button" onClick={() => { setShowForm(false); setError('') }} className="px-4 py-2 rounded-xl border border-white/10 text-slate-400 text-xs font-black">Cancel</button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-slate-800/30">
              <tr>
                {['Admin', 'Email', 'Created', ''].map(h => <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {admins.map(a => (
                <tr key={a.id} className="hover:bg-white/5 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center text-xs font-black text-violet-400 border border-violet-500/20">{a.username[0].toUpperCase()}</div>
                      <div>
                        <p className="text-sm font-black text-white">{a.username}</p>
                        <div className="flex items-center gap-1 mt-0.5"><Shield className="w-2.5 h-2.5 text-violet-400" /><span className="text-[10px] text-violet-400 font-bold">Admin</span></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{a.email}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {admins.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-xs">No admin accounts found</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
