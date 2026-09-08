'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, X, Landmark, TrendingDown, TrendingUp, DollarSign,
  ChevronDown, ChevronUp, Check, Calculator, AlertCircle,
  Trash2, Edit2, CreditCard, Percent, CalendarDays,
} from 'lucide-react'
import { useBusiness } from '@/lib/contexts/BusinessContext'
import { useCurrency } from '@/lib/contexts/CurrencyContext'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface Loan {
  id: number
  lender_name: string
  loan_type: string
  principal_amount: number
  interest_rate: number
  tenure_months: number
  emi_amount: number
  start_date: string
  end_date: string | null
  outstanding_balance: number
  total_interest_paid: number
  total_principal_paid: number
  status: string
  next_emi_date: string | null
  notes: string | null
  business_name: string | null
}

interface EmiPayment {
  id: number
  loan_id: number
  payment_date: string
  emi_number: number
  principal_component: number
  interest_component: number
  total_amount: number
  status: string
  notes: string | null
}

const loanTypeLabels: Record<string, string> = {
  personal: 'Personal', home: 'Home', vehicle: 'Vehicle',
  business: 'Business', education: 'Education', other: 'Other',
}

const statusCfg: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-lime-100 text-lime-700' },
  closed: { label: 'Closed', cls: 'bg-blue-100 text-blue-700' },
  defaulted: { label: 'Defaulted', cls: 'bg-rose-100 text-rose-700' },
}

const emiStatusCfg: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Paid', cls: 'bg-lime-100 text-lime-700' },
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  overdue: { label: 'Overdue', cls: 'bg-rose-100 text-rose-700' },
  skipped: { label: 'Skipped', cls: 'bg-neutral-100 text-neutral-500' },
}

export default function LoansPage() {
  const { activeBusiness } = useBusiness()
  const { currentCurrency, currencies } = useCurrency()
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showCalc, setShowCalc] = useState(false)
  const [expandedLoan, setExpandedLoan] = useState<number | null>(null)
  const [payments, setPayments] = useState<Record<number, EmiPayment[]>>({})
  const [isMounted, setIsMounted] = useState(false)

  const [form, setForm] = useState({
    lender_name: '', loan_type: 'personal', principal_amount: '',
    interest_rate: '', tenure_months: '', start_date: new Date().toISOString().split('T')[0],
    disbursement_date: '', notes: '',
  })
  const [calcForm, setCalcForm] = useState({ principal: '', rate: '', tenure: '' })
  const [calcResult, setCalcResult] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  const fmt = useCallback((n: number) => {
    const sym = currencies.find(c => c.code === currentCurrency)?.symbol ?? ''
    return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }, [currencies, currentCurrency])

  const fetchLoans = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const params = new URLSearchParams()
      if (activeBusiness) params.set('businessId', activeBusiness.id.toString())
      const res = await fetch(`/api/loans?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      setLoans(data.loans || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [activeBusiness])

  useEffect(() => { fetchLoans() }, [fetchLoans])

  const fetchPayments = async (loanId: number) => {
    if (payments[loanId]) return
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const res = await fetch(`/api/loans/${loanId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      setPayments(prev => ({ ...prev, [loanId]: data.payments || [] }))
    } catch (e) { console.error(e) }
  }

  const toggleExpand = (id: number) => {
    if (expandedLoan === id) {
      setExpandedLoan(null)
    } else {
      setExpandedLoan(id)
      fetchPayments(id)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      await fetch('/api/loans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          business_id: activeBusiness?.id,
          lender_name: form.lender_name,
          loan_type: form.loan_type,
          principal_amount: parseFloat(form.principal_amount) || 0,
          interest_rate: parseFloat(form.interest_rate) || 0,
          tenure_months: parseInt(form.tenure_months) || 0,
          start_date: form.start_date,
          disbursement_date: form.disbursement_date || null,
          notes: form.notes || null,
        }),
      })
      setShowModal(false)
      setForm({
        lender_name: '', loan_type: 'personal', principal_amount: '',
        interest_rate: '', tenure_months: '', start_date: new Date().toISOString().split('T')[0],
        disbursement_date: '', notes: '',
      })
      fetchLoans()
    } catch (e) { console.error(e) }
    finally { setSubmitting(false) }
  }

  const handlePayEmi = async (loanId: number, emiPaymentId: number) => {
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      await fetch(`/api/loans/${loanId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          emi_payment_id: emiPaymentId,
          create_transaction: true,
          payment_date: new Date().toISOString().split('T')[0],
        }),
      })
      setPayments(prev => {
        const copy = { ...prev }
        delete copy[loanId]
        return copy
      })
      fetchPayments(loanId)
      fetchLoans()
    } catch (e) { console.error(e) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this loan and all its payment records?')) return
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    await fetch(`/api/loans/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    fetchLoans()
  }

  const handleCalc = () => {
    const p = parseFloat(calcForm.principal) || 0
    const r = parseFloat(calcForm.rate) || 0
    const t = parseInt(calcForm.tenure) || 0
    if (p <= 0 || t <= 0) { setCalcResult(null); return }
    if (r === 0) { setCalcResult(Math.round((p / t) * 100) / 100); return }
    const monthlyRate = r / 12 / 100
    const factor = Math.pow(1 + monthlyRate, t)
    setCalcResult(Math.round(((p * monthlyRate * factor) / (factor - 1)) * 100) / 100)
  }

  const totalOutstanding = loans.filter(l => l.status === 'active').reduce((s, l) => s + (l.outstanding_balance || 0), 0)
  const totalEmiMonthly = loans.filter(l => l.status === 'active').reduce((s, l) => s + l.emi_amount, 0)
  const activeCount = loans.filter(l => l.status === 'active').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-bold text-neutral-900">Loans & EMI</h1>
          <p className="text-[10px] text-neutral-400">Track loan balances, EMI schedules, and interest paid</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCalc(true)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition font-bold">
            <Calculator className="w-3 h-3" /> EMI Calc
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-lime-400 text-neutral-900 hover:bg-lime-300 transition font-bold">
            <Plus className="w-3 h-3" /> Add Loan
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Outstanding', value: totalOutstanding, icon: TrendingDown, cls: 'text-rose-700 bg-rose-50' },
          { label: 'Monthly EMI', value: totalEmiMonthly, icon: CreditCard, cls: 'text-amber-700 bg-amber-50' },
          { label: 'Active Loans', value: activeCount, icon: Landmark, cls: 'text-blue-700 bg-blue-50', raw: true },
        ].map(({ label, value, icon: Icon, cls, raw }) => (
          <div key={label} className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${cls}`}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-neutral-400">{label}</p>
              <p className="text-sm font-bold font-mono">{raw ? value : fmt(value as number)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Loans List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : loans.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-sm p-8 text-center">
            <Landmark className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="text-xs text-neutral-400">No loans added yet.</p>
            <button onClick={() => setShowModal(true)} className="mt-2 text-xs text-lime-700 font-semibold">Add your first loan</button>
          </div>
        ) : loans.map(loan => {
          const paidPercent = loan.principal_amount > 0
            ? Math.min(100, Math.round(((loan.total_principal_paid || 0) / loan.principal_amount) * 100))
            : 0
          const cfg = statusCfg[loan.status] || statusCfg.active
          const isExpanded = expandedLoan === loan.id
          const loanPayments = payments[loan.id] || []

          // Chart data: aggregate principal vs interest per payment (show first 24 max)
          const chartData = loanPayments.slice(0, 24).map(p => ({
            name: `#${p.emi_number}`,
            Principal: Math.round(p.principal_component || 0),
            Interest: Math.round(p.interest_component || 0),
          }))

          return (
            <div key={loan.id} className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-neutral-50 transition" onClick={() => toggleExpand(loan.id)}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0">
                    <Landmark className="w-4 h-4 text-neutral-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-neutral-900 truncate">{loan.lender_name}</p>
                    <p className="text-[10px] text-neutral-400">{loanTypeLabels[loan.loan_type] || loan.loan_type} &middot; {loan.interest_rate}% &middot; {loan.tenure_months} mo</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-bold font-mono text-neutral-900">{fmt(loan.outstanding_balance || 0)}</p>
                    <p className="text-[10px] text-neutral-400">EMI {fmt(loan.emi_amount)}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.cls}`}>{cfg.label}</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-neutral-400" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="px-4 pb-2">
                <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
                  <span>{paidPercent}% principal repaid</span>
                  <span>{fmt(loan.total_principal_paid || 0)} / {fmt(loan.principal_amount)}</span>
                </div>
                <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-lime-500 rounded-full transition-all" style={{ width: `${paidPercent}%` }} />
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-neutral-100 px-4 py-3 space-y-4">
                  {/* Stats row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-neutral-50 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-neutral-400">Principal</p>
                      <p className="font-bold font-mono">{fmt(loan.principal_amount)}</p>
                    </div>
                    <div className="bg-neutral-50 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-neutral-400">Interest Paid</p>
                      <p className="font-bold font-mono text-rose-600">{fmt(loan.total_interest_paid || 0)}</p>
                    </div>
                    <div className="bg-neutral-50 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-neutral-400">Next EMI</p>
                      <p className="font-bold">{loan.next_emi_date || '—'}</p>
                    </div>
                    <div className="bg-neutral-50 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-neutral-400">End Date</p>
                      <p className="font-bold">{loan.end_date || '—'}</p>
                    </div>
                  </div>

                  {/* Amortization Chart */}
                  {chartData.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Amortization Breakdown</p>
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 9 }} />
                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Bar dataKey="Principal" fill="#84cc16" radius={[2, 2, 0, 0]} />
                            <Bar dataKey="Interest" fill="#f43f5e" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Payment History Table */}
                  <div>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">EMI Schedule</p>
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-neutral-100">
                      <div className="overflow-x-auto -mx-3 sm:mx-0"><table className="w-full text-xs">
                        <thead className="bg-neutral-50 sticky top-0">
                          <tr>
                            {['#', 'Date', 'Principal', 'Interest', 'EMI', 'Status', ''].map(h => (
                              <th key={h} className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-400">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                          {loanPayments.map(p => {
                            const ecfg = emiStatusCfg[p.status] || emiStatusCfg.pending
                            return (
                              <tr key={p.id} className="hover:bg-neutral-50 transition">
                                <td className="px-2 py-1.5 font-mono">{p.emi_number}</td>
                                <td className="px-2 py-1.5">{p.payment_date}</td>
                                <td className="px-2 py-1.5 font-mono">{fmt(p.principal_component || 0)}</td>
                                <td className="px-2 py-1.5 font-mono text-rose-500">{fmt(p.interest_component || 0)}</td>
                                <td className="px-2 py-1.5 font-mono font-bold">{fmt(p.total_amount)}</td>
                                <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${ecfg.cls}`}>{ecfg.label}</span></td>
                                <td className="px-2 py-1.5">
                                  {(p.status === 'pending' || p.status === 'overdue') && (
                                    <button onClick={(e) => { e.stopPropagation(); handlePayEmi(loan.id, p.id) }} className="text-[10px] px-2 py-0.5 rounded-lg bg-lime-400 text-neutral-900 font-bold hover:bg-lime-300 transition">
                                      Pay
                                    </button>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table></div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleDelete(loan.id)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-rose-500 hover:bg-rose-50 transition font-medium">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add Loan Modal */}
      {showModal && isMounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-neutral-900">Add Loan</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-neutral-400 hover:text-neutral-900"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-medium text-neutral-500">Lender Name *</label>
                <input value={form.lender_name} onChange={e => setForm(f => ({ ...f, lender_name: e.target.value }))} required className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" placeholder="e.g. HDFC Bank" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-neutral-500">Loan Type</label>
                <select value={form.loan_type} onChange={e => setForm(f => ({ ...f, loan_type: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none">
                  {Object.entries(loanTypeLabels).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">Principal Amount *</label>
                  <input type="number" step="0.01" value={form.principal_amount} onChange={e => setForm(f => ({ ...f, principal_amount: e.target.value }))} required className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" placeholder="500000" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">Interest Rate (%) *</label>
                  <input type="number" step="0.01" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} required className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" placeholder="10.5" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">Tenure (Months) *</label>
                  <input type="number" value={form.tenure_months} onChange={e => setForm(f => ({ ...f, tenure_months: e.target.value }))} required className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" placeholder="36" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">Start Date *</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-neutral-500">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none resize-none" rows={2} placeholder="Optional notes..." />
              </div>
              <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-xl bg-lime-400 text-neutral-900 text-xs font-bold hover:bg-lime-300 transition disabled:opacity-50">
                {submitting ? 'Creating...' : 'Add Loan'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* EMI Calculator Modal */}
      {showCalc && isMounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCalc(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-neutral-900">EMI Calculator</h2>
              <button onClick={() => setShowCalc(false)} className="p-1 text-neutral-400 hover:text-neutral-900"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-medium text-neutral-500">Loan Amount</label>
                <input type="number" value={calcForm.principal} onChange={e => setCalcForm(f => ({ ...f, principal: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" placeholder="500000" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-neutral-500">Annual Interest Rate (%)</label>
                <input type="number" step="0.01" value={calcForm.rate} onChange={e => setCalcForm(f => ({ ...f, rate: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" placeholder="10.5" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-neutral-500">Tenure (Months)</label>
                <input type="number" value={calcForm.tenure} onChange={e => setCalcForm(f => ({ ...f, tenure: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" placeholder="36" />
              </div>
              <button onClick={handleCalc} className="w-full py-2.5 rounded-xl bg-lime-400 text-neutral-900 text-xs font-bold hover:bg-lime-300 transition">
                Calculate EMI
              </button>
              {calcResult !== null && (
                <div className="bg-lime-50 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-neutral-400">Monthly EMI</p>
                  <p className="text-lg font-bold font-mono text-lime-700">{fmt(calcResult)}</p>
                  <p className="text-[10px] text-neutral-400 mt-1">
                    Total: {fmt(calcResult * (parseInt(calcForm.tenure) || 0))} &middot;
                    Interest: {fmt((calcResult * (parseInt(calcForm.tenure) || 0)) - (parseFloat(calcForm.principal) || 0))}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
