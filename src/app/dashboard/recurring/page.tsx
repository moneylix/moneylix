'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, RefreshCw, Pause, Play, Trash2, Calendar,
  TrendingUp, TrendingDown, Clock, CheckCircle, X
} from 'lucide-react'

interface RecurringRule {
  id: number
  type: 'credit' | 'debit'
  amount: number
  currency: string
  note: string | null
  method: string | null
  frequency: string
  interval_value: number
  day_of_week: number | null
  day_of_month: number | null
  next_run_date: string
  last_run_date: string | null
  end_date: string | null
  total_generated: number
  status: string
  category_name: string | null
  category_icon: string | null
  category_color: string | null
  business_name: string | null
}

interface Category {
  id: number
  name: string
  type: string
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function RecurringPage() {
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({
    type: 'debit' as 'credit' | 'debit',
    amount: '',
    category_id: '',
    note: '',
    frequency: 'monthly',
    interval_value: '1',
    day_of_week: '',
    day_of_month: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
  })

  const getToken = () => localStorage.getItem('moneylix_session_token') || ''
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/recurring', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
      const data = await res.json()
      setRules(data.recurring || [])
    } catch { /* silent */ }
    setLoading(false)
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
      const data = await res.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchRules()
    fetchCategories()
  }, [])

  const handleCreate = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      showToast('Enter a valid amount')
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        type: form.type,
        amount: parseFloat(form.amount),
        category_id: form.category_id ? parseInt(form.category_id) : undefined,
        note: form.note || undefined,
        frequency: form.frequency,
        interval_value: parseInt(form.interval_value) || 1,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
      }
      if (form.frequency === 'weekly' && form.day_of_week) {
        body.day_of_week = parseInt(form.day_of_week)
      }
      if (['monthly', 'yearly'].includes(form.frequency) && form.day_of_month) {
        body.day_of_month = parseInt(form.day_of_month)
      }

      const res = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Failed'); setSaving(false); return }

      showToast('Recurring transaction created!')
      setShowForm(false)
      setForm({ type: 'debit', amount: '', category_id: '', note: '', frequency: 'monthly', interval_value: '1', day_of_week: '', day_of_month: '', start_date: new Date().toISOString().split('T')[0], end_date: '' })
      fetchRules()
    } catch {
      showToast('Something went wrong')
    }
    setSaving(false)
  }

  const handleToggle = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    await fetch(`/api/recurring/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify({ status: newStatus }),
    })
    showToast(newStatus === 'active' ? 'Resumed' : 'Paused')
    fetchRules()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this recurring transaction?')) return
    await fetch(`/api/recurring/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` },
    })
    showToast('Deleted')
    fetchRules()
  }

  return (
    <div className="space-y-4 max-w-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/settings" className="p-2 rounded-xl hover:bg-white/5 transition">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-white">Recurring Transactions</h1>
            <p className="text-[10px] text-slate-400">Auto-create income & expenses on a schedule</p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-lime-400 text-neutral-900 font-semibold hover:bg-lime-300 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-white">New Recurring Transaction</p>
            <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-white/5"><X className="w-4 h-4 text-slate-400" /></button>
          </div>

          {/* Type toggle */}
          <div className="flex gap-2">
            {(['debit', 'credit'] as const).map(t => (
              <button key={t} onClick={() => setForm({ ...form, type: t })}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                  form.type === t
                    ? t === 'credit' ? 'bg-lime-100 text-lime-700' : 'bg-rose-100 text-rose-700'
                    : 'border-white/10 text-slate-400 hover:bg-white/5'
                }`}
              >
                {t === 'credit' ? '↑ Income' : '↓ Expense'}
              </button>
            ))}
          </div>

          {/* Amount */}
          <input
            type="number"
            placeholder="Amount (₹)"
            value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />

          {/* Category */}
          <select
            value={form.category_id}
            onChange={e => setForm({ ...form, category_id: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="">No category</option>
            {categories.filter(c => c.type === form.type || c.type === 'both').map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Note */}
          <input
            type="text"
            placeholder="Note (e.g., Rent, Salary, Netflix)"
            value={form.note}
            onChange={e => setForm({ ...form, note: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />

          {/* Frequency */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.frequency}
              onChange={e => setForm({ ...form, frequency: e.target.value })}
              className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <input
              type="number"
              min="1"
              placeholder="Every N"
              value={form.interval_value}
              onChange={e => setForm({ ...form, interval_value: e.target.value })}
              className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>

          {/* Day selector */}
          {form.frequency === 'weekly' && (
            <select value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none">
              <option value="">Day of week</option>
              {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          )}
          {['monthly', 'yearly'].includes(form.frequency) && (
            <input type="number" min="1" max="31" placeholder="Day of month (1-31)"
              value={form.day_of_month} onChange={e => setForm({ ...form, day_of_month: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus:outline-none" />
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-slate-500 mb-0.5 block">Start date</label>
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[9px] text-slate-500 mb-0.5 block">End date (optional)</label>
              <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none" />
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleCreate}
            disabled={saving || !form.amount}
            className="w-full py-2.5 rounded-xl bg-lime-400 text-sm font-bold text-neutral-900 hover:bg-lime-300 active:scale-95 transition-all disabled:opacity-40"
          >
            {saving ? 'Creating...' : 'Create Recurring Transaction'}
          </button>
        </div>
      )}

      {/* Rules list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <RefreshCw className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No recurring transactions yet</p>
          <p className="text-[10px] text-slate-500 mt-1">Set up rent, salary, subscriptions, or any repeat payment</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div key={rule.id} className={`rounded-2xl border p-4 transition ${
              rule.status === 'active' ? 'border-white/10 bg-white/5' :
              rule.status === 'paused' ? 'border-amber-500/20 bg-amber-500/5 opacity-70' :
              'border-white/5 bg-white/3 opacity-50'
            }`}>
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  rule.type === 'credit' ? 'bg-emerald-500/15' : 'bg-rose-500/15'
                }`}>
                  {rule.type === 'credit'
                    ? <TrendingUp className="w-4 h-4 text-lime-700" />
                    : <TrendingDown className="w-4 h-4 text-rose-600" />
                  }
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-white truncate">
                      {rule.note || rule.category_name || (rule.type === 'credit' ? 'Income' : 'Expense')}
                    </p>
                    {rule.status === 'paused' && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">PAUSED</span>}
                    {rule.status === 'completed' && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-slate-500/20 text-slate-400">DONE</span>}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {FREQUENCY_LABELS[rule.frequency]}
                    {rule.interval_value > 1 ? ` (every ${rule.interval_value})` : ''}
                    {rule.frequency === 'weekly' && rule.day_of_week !== null ? ` on ${DAY_NAMES[rule.day_of_week]}` : ''}
                    {rule.frequency === 'monthly' && rule.day_of_month ? ` on ${rule.day_of_month}${ordinal(rule.day_of_month)}` : ''}
                    {' · '}{rule.total_generated} generated
                  </p>
                </div>

                {/* Amount */}
                <p className={`text-sm font-black flex-shrink-0 ${rule.type === 'credit' ? 'text-lime-700' : 'text-rose-600'}`}>
                  {rule.type === 'credit' ? '+' : '-'}₹{rule.amount.toLocaleString('en-IN')}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                <div className="flex items-center gap-3 text-[9px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    Next: {rule.next_run_date ? new Date(rule.next_run_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                  </span>
                  {rule.last_run_date && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      Last: {new Date(rule.last_run_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {rule.status !== 'completed' && (
                    <button
                      onClick={() => handleToggle(rule.id, rule.status)}
                      className="p-1.5 rounded-lg hover:bg-white/5 transition"
                      title={rule.status === 'active' ? 'Pause' : 'Resume'}
                    >
                      {rule.status === 'active'
                        ? <Pause className="w-3.5 h-3.5 text-amber-400" />
                        : <Play className="w-3.5 h-3.5 text-lime-700" />
                      }
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-500/10 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 border border-white/10 text-white px-4 py-2 rounded-full shadow-2xl z-50 text-xs">
          {toast}
        </div>
      )}
    </div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}
