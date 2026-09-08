'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Target, Plus, X, ChevronLeft, ChevronRight, AlertCircle,
  CheckCircle2, TrendingUp, Pencil, Trash2,
} from 'lucide-react'
import { useBusiness } from '@/lib/contexts/BusinessContext'
import { useCurrency } from '@/lib/contexts/CurrencyContext'

interface BudgetItem {
  id: number
  user_id: number
  business_id: number
  category_id: number | null
  month: string
  amount: number
  actual_spend: number
  remaining: number
  percent_used: number
  category_name: string | null
  category_icon: string | null
  category_color: string | null
}

interface SummaryData {
  overall: {
    total_budgeted: number
    overall_budget: number
    total_actual: number
    total_remaining: number
    percent_used: number
  }
  stats: {
    over_budget: number
    on_track: number
    no_budget: number
    total_categories_with_spend: number
  }
  categories: Array<{
    category_id: number
    category_name: string
    category_icon: string
    category_color: string
    budgeted: number
    actual: number
    remaining: number
    percent_used: number
    has_budget: boolean
  }>
}

interface CategoryOption {
  id: number
  name: string
  icon: string
  color: string
  type: string
}

function getMonthLabel(month: string): string {
  const [year, m] = month.split('-')
  const date = new Date(parseInt(year), parseInt(m) - 1, 1)
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function navigateMonth(month: string, direction: -1 | 1): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 1 + direction, 1)
  return date.toISOString().slice(0, 7)
}

function progressColor(pct: number): string {
  if (pct > 100) return 'bg-rose-500'
  if (pct > 80) return 'bg-amber-500'
  return 'bg-lime-500'
}

function statusBadge(pct: number): { label: string; cls: string } {
  if (pct > 100) return { label: 'Over Budget', cls: 'bg-rose-100 text-rose-700' }
  if (pct > 80) return { label: 'Near Limit', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'On Track', cls: 'bg-lime-100 text-lime-700' }
}

export default function BudgetsPage() {
  const { activeBusiness } = useBusiness()
  const { currentCurrency, currencies } = useCurrency()
  const [budgets, setBudgets] = useState<BudgetItem[]>([])
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)

  // Form state
  const [formCategoryId, setFormCategoryId] = useState<string>('')
  const [formAmount, setFormAmount] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const fmt = useCallback(
    (n: number) => {
      const sym = currencies.find(c => c.code === currentCurrency)?.symbol ?? '₹'
      return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    },
    [currencies, currentCurrency]
  )

  const fetchData = useCallback(async () => {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

      const [budgetRes, summaryRes, catRes] = await Promise.all([
        fetch(`/api/budgets?businessId=${activeBusiness.id}&month=${month}`, { headers }),
        fetch(`/api/budgets/summary?businessId=${activeBusiness.id}&month=${month}`, { headers }),
        fetch('/api/categories'),
      ])

      const budgetData = await budgetRes.json()
      const summaryData = await summaryRes.json()
      const catData = await catRes.json()

      setBudgets(budgetData.budgets || [])
      setSummary(summaryData)
      setCategories((catData || []).filter((c: CategoryOption) => c.type === 'debit' || c.type === 'both'))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [activeBusiness, month])

  useEffect(() => { fetchData() }, [fetchData])

  const openAddModal = () => {
    setEditingId(null)
    setFormCategoryId('')
    setFormAmount('')
    setShowModal(true)
  }

  const openEditModal = (budget: BudgetItem) => {
    setEditingId(budget.id)
    setFormCategoryId(budget.category_id?.toString() ?? '')
    setFormAmount(budget.amount.toString())
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeBusiness || !formAmount) return
    setFormSaving(true)

    const token = localStorage.getItem('moneylix_session_token') ?? ''
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    if (editingId) {
      await fetch(`/api/budgets/${editingId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ amount: parseFloat(formAmount) }),
      })
    } else {
      await fetch('/api/budgets', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          businessId: activeBusiness.id,
          categoryId: formCategoryId ? parseInt(formCategoryId, 10) : null,
          month,
          amount: parseFloat(formAmount),
        }),
      })
    }

    setShowModal(false)
    setFormSaving(false)
    fetchData()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this budget?')) return
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    await fetch(`/api/budgets/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    fetchData()
  }

  // Categories that don't already have a budget this month
  const availableCategories = categories.filter(
    cat => !budgets.some(b => b.category_id === cat.id)
  )

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-bold text-neutral-900">Budgets & Goals</h1>
          <p className="text-[10px] text-neutral-400">Track spending against monthly targets</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-lime-400 text-neutral-900 hover:bg-lime-300 transition font-bold"
        >
          <Plus className="w-3 h-3" /> Set Budget
        </button>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setMonth(navigateMonth(month, -1))}
          className="p-1.5 rounded-lg hover:bg-neutral-100 transition"
        >
          <ChevronLeft className="w-4 h-4 text-neutral-500" />
        </button>
        <span className="text-sm font-bold text-neutral-900 min-w-[160px] text-center">
          {getMonthLabel(month)}
        </span>
        <button
          onClick={() => setMonth(navigateMonth(month, 1))}
          className="p-1.5 rounded-lg hover:bg-neutral-100 transition"
        >
          <ChevronRight className="w-4 h-4 text-neutral-500" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-white rounded-2xl shadow-sm p-3">
                <p className="text-[10px] text-neutral-400">Total Budgeted</p>
                <p className="text-sm font-bold text-neutral-900 font-mono mt-0.5">
                  {fmt(summary.overall.overall_budget || summary.overall.total_budgeted)}
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-3">
                <p className="text-[10px] text-neutral-400">Actual Spent</p>
                <p className="text-sm font-bold text-neutral-900 font-mono mt-0.5">
                  {fmt(summary.overall.total_actual)}
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-3">
                <p className="text-[10px] text-neutral-400">Remaining</p>
                <p className={`text-sm font-bold font-mono mt-0.5 ${
                  summary.overall.total_remaining >= 0 ? 'text-lime-700' : 'text-rose-700'
                }`}>
                  {fmt(Math.abs(summary.overall.total_remaining))}
                  {summary.overall.total_remaining < 0 && ' over'}
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-3">
                <p className="text-[10px] text-neutral-400">Status</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {summary.stats.over_budget > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">
                      {summary.stats.over_budget} over
                    </span>
                  )}
                  {summary.stats.on_track > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-lime-100 text-lime-700 font-medium">
                      {summary.stats.on_track} on track
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Overall Progress Bar */}
          {summary && (summary.overall.overall_budget > 0 || summary.overall.total_budgeted > 0) && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-neutral-900">Overall Progress</p>
                <p className="text-xs text-neutral-500 font-mono">
                  {fmt(summary.overall.total_actual)} / {fmt(summary.overall.overall_budget || summary.overall.total_budgeted)}
                </p>
              </div>
              <div className="w-full h-3 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progressColor(summary.overall.percent_used)}`}
                  style={{ width: `${Math.min(summary.overall.percent_used, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-neutral-400 mt-1 text-right">
                {summary.overall.percent_used}% used
              </p>
            </div>
          )}

          {/* Budget Cards */}
          {budgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 text-neutral-400">
              <Target className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-xs font-semibold">No budgets set for {getMonthLabel(month)}</p>
              <button
                onClick={openAddModal}
                className="text-xs text-lime-700 font-bold mt-2 hover:text-lime-600"
              >
                Set your first budget →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {budgets.map(budget => {
                const badge = statusBadge(budget.percent_used)
                return (
                  <div key={budget.id} className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {budget.category_color && (
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: budget.category_color }}
                          />
                        )}
                        <p className="text-xs font-semibold text-neutral-900">
                          {budget.category_name || 'Overall Budget'}
                        </p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(budget)}
                          className="p-1 rounded-lg hover:bg-neutral-100 transition text-neutral-400 hover:text-neutral-700"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(budget.id)}
                          className="p-1 rounded-lg hover:bg-rose-50 transition text-neutral-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden mb-1.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${progressColor(budget.percent_used)}`}
                        style={{ width: `${Math.min(budget.percent_used, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-neutral-500 font-mono">
                        {fmt(budget.actual_spend)} / {fmt(budget.amount)}
                      </p>
                      <p className={`text-[10px] font-bold ${
                        budget.remaining >= 0 ? 'text-lime-700' : 'text-rose-700'
                      }`}>
                        {budget.remaining >= 0
                          ? `${fmt(budget.remaining)} left`
                          : `${fmt(Math.abs(budget.remaining))} over`
                        }
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Unbudgeted categories (from summary) */}
          {summary && summary.categories.filter(c => !c.has_budget && c.actual > 0).length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs font-semibold text-neutral-900 mb-2">Unbudgeted Spending</p>
              <div className="space-y-1.5">
                {summary.categories
                  .filter(c => !c.has_budget && c.actual > 0)
                  .map(cat => (
                    <div key={cat.category_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: cat.category_color }}
                        />
                        <span className="text-[11px] text-neutral-600">{cat.category_name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-neutral-500">{fmt(cat.actual)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Budget Modal */}
      {showModal && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 animate-scaleIn">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-neutral-900">
                {editingId ? 'Edit Budget' : 'Set Budget'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-neutral-100">
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingId && (
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                    Category
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={e => setFormCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
                  >
                    <option value="">Overall (all categories)</option>
                    {availableCategories.map(cat => (
                      <option key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                  Budget Amount
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                  placeholder="e.g. 10000"
                  required
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-900 font-mono focus:outline-none focus:ring-2 focus:ring-lime-400"
                />
              </div>

              <div className="text-[10px] text-neutral-400 bg-neutral-50 rounded-xl p-2">
                <strong>Month:</strong> {getMonthLabel(month)}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-500 hover:bg-neutral-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving || !formAmount}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-lime-400 text-neutral-900 hover:bg-lime-300 transition disabled:opacity-50"
                >
                  {formSaving ? 'Saving...' : editingId ? 'Update' : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
