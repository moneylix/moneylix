'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  Receipt, TrendingUp, TrendingDown, IndianRupee, Settings2, Plus,
  X, FileText, Calendar, AlertTriangle, Check, Download,
  ChevronDown, Pencil, Trash2, ArrowRight,
} from 'lucide-react'
import { useBusiness } from '@/lib/contexts/BusinessContext'
import { useCurrency } from '@/lib/contexts/CurrencyContext'
import { usePlan } from '@/lib/contexts/PlanContext'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'

interface GSTSummary {
  financialYear: string
  quarter: string
  taxRate: number
  gstRegistered: number
  summary: {
    totalIncome: number
    totalExpense: number
    gstCollected: number
    gstPaid: number
    netPayable: number
    netStatus: 'payable' | 'receivable'
  }
  monthly: { month: string; income: number; expense: number; gst_collected: number; gst_paid: number }[]
  taxEntries: TaxEntry[]
}

interface TaxEstimates {
  financialYear: string
  currentQuarter: string
  incomeToDate: number
  expenseToDate: number
  netProfitToDate: number
  projectedAnnualIncome: number
  projectedAnnualExpense: number
  projectedAnnualProfit: number
  estimatedAnnualTax: number
  tdsDeducted: number
  advanceTaxPaid: number
  remainingLiability: number
  effectiveRate: number
  advanceTaxSchedule: { quarter: string; cumulative_pct: number; due_by: string; amount: number }[]
}

interface TaxEntry {
  id: number
  financial_year: string
  quarter: string | null
  month: string | null
  type: string
  amount: number
  description: string | null
  status: string
  due_date: string | null
  paid_date: string | null
  reference_number: string | null
}

interface GSTSettings {
  gstin: string | null
  gst_registered: number
  state_code: string | null
  default_tax_rate: number
  hsn_sac_code: string | null
}

const TAX_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  gst_payable: { label: 'GST Payable', color: 'bg-blue-100 text-blue-700' },
  tds_deducted: { label: 'TDS Deducted', color: 'bg-purple-100 text-purple-700' },
  advance_tax: { label: 'Advance Tax', color: 'bg-amber-100 text-amber-700' },
  tds_receivable: { label: 'TDS Receivable', color: 'bg-lime-100 text-lime-700' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Paid', color: 'bg-lime-100 text-lime-700' },
  filed: { label: 'Filed', color: 'bg-blue-100 text-blue-700' },
}

function getFinancialYearOptions(): string[] {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const startYear = currentMonth >= 3 ? currentYear : currentYear - 1
  const years: string[] = []
  for (let y = startYear; y >= startYear - 5; y--) {
    years.push(`${y}-${String(y + 1).slice(2)}`)
  }
  return years
}

export default function TaxDashboardPage() {
  const { activeBusiness } = useBusiness()
  const { currentCurrency, currencies } = useCurrency()
  const { can } = usePlan()

  const [fy, setFy] = useState(() => {
    const now = new Date()
    const m = now.getMonth()
    const y = now.getFullYear()
    const startYear = m >= 3 ? y : y - 1
    return `${startYear}-${String(startYear + 1).slice(2)}`
  })
  const [quarter, setQuarter] = useState<string>('')
  const [gstSummary, setGstSummary] = useState<GSTSummary | null>(null)
  const [estimates, setEstimates] = useState<TaxEstimates | null>(null)
  const [gstSettings, setGstSettings] = useState<GSTSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TaxEntry | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  const [settingsForm, setSettingsForm] = useState({ gstin: '', gst_registered: false, state_code: '', default_tax_rate: '18', hsn_sac_code: '' })
  const [entryForm, setEntryForm] = useState({ type: 'gst_payable', amount: '', description: '', quarter: '', due_date: '', reference_number: '', status: 'pending' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  const fyOptions = getFinancialYearOptions()

  const fmt = useCallback(
    (n: number) => {
      const sym = currencies.find((c) => c.code === currentCurrency)?.symbol ?? '₹'
      return `${sym}${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    },
    [currencies, currentCurrency],
  )

  const fetchAll = useCallback(async () => {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const bId = activeBusiness.id

      const params = new URLSearchParams({ businessId: String(bId), financialYear: fy })
      if (quarter) params.set('quarter', quarter)

      const [gstRes, estRes, settRes] = await Promise.all([
        fetch(`/api/gst/summary?${params}`, { headers }),
        fetch(`/api/tax/estimates?businessId=${bId}`, { headers }),
        fetch(`/api/gst/settings?businessId=${bId}`, { headers }),
      ])

      const [gstData, estData, settData] = await Promise.all([gstRes.json(), estRes.json(), settRes.json()])

      setGstSummary(gstData)
      setEstimates(estData)
      setGstSettings(settData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [activeBusiness, fy, quarter])

  useEffect(() => { fetchAll() }, [fetchAll])

  const saveSettings = async () => {
    if (!activeBusiness) return
    setSaving(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      await fetch('/api/gst/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          businessId: activeBusiness.id,
          gstin: settingsForm.gstin || null,
          gst_registered: settingsForm.gst_registered,
          state_code: settingsForm.state_code || null,
          default_tax_rate: parseFloat(settingsForm.default_tax_rate) || 18,
          hsn_sac_code: settingsForm.hsn_sac_code || null,
        }),
      })
      setSettingsOpen(false)
      fetchAll()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const openSettingsModal = () => {
    setSettingsForm({
      gstin: gstSettings?.gstin ?? '',
      gst_registered: (gstSettings?.gst_registered ?? 0) === 1,
      state_code: gstSettings?.state_code ?? '',
      default_tax_rate: String(gstSettings?.default_tax_rate ?? 18),
      hsn_sac_code: gstSettings?.hsn_sac_code ?? '',
    })
    setSettingsOpen(true)
  }

  const openEntryModal = (entry?: TaxEntry) => {
    if (entry) {
      setEditingEntry(entry)
      setEntryForm({
        type: entry.type,
        amount: String(entry.amount),
        description: entry.description ?? '',
        quarter: entry.quarter ?? '',
        due_date: entry.due_date ?? '',
        reference_number: entry.reference_number ?? '',
        status: entry.status,
      })
    } else {
      setEditingEntry(null)
      setEntryForm({ type: 'gst_payable', amount: '', description: '', quarter: '', due_date: '', reference_number: '', status: 'pending' })
    }
    setEntryModalOpen(true)
  }

  const saveEntry = async () => {
    if (!activeBusiness) return
    setSaving(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

      if (editingEntry) {
        await fetch('/api/tax/entries', {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            id: editingEntry.id,
            amount: entryForm.amount,
            description: entryForm.description || null,
            status: entryForm.status,
            due_date: entryForm.due_date || null,
            reference_number: entryForm.reference_number || null,
          }),
        })
      } else {
        await fetch('/api/tax/entries', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            businessId: activeBusiness.id,
            financial_year: fy,
            quarter: entryForm.quarter || null,
            type: entryForm.type,
            amount: entryForm.amount,
            description: entryForm.description || null,
            due_date: entryForm.due_date || null,
            reference_number: entryForm.reference_number || null,
            status: entryForm.status,
          }),
        })
      }
      setEntryModalOpen(false)
      setEditingEntry(null)
      fetchAll()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const deleteEntry = async (id: number) => {
    if (!confirm('Delete this tax entry?')) return
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      await fetch(`/api/tax/entries?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchAll()
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const sum = gstSummary?.summary
  const monthly = gstSummary?.monthly ?? []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold text-neutral-900">Tax & GST Dashboard</h1>
          <p className="text-[10px] text-neutral-400">
            {gstSettings?.gstin ? `GSTIN: ${gstSettings.gstin}` : 'GST not configured'} · FY {fy}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={fy}
            onChange={(e) => setFy(e.target.value)}
            className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white text-neutral-700"
          >
            {fyOptions.map((y) => (
              <option key={y} value={y}>FY {y}</option>
            ))}
          </select>
          <select
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white text-neutral-700"
          >
            <option value="">Full Year</option>
            <option value="Q1">Q1 (Apr–Jun)</option>
            <option value="Q2">Q2 (Jul–Sep)</option>
            <option value="Q3">Q3 (Oct–Dec)</option>
            <option value="Q4">Q4 (Jan–Mar)</option>
          </select>
          <button onClick={openSettingsModal} className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-500 transition">
            <Settings2 className="w-4 h-4" />
          </button>
          <Link href="/dashboard/tax/exports" className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition font-medium">
            <Download className="w-3 h-3" /> Exports
          </Link>
        </div>
      </div>

      {/* GST Summary Cards */}
      {sum && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard icon={TrendingUp} label="GST Collected" value={fmt(sum.gstCollected)} color="text-blue-600" bg="bg-blue-50" />
          <SummaryCard icon={TrendingDown} label="GST Paid (Input)" value={fmt(sum.gstPaid)} color="text-rose-600" bg="bg-rose-50" />
          <SummaryCard
            icon={IndianRupee}
            label={`Net ${sum.netStatus === 'payable' ? 'Payable' : 'Receivable'}`}
            value={fmt(Math.abs(sum.netPayable))}
            color={sum.netPayable >= 0 ? 'text-amber-600' : 'text-lime-600'}
            bg={sum.netPayable >= 0 ? 'bg-amber-50' : 'bg-lime-50'}
          />
          <SummaryCard icon={Receipt} label="Tax Rate" value={`${sum ? gstSummary?.taxRate : 18}%`} color="text-neutral-600" bg="bg-neutral-50" />
        </div>
      )}

      {/* Income Tax Estimates */}
      {estimates && (
        <div className="bg-white shadow-sm rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <h2 className="text-xs font-bold text-neutral-900">Income Tax Estimates — FY {estimates.financialYear}</h2>
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              Effective Rate: {estimates.effectiveRate}%
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Projected Profit" value={fmt(estimates.projectedAnnualProfit)} />
            <MiniStat label="Estimated Tax" value={fmt(estimates.estimatedAnnualTax)} />
            <MiniStat label="TDS + Advance Paid" value={fmt(estimates.tdsDeducted + estimates.advanceTaxPaid)} />
            <MiniStat label="Remaining Liability" value={fmt(estimates.remainingLiability)} highlight={estimates.remainingLiability > 0} />
          </div>

          {/* Advance Tax Schedule */}
          <div className="mt-3">
            <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Advance Tax Schedule</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              {estimates.advanceTaxSchedule.map((s) => {
                const isPast = new Date(s.due_by) < new Date()
                return (
                  <div key={s.quarter} className={`p-2.5 rounded-xl border ${isPast ? 'border-neutral-200 bg-neutral-50' : 'border-amber-200 bg-amber-50'}`}>
                    <p className="text-[10px] font-bold text-neutral-500">{s.quarter} — Due {new Date(s.due_by).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    <p className="text-xs font-bold text-neutral-900 font-mono">{fmt(s.amount)}</p>
                    <p className="text-[10px] text-neutral-400">{s.cumulative_pct}% cumulative</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Monthly GST Chart */}
      {monthly.length > 0 && (
        <div className="bg-white shadow-sm rounded-2xl p-4">
          <h2 className="text-xs font-bold text-neutral-900 mb-3">Monthly GST Breakdown</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#a3a3a3' }} />
              <YAxis tick={{ fontSize: 10, fill: '#a3a3a3' }} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e5e5e5' }}
                formatter={(val: number) => fmt(val)}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="gst_collected" name="GST Collected" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gst_paid" name="GST Paid" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tax Entries */}
      <div className="bg-white shadow-sm rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
          <h2 className="text-xs font-bold text-neutral-900">Tax Entries & Payments</h2>
          <button onClick={() => openEntryModal()} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-lime-400 text-neutral-900 hover:bg-lime-300 transition font-bold">
            <Plus className="w-3 h-3" /> Add Entry
          </button>
        </div>

        {(gstSummary?.taxEntries ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-neutral-400 text-xs gap-1 p-4">
            <Receipt className="w-6 h-6 text-neutral-300" />
            <p>No tax entries yet. <button onClick={() => openEntryModal()} className="text-lime-700 font-semibold">Add one</button></p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {(gstSummary?.taxEntries ?? []).map((entry) => {
              const typeInfo = TAX_TYPE_LABELS[entry.type] ?? { label: entry.type, color: 'bg-neutral-100 text-neutral-600' }
              const statusInfo = STATUS_LABELS[entry.status] ?? STATUS_LABELS.pending
              return (
                <div key={entry.id} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${typeInfo.color}`}>{typeInfo.label}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusInfo.color}`}>{statusInfo.label}</span>
                    </div>
                    <p className="text-xs text-neutral-700 truncate">{entry.description || 'No description'}</p>
                    <p className="text-[10px] text-neutral-400">
                      {entry.quarter && `${entry.quarter} · `}
                      {entry.due_date && `Due ${new Date(entry.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      {entry.reference_number && ` · Ref: ${entry.reference_number}`}
                    </p>
                  </div>
                  <p className="text-xs font-bold font-mono text-neutral-900">{fmt(entry.amount)}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEntryModal(entry)} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 transition">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => deleteEntry(entry.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-neutral-400 hover:text-rose-500 transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* GST Settings Modal */}
      {settingsOpen && isMounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSettingsOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 animate-scaleIn">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-neutral-900">GST Settings</h2>
              <button onClick={() => setSettingsOpen(false)}><X className="w-4 h-4 text-neutral-400" /></button>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.gst_registered}
                  onChange={(e) => setSettingsForm({ ...settingsForm, gst_registered: e.target.checked })}
                  className="w-4 h-4 rounded border-neutral-300 text-lime-500 focus:ring-lime-500"
                />
                <span className="text-xs text-neutral-700 font-medium">GST Registered</span>
              </label>

              <div>
                <label className="text-[10px] font-medium text-neutral-500 uppercase">GSTIN</label>
                <input
                  value={settingsForm.gstin}
                  onChange={(e) => setSettingsForm({ ...settingsForm, gstin: e.target.value.toUpperCase() })}
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                  className="w-full mt-1 px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-neutral-500 uppercase">State Code</label>
                <input
                  value={settingsForm.state_code}
                  onChange={(e) => setSettingsForm({ ...settingsForm, state_code: e.target.value })}
                  placeholder="33 (Tamil Nadu)"
                  maxLength={2}
                  className="w-full mt-1 px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-neutral-500 uppercase">Default Tax Rate (%)</label>
                <select
                  value={settingsForm.default_tax_rate}
                  onChange={(e) => setSettingsForm({ ...settingsForm, default_tax_rate: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400"
                >
                  <option value="0">Exempt (0%)</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-medium text-neutral-500 uppercase">Default HSN/SAC Code</label>
                <input
                  value={settingsForm.hsn_sac_code}
                  onChange={(e) => setSettingsForm({ ...settingsForm, hsn_sac_code: e.target.value })}
                  placeholder="998314"
                  className="w-full mt-1 px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400 font-mono"
                />
              </div>

              <button
                onClick={saveSettings}
                disabled={saving}
                className="w-full mt-2 py-2 bg-lime-400 hover:bg-lime-300 text-neutral-900 font-bold text-xs rounded-lg transition disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Tax Entry Modal */}
      {entryModalOpen && isMounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setEntryModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 animate-scaleIn">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-neutral-900">{editingEntry ? 'Edit Tax Entry' : 'Add Tax Entry'}</h2>
              <button onClick={() => setEntryModalOpen(false)}><X className="w-4 h-4 text-neutral-400" /></button>
            </div>
            <div className="space-y-3">
              {!editingEntry && (
                <div>
                  <label className="text-[10px] font-medium text-neutral-500 uppercase">Type</label>
                  <select
                    value={entryForm.type}
                    onChange={(e) => setEntryForm({ ...entryForm, type: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400"
                  >
                    <option value="gst_payable">GST Payable</option>
                    <option value="tds_deducted">TDS Deducted</option>
                    <option value="advance_tax">Advance Tax</option>
                    <option value="tds_receivable">TDS Receivable</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-medium text-neutral-500 uppercase">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={entryForm.amount}
                  onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
                  placeholder="10000"
                  className="w-full mt-1 px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-neutral-500 uppercase">Description</label>
                <input
                  value={entryForm.description}
                  onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
                  placeholder="GSTR-3B Q1 payment"
                  className="w-full mt-1 px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400"
                />
              </div>

              {!editingEntry && (
                <div>
                  <label className="text-[10px] font-medium text-neutral-500 uppercase">Quarter</label>
                  <select
                    value={entryForm.quarter}
                    onChange={(e) => setEntryForm({ ...entryForm, quarter: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400"
                  >
                    <option value="">—</option>
                    <option value="Q1">Q1 (Apr–Jun)</option>
                    <option value="Q2">Q2 (Jul–Sep)</option>
                    <option value="Q3">Q3 (Oct–Dec)</option>
                    <option value="Q4">Q4 (Jan–Mar)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-medium text-neutral-500 uppercase">Due Date</label>
                <input
                  type="date"
                  value={entryForm.due_date}
                  onChange={(e) => setEntryForm({ ...entryForm, due_date: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-neutral-500 uppercase">Reference / Challan No.</label>
                <input
                  value={entryForm.reference_number}
                  onChange={(e) => setEntryForm({ ...entryForm, reference_number: e.target.value })}
                  placeholder="Optional"
                  className="w-full mt-1 px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-neutral-500 uppercase">Status</label>
                <select
                  value={entryForm.status}
                  onChange={(e) => setEntryForm({ ...entryForm, status: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="filed">Filed</option>
                </select>
              </div>

              <button
                onClick={saveEntry}
                disabled={saving || !entryForm.amount}
                className="w-full mt-2 py-2 bg-lime-400 hover:bg-lime-300 text-neutral-900 font-bold text-xs rounded-lg transition disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingEntry ? 'Update Entry' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

/* ───── Helper components ───── */

function SummaryCard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: string; color: string; bg: string }) {
  return (
    <div className={`p-3 rounded-2xl ${bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <p className="text-[10px] font-medium text-neutral-500">{label}</p>
      </div>
      <p className={`text-sm font-bold font-mono ${color}`}>{value}</p>
    </div>
  )
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-2.5 rounded-xl border ${highlight ? 'border-rose-200 bg-rose-50' : 'border-neutral-100 bg-neutral-50'}`}>
      <p className="text-[10px] text-neutral-500 mb-0.5">{label}</p>
      <p className={`text-xs font-bold font-mono ${highlight ? 'text-rose-700' : 'text-neutral-900'}`}>{value}</p>
    </div>
  )
}
