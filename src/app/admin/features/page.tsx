'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, X, Trash2, Check, Edit2 } from 'lucide-react'

interface Feature {
  id: number
  title: string
  description: string | null
  status: string
  priority: string
  category: string
  created_at: string
  updated_at: string
}

const STATUS_OPTIONS  = ['pending', 'in_progress', 'completed', 'cancelled'] as const
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'] as const
const CATEGORY_OPTIONS = ['general', 'ui', 'feature', 'bug', 'performance', 'integration'] as const

const STATUS_STYLE: Record<string, string> = {
  pending:     'bg-slate-700/60 text-slate-300',
  in_progress: 'bg-blue-500/20 text-blue-300',
  completed:   'bg-emerald-500/20 text-emerald-400',
  cancelled:   'bg-rose-500/20 text-rose-400',
}
const PRIORITY_STYLE: Record<string, string> = {
  low:      'bg-slate-700/60 text-slate-400',
  medium:   'bg-yellow-500/20 text-yellow-400',
  high:     'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
}

const blank = { title: '', description: '', status: 'pending', priority: 'medium', category: 'general' }

export default function AdminFeaturesPage() {
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...blank })
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')

  const getToken = () => {
    try { return JSON.parse(localStorage.getItem('moneylix_admin_auth') ?? '{}').token ?? '' } catch { return '' }
  }

  const load = useCallback(async () => {
    setLoading(true)
    const token = getToken()
    const res = await fetch('/api/admin/features', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    setFeatures(data.features ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditId(null); setForm({ ...blank }); setShowForm(true) }

  const openEdit = (f: Feature) => {
    setEditId(f.id)
    setForm({ title: f.title, description: f.description ?? '', status: f.status, priority: f.priority, category: f.category })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const token = getToken()
    if (editId) {
      await fetch('/api/admin/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: editId, ...form }),
      })
    } else {
      await fetch('/api/admin/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  const remove = async (id: number) => {
    if (!confirm('Delete this feature?')) return
    const token = getToken()
    await fetch(`/api/admin/features?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    load()
  }

  const filtered = filterStatus ? features.filter(f => f.status === filterStatus) : features

  const byStatus = (s: string) => filtered.filter(f => f.status === s)
  const statuses: (typeof STATUS_OPTIONS[number])[] = ['pending', 'in_progress', 'completed', 'cancelled']

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Feature Tracker</h1>
          <p className="text-sm text-slate-400 mt-1">{features.length} feature{features.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Feature
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['', ...STATUS_OPTIONS].map(s => (
          <button
            key={s || 'all'}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              filterStatus === s
                ? 'bg-violet-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {s ? s.replace('_', ' ') : 'All'} {s ? `(${features.filter(f => f.status === s).length})` : `(${features.length})`}
          </button>
        ))}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-white">{editId ? 'Edit Feature' : 'New Feature'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-400"
                  placeholder="Feature name or bug description"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-400 resize-none"
                  placeholder="Details, user impact, acceptance criteria…"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-800 px-2 py-2 text-xs text-white outline-none focus:border-violet-400">
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-800 px-2 py-2 text-xs text-white outline-none focus:border-violet-400">
                    {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-800 px-2 py-2 text-xs text-white outline-none focus:border-violet-400">
                    {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:text-white transition">
                Cancel
              </button>
              <button onClick={save} disabled={saving || !form.title.trim()}
                className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban columns */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {statuses.map(status => (
            <div key={status} className="rounded-2xl border border-white/10 bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLE[status]}`}>
                  {status.replace('_', ' ')}
                </span>
                <span className="text-xs text-slate-500">{byStatus(status).length}</span>
              </div>
              <div className="p-3 space-y-2 min-h-[80px]">
                {byStatus(status).map(f => (
                  <div key={f.id} className="rounded-xl border border-white/8 bg-slate-800/60 p-3 group">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-white leading-snug">{f.title}</p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                        <button onClick={() => openEdit(f)} className="p-1 text-slate-500 hover:text-violet-400 transition">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => remove(f.id)} className="p-1 text-slate-500 hover:text-rose-400 transition">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {f.description && (
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{f.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${PRIORITY_STYLE[f.priority]}`}>
                        {f.priority}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-500 text-[9px]">
                        {f.category}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-600 mt-1.5">{new Date(f.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
                {byStatus(status).length === 0 && (
                  <p className="text-[11px] text-slate-600 text-center py-4">No items</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
