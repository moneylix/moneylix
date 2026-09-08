'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Users, Plus, X, Check, Pencil, Trash2, Banknote,
  Clock, CheckCircle2, Ban, UserPlus, DollarSign,
  ChevronLeft, ChevronRight, Search,
} from 'lucide-react'
import { useBusiness } from '@/lib/contexts/BusinessContext'
import { useCurrency } from '@/lib/contexts/CurrencyContext'

// ─── types ──────────────────────────────────────────────────────────────────

interface StaffMember {
  id: number
  name: string
  role_title: string | null
  email: string | null
  phone: string | null
  salary_amount: number | null
  salary_frequency: string
  status: string
  joined_date: string | null
}

interface PayrollEntry {
  id: number
  staff_member_id: number
  staff_name: string
  staff_role: string | null
  staff_email: string | null
  period: string
  base_salary: number
  allowances: number
  deductions: number
  net_amount: number
  status: string
  paid_date: string | null
  notes: string | null
}

// ─── helpers ────────────────────────────────────────────────────────────────

function getCurrentPeriod(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriod(period: string): string {
  const [y, m] = period.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m, 10) - 1]} ${y}`
}

// ─── status configs ─────────────────────────────────────────────────────────

const statusCfg: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700',   icon: Clock },
  paid:      { label: 'Paid',      cls: 'bg-lime-100 text-lime-700',     icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', cls: 'bg-neutral-100 text-neutral-500', icon: Ban },
}

// ─── component ──────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const { activeBusiness } = useBusiness()
  const { currentCurrency, currencies } = useCurrency()

  // State
  const [tab, setTab] = useState<'payroll' | 'staff'>('payroll')
  const [period, setPeriod] = useState(getCurrentPeriod())
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [entries, setEntries] = useState<PayrollEntry[]>([])
  const [entrySummary, setEntrySummary] = useState<Record<string, { total: number; count: number }>>({})
  const [loading, setLoading] = useState(true)
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustingEntry, setAdjustingEntry] = useState<PayrollEntry | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [mounted, setMounted] = useState(false)

  // Staff form
  const [staffForm, setStaffForm] = useState({
    name: '', role_title: '', email: '', phone: '',
    salary_amount: '', salary_frequency: 'monthly', joined_date: '',
  })
  // Adjust form
  const [adjustForm, setAdjustForm] = useState({ allowances: '', deductions: '', notes: '' })

  useEffect(() => { setMounted(true) }, [])

  const fmt = useCallback(
    (n: number) => {
      const sym = currencies.find((c) => c.code === currentCurrency)?.symbol ?? '₹'
      return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    },
    [currencies, currentCurrency],
  )

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchStaff = useCallback(async () => {
    if (!activeBusiness) return
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const params = new URLSearchParams({ businessId: String(activeBusiness.id) })
      if (searchQuery) params.set('search', searchQuery)
      const res = await fetch(`/api/payroll/staff?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) return
      const data = await res.json()
      setStaff(data.staff ?? [])
    } catch (e) {
      console.error(e)
    }
  }, [activeBusiness, searchQuery])

  const fetchEntries = useCallback(async () => {
    if (!activeBusiness) return
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const params = new URLSearchParams({
        businessId: String(activeBusiness.id),
        period,
      })
      const res = await fetch(`/api/payroll/entries?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) return
      const data = await res.json()
      setEntries(data.entries ?? [])
      setEntrySummary(data.summary ?? {})
    } catch (e) {
      console.error(e)
    }
  }, [activeBusiness, period])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchStaff(), fetchEntries()])
    setLoading(false)
  }, [fetchStaff, fetchEntries])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Staff CRUD ────────────────────────────────────────────────────────────

  const resetStaffForm = () =>
    setStaffForm({ name: '', role_title: '', email: '', phone: '', salary_amount: '', salary_frequency: 'monthly', joined_date: '' })

  const openAddStaff = () => {
    resetStaffForm()
    setEditingStaff(null)
    setShowStaffModal(true)
    setError('')
  }

  const openEditStaff = (s: StaffMember) => {
    setStaffForm({
      name: s.name,
      role_title: s.role_title ?? '',
      email: s.email ?? '',
      phone: s.phone ?? '',
      salary_amount: s.salary_amount ? String(s.salary_amount) : '',
      salary_frequency: s.salary_frequency,
      joined_date: s.joined_date ?? '',
    })
    setEditingStaff(s)
    setShowStaffModal(true)
    setError('')
  }

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeBusiness || !staffForm.name.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const url = editingStaff ? `/api/payroll/staff/${editingStaff.id}` : '/api/payroll/staff'
      const method = editingStaff ? 'PUT' : 'POST'
      const payload = {
        businessId: activeBusiness.id,
        name: staffForm.name.trim(),
        role_title: staffForm.role_title || null,
        email: staffForm.email || null,
        phone: staffForm.phone || null,
        salary_amount: staffForm.salary_amount || null,
        salary_frequency: staffForm.salary_frequency,
        joined_date: staffForm.joined_date || null,
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed'); return }
      setShowStaffModal(false)
      fetchStaff()
    } catch { setError('Network error') } finally { setSubmitting(false) }
  }

  const handleDeleteStaff = async (id: number) => {
    if (!confirm('Delete this staff member? Payroll entries will also be deleted.')) return
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      await fetch(`/api/payroll/staff/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      fetchAll()
    } catch (e) { console.error(e) }
  }

  const handleToggleStatus = async (s: StaffMember) => {
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      await fetch(`/api/payroll/staff/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status: s.status === 'active' ? 'inactive' : 'active' }),
      })
      fetchStaff()
    } catch (e) { console.error(e) }
  }

  // ── Payroll Operations ────────────────────────────────────────────────────

  const handleGeneratePayroll = async () => {
    if (!activeBusiness) return
    setSubmitting(true)
    setError('')
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const res = await fetch('/api/payroll/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ businessId: activeBusiness.id, period }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to generate'); return }
      fetchEntries()
    } catch { setError('Network error') } finally { setSubmitting(false) }
  }

  const openAdjust = (entry: PayrollEntry) => {
    setAdjustForm({
      allowances: String(entry.allowances || ''),
      deductions: String(entry.deductions || ''),
      notes: entry.notes ?? '',
    })
    setAdjustingEntry(entry)
    setShowAdjustModal(true)
    setError('')
  }

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustingEntry) return
    setSubmitting(true)
    setError('')
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const res = await fetch('/api/payroll/entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          id: adjustingEntry.id,
          allowances: adjustForm.allowances,
          deductions: adjustForm.deductions,
          notes: adjustForm.notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed'); return }
      setShowAdjustModal(false)
      fetchEntries()
    } catch { setError('Network error') } finally { setSubmitting(false) }
  }

  const handlePayEntry = async (entryId: number) => {
    if (!confirm('Mark as paid? This will create a debit transaction.')) return
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const res = await fetch(`/api/payroll/entries/${entryId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({}),
      })
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Failed'); return }
      fetchEntries()
    } catch (e) { console.error(e) }
  }

  // ── Summary values ────────────────────────────────────────────────────────

  const totalPayroll = entries.reduce((s, e) => s + e.net_amount, 0)
  const pendingAmount = entries.filter((e) => e.status === 'pending').reduce((s, e) => s + e.net_amount, 0)
  const paidAmount = entries.filter((e) => e.status === 'paid').reduce((s, e) => s + e.net_amount, 0)
  const activeStaff = staff.filter((s) => s.status === 'active').length

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold text-neutral-900">Payroll</h1>
          <p className="text-[10px] text-neutral-400">Manage staff salaries &amp; monthly payroll</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('payroll')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${tab === 'payroll' ? 'bg-lime-400 text-neutral-900' : 'bg-white text-neutral-400'}`}
          >
            Payroll
          </button>
          <button
            onClick={() => setTab('staff')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${tab === 'staff' ? 'bg-lime-400 text-neutral-900' : 'bg-white text-neutral-400'}`}
          >
            Staff
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-blue-50 text-blue-700">
          <Users className="w-4 h-4" />
          <div><p className="text-[10px] opacity-70">Active Staff</p><p className="text-sm font-bold">{activeStaff}</p></div>
        </div>
        <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-violet-50 text-violet-700">
          <DollarSign className="w-4 h-4" />
          <div><p className="text-[10px] opacity-70">Total ({formatPeriod(period)})</p><p className="text-sm font-bold font-mono">{fmt(totalPayroll)}</p></div>
        </div>
        <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-amber-50 text-amber-700">
          <Clock className="w-4 h-4" />
          <div><p className="text-[10px] opacity-70">Pending</p><p className="text-sm font-bold font-mono">{fmt(pendingAmount)}</p></div>
        </div>
        <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-lime-50 text-lime-700">
          <CheckCircle2 className="w-4 h-4" />
          <div><p className="text-[10px] opacity-70">Paid</p><p className="text-sm font-bold font-mono">{fmt(paidAmount)}</p></div>
        </div>
      </div>

      {/* ━━━━━━━━ PAYROLL TAB ━━━━━━━━ */}
      {tab === 'payroll' && (
        <>
          {/* Period Selector */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button onClick={() => setPeriod(shiftPeriod(period, -1))} className="p-1.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-400 transition">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold text-neutral-900 min-w-[80px] text-center">{formatPeriod(period)}</span>
              <button onClick={() => setPeriod(shiftPeriod(period, 1))} className="p-1.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-400 transition">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={handleGeneratePayroll}
              disabled={submitting}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-lime-400 text-neutral-900 hover:bg-lime-300 transition font-bold disabled:opacity-50"
            >
              <Plus className="w-3 h-3" /> Generate Payroll
            </button>
          </div>

          {error && <div className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-[10px]">{error}</div>}

          {/* Entries Table */}
          <div className="bg-white shadow-sm rounded-2xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-neutral-400 text-xs gap-1">
                <p>No payroll entries for {formatPeriod(period)}.</p>
                <button onClick={handleGeneratePayroll} className="text-lime-700 font-semibold">Generate now</button>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0"><table className="w-full text-xs">
                <thead className="border-b border-black/5 bg-neutral-50">
                  <tr>
                    {['Staff', 'Base', 'Allowances', 'Deductions', 'Net', 'Status', ''].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-neutral-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {entries.map((entry) => {
                    const sc = statusCfg[entry.status] || statusCfg.pending
                    const SIcon = sc.icon
                    return (
                      <tr key={entry.id} className="hover:bg-neutral-50 transition">
                        <td className="px-3 py-2.5">
                          <p className="text-xs font-medium text-neutral-900">{entry.staff_name}</p>
                          {entry.staff_role && <p className="text-[10px] text-neutral-400">{entry.staff_role}</p>}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-neutral-600">{fmt(entry.base_salary)}</td>
                        <td className="px-3 py-2.5 font-mono text-emerald-600">
                          {entry.allowances > 0 ? '+' + fmt(entry.allowances) : '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-rose-600">
                          {entry.deductions > 0 ? '-' + fmt(entry.deductions) : '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-neutral-900">{fmt(entry.net_amount)}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sc.cls}`}>
                            <SIcon className="w-2.5 h-2.5" /> {sc.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {entry.status === 'pending' && (
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => openAdjust(entry)}
                                className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 transition"
                                title="Adjust"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handlePayEntry(entry.id)}
                                className="p-1 rounded-lg hover:bg-lime-50 text-lime-600 transition"
                                title="Mark as Paid"
                              >
                                <Banknote className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table></div>
            )}
          </div>
        </>
      )}

      {/* ━━━━━━━━ STAFF TAB ━━━━━━━━ */}
      {tab === 'staff' && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-lime-400 transition"
              />
            </div>
            <button
              onClick={openAddStaff}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-lime-400 text-neutral-900 hover:bg-lime-300 transition font-bold"
            >
              <UserPlus className="w-3 h-3" /> Add Staff
            </button>
          </div>

          <div className="bg-white shadow-sm rounded-2xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : staff.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-neutral-400 text-xs gap-1">
                <p>No staff members yet.</p>
                <button onClick={openAddStaff} className="text-lime-700 font-semibold">Add one</button>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0"><table className="w-full text-xs">
                <thead className="border-b border-black/5 bg-neutral-50">
                  <tr>
                    {['Name', 'Role', 'Salary', 'Frequency', 'Status', ''].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-neutral-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {staff.map((s) => (
                    <tr key={s.id} className="hover:bg-neutral-50 transition">
                      <td className="px-3 py-2.5">
                        <p className="text-xs font-medium text-neutral-900">{s.name}</p>
                        {s.email && <p className="text-[10px] text-neutral-400">{s.email}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-neutral-600">{s.role_title || '—'}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-neutral-900">
                        {s.salary_amount ? fmt(s.salary_amount) : '—'}
                      </td>
                      <td className="px-3 py-2.5 capitalize text-neutral-600">{s.salary_frequency}</td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => handleToggleStatus(s)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition ${
                            s.status === 'active' ? 'bg-lime-100 text-lime-700' : 'bg-neutral-100 text-neutral-500'
                          }`}
                        >
                          {s.status === 'active' ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEditStaff(s)} className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 transition" title="Edit">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleDeleteStaff(s.id)} className="p-1 rounded-lg hover:bg-rose-50 text-neutral-400 hover:text-rose-600 transition" title="Delete">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </>
      )}

      {/* ━━━━━━━━ ADD/EDIT STAFF MODAL ━━━━━━━━ */}
      {showStaffModal && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowStaffModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 animate-scaleIn">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-neutral-900">
                {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
              </h2>
              <button onClick={() => setShowStaffModal(false)} className="p-1 text-neutral-400 hover:text-neutral-900 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            {error && <div className="mb-3 px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-[10px]">{error}</div>}
            <form onSubmit={handleStaffSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 mb-1 block">Name *</label>
                <input type="text" required value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-lime-400 transition" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 mb-1 block">Role / Title</label>
                  <input type="text" value={staffForm.role_title} onChange={(e) => setStaffForm({ ...staffForm, role_title: e.target.value })} placeholder="e.g. Barista, Developer" className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-lime-400 transition" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 mb-1 block">Salary Amount</label>
                  <input type="number" step="0.01" value={staffForm.salary_amount} onChange={(e) => setStaffForm({ ...staffForm, salary_amount: e.target.value })} placeholder="0" className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-lime-400 transition" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 mb-1 block">Email</label>
                  <input type="email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-lime-400 transition" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 mb-1 block">Phone</label>
                  <input type="tel" value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-lime-400 transition" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 mb-1 block">Frequency</label>
                  <select value={staffForm.salary_frequency} onChange={(e) => setStaffForm({ ...staffForm, salary_frequency: e.target.value })} className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-lime-400 transition">
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 mb-1 block">Joined Date</label>
                  <input type="date" value={staffForm.joined_date} onChange={(e) => setStaffForm({ ...staffForm, joined_date: e.target.value })} className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-lime-400 transition" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowStaffModal(false)} className="px-3 py-1.5 text-xs text-neutral-500">Cancel</button>
                <button type="submit" disabled={submitting || !staffForm.name.trim()} className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold bg-lime-400 text-neutral-900 hover:bg-lime-300 rounded-xl transition disabled:opacity-50">
                  {submitting ? <div className="w-3 h-3 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" /> : <Check className="w-3 h-3" />}
                  {editingStaff ? 'Update' : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* ━━━━━━━━ ADJUST ENTRY MODAL ━━━━━━━━ */}
      {showAdjustModal && adjustingEntry && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowAdjustModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 animate-scaleIn">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-neutral-900">Adjust — {adjustingEntry.staff_name}</h2>
              <button onClick={() => setShowAdjustModal(false)} className="p-1 text-neutral-400 hover:text-neutral-900 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            {error && <div className="mb-3 px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-[10px]">{error}</div>}
            <form onSubmit={handleAdjustSubmit} className="space-y-3">
              <div className="px-3 py-2 rounded-xl bg-neutral-50 text-[10px] text-neutral-500">
                Base salary: <span className="font-bold font-mono">{fmt(adjustingEntry.base_salary)}</span>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 mb-1 block">Allowances (+)</label>
                <input type="number" step="0.01" value={adjustForm.allowances} onChange={(e) => setAdjustForm({ ...adjustForm, allowances: e.target.value })} placeholder="0" className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-lime-400 transition" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 mb-1 block">Deductions (−)</label>
                <input type="number" step="0.01" value={adjustForm.deductions} onChange={(e) => setAdjustForm({ ...adjustForm, deductions: e.target.value })} placeholder="0" className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-lime-400 transition" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 mb-1 block">Notes</label>
                <textarea value={adjustForm.notes} onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-lime-400 transition resize-none" />
              </div>
              <div className="px-3 py-2 rounded-xl bg-lime-50 text-xs text-lime-700 font-bold font-mono">
                Net: {fmt(
                  adjustingEntry.base_salary +
                  (parseFloat(adjustForm.allowances) || 0) -
                  (parseFloat(adjustForm.deductions) || 0)
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAdjustModal(false)} className="px-3 py-1.5 text-xs text-neutral-500">Cancel</button>
                <button type="submit" disabled={submitting} className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold bg-lime-400 text-neutral-900 hover:bg-lime-300 rounded-xl transition disabled:opacity-50">
                  {submitting ? <div className="w-3 h-3 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" /> : <Check className="w-3 h-3" />}
                  Save Adjustments
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
