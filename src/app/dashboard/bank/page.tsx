'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Building2, RefreshCw, Sparkles, Search, Filter,
  ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2,
  AlertCircle, Tag, ChevronDown, Download, Calendar,
  Loader2, XCircle
} from 'lucide-react'
import { BankSyncCard } from '@/app/components/BankSyncCard'
import { useTranslation } from '@/lib/i18n'

interface BankTransaction {
  id: number
  type: 'credit' | 'debit'
  amount: number
  currency: string
  date: string
  narration: string
  reference: string | null
  balance_after: number | null
  category_id: number | null
  ai_category_suggestion: string | null
  ai_confidence: number | null
  is_categorised: number
  is_duplicate: number
  ignored: number
  created_at: string
}

interface Category {
  id: number
  name: string
  type: string
}

type FilterType = 'all' | 'credit' | 'debit'
type CatFilter = 'all' | 'categorised' | 'uncategorised'

export default function BankTransactionsPage() {
  const { t } = useTranslation()
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [categorising, setCategorising] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<FilterType>('all')
  const [catFilter, setCatFilter] = useState<CatFilter>('all')
  const [toast, setToast] = useState<string | null>(null)

  const getToken = () => localStorage.getItem('moneylix_session_token') || ''
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/bank/transactions', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
      if (!res.ok) {
        if (res.status === 404) {
          // No bank connection — that's fine, show empty state
          setTransactions([])
          return
        }
        throw new Error('Failed to fetch')
      }
      const data = await res.json()
      setTransactions(data.transactions || [])
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
      const data = await res.json()
      setCategories(Array.isArray(data) ? data : data.categories || [])
    } catch {
      // Silent fail
    }
  }, [])

  useEffect(() => {
    fetchTransactions()
    fetchCategories()
  }, [fetchTransactions, fetchCategories])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/bank/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || t('bank.syncFailed'))
      } else {
        showToast(data.message || t('bank.syncComplete'))
        fetchTransactions()
      }
    } catch {
      showToast(t('bank.syncFailed'))
    } finally {
      setSyncing(false)
    }
  }

  const handleCategorise = async () => {
    setCategorising(true)
    try {
      const res = await fetch('/api/bank/categorise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || t('bank.categorisationFailed'))
      } else {
        showToast(data.message || t('bank.categorisationComplete'))
        fetchTransactions()
      }
    } catch {
      showToast(t('bank.categorisationFailed'))
    } finally {
      setCategorising(false)
    }
  }

  const handleExport = () => {
    const headers = ['Date', 'Type', 'Amount', 'Currency', 'Narration', 'Category', 'Reference']
    const rows = filteredTransactions.map(tx => [
      tx.date,
      tx.type,
      tx.amount.toString(),
      tx.currency,
      `"${(tx.narration || '').replace(/"/g, '""')}"`,
      tx.ai_category_suggestion || t('reconciliation.uncategorised'),
      tx.reference || '',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `bank_transactions_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
    showToast(t('bank.exportedToCsv'))
  }

  // Filter logic
  const filteredTransactions = transactions.filter(tx => {
    if (tx.ignored) return false
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false
    if (catFilter === 'categorised' && !tx.is_categorised) return false
    if (catFilter === 'uncategorised' && tx.is_categorised) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (tx.narration || '').toLowerCase().includes(q) ||
        (tx.ai_category_suggestion || '').toLowerCase().includes(q) ||
        tx.amount.toString().includes(q)
      )
    }
    return true
  })

  const totalCredit = filteredTransactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0)
  const totalDebit = filteredTransactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0)
  const uncategorisedCount = transactions.filter(t => !t.is_categorised && !t.ignored).length

  const getCategoryName = (tx: BankTransaction) => {
    if (tx.ai_category_suggestion) return tx.ai_category_suggestion
    if (tx.category_id) {
      const cat = categories.find(c => c.id === tx.category_id)
      return cat?.name || t('team.unknown')
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-lime-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-neutral-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-lime-700" />
            {t('bank.title')}
          </h1>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            {t('bank.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={filteredTransactions.length === 0}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 transition disabled:opacity-30"
          >
            <Download className="w-3.5 h-3.5" /> {t('common.export')}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-lime-100 text-lime-700 font-semibold hover:bg-lime-200 active:scale-95 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? t('bank.syncing') : t('bank.sync')}
          </button>
        </div>
      </div>

      {/* Connection status card */}
      <BankSyncCard />

      {/* Summary Cards */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white shadow-sm p-3">
            <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold">{t('bank.totalIn')}</p>
            <p className="text-lg font-black text-lime-700 mt-1">₹{totalCredit.toLocaleString('en-IN')}</p>
          </div>
          <div className="rounded-2xl bg-white shadow-sm p-3">
            <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold">{t('bank.totalOut')}</p>
            <p className="text-lg font-black text-rose-600 mt-1">₹{totalDebit.toLocaleString('en-IN')}</p>
          </div>
          <div className="rounded-2xl bg-white shadow-sm p-3">
            <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold">{t('nav.transactions')}</p>
            <p className="text-lg font-black text-neutral-900 mt-1">{filteredTransactions.length}</p>
          </div>
          <div className="rounded-2xl bg-white shadow-sm p-3">
            <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold">{t('reconciliation.uncategorised')}</p>
            <p className={`text-lg font-black mt-1 ${uncategorisedCount > 0 ? 'text-amber-600' : 'text-lime-700'}`}>
              {uncategorisedCount}
            </p>
            {uncategorisedCount > 0 && (
              <button
                onClick={handleCategorise}
                disabled={categorising}
                className="flex items-center gap-1 text-[9px] mt-1.5 text-violet-600 hover:text-violet-700 font-bold"
              >
                <Sparkles className={`w-3 h-3 ${categorising ? 'animate-pulse' : ''}`} />
                {categorising ? t('bank.working') : t('bank.autoCategorise')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      {transactions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder={t('bank.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-neutral-200 bg-neutral-50 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>

          {/* Type filter */}
          <div className="flex rounded-xl border border-neutral-200 overflow-hidden">
            {(['all', 'credit', 'debit'] as FilterType[]).map(f => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition ${
                  typeFilter === f
                    ? 'bg-lime-100 text-lime-700'
                    : 'text-neutral-400 hover:text-neutral-900'
                }`}
              >
                {f === 'all' ? t('common.all') : f === 'credit' ? t('transactions.credit') : t('transactions.debit')}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="flex rounded-xl border border-neutral-200 overflow-hidden">
            {([
              { key: 'all', label: t('common.all') },
              { key: 'categorised', label: t('bank.tagged') },
              { key: 'uncategorised', label: t('bank.untagged') },
            ] as { key: CatFilter; label: string }[]).map(f => (
              <button
                key={f.key}
                onClick={() => setCatFilter(f.key)}
                className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition ${
                  catFilter === f.key
                    ? 'bg-lime-100 text-lime-700'
                    : 'text-neutral-400 hover:text-neutral-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-sm font-bold text-neutral-900 mb-1">{t('bank.noTransactionsYet')}</h3>
          <p className="text-[11px] text-neutral-400 max-w-xs">
            {t('bank.noTransactionsDesc')}
          </p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="w-8 h-8 text-neutral-300 mb-3" />
          <p className="text-xs text-neutral-400">{t('bank.noMatchFilters')}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredTransactions.map(tx => {
            const categoryName = getCategoryName(tx)
            return (
              <div
                key={tx.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition hover:bg-neutral-50 ${
                  tx.is_duplicate ? 'border-amber-200 bg-amber-50' : 'border-transparent bg-white shadow-sm'
                }`}
              >
                {/* Icon */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  tx.type === 'credit' ? 'bg-emerald-500/15' : 'bg-rose-500/15'
                }`}>
                  {tx.type === 'credit'
                    ? <ArrowDownLeft className="w-4 h-4 text-lime-700" />
                    : <ArrowUpRight className="w-4 h-4 text-rose-600" />
                  }
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-neutral-900 truncate">
                    {tx.narration || t('bank.bankTransactionFallback')}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </span>
                    {categoryName && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        tx.is_categorised
                          ? 'bg-lime-100 text-lime-700'
                          : 'bg-violet-100 text-violet-700'
                      }`}>
                        {tx.is_categorised ? '' : '✨ '}{categoryName}
                      </span>
                    )}
                    {!categoryName && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
                        {t('reconciliation.uncategorised')}
                      </span>
                    )}
                    {tx.is_duplicate ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        {t('bank.duplicate')}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-black ${
                    tx.type === 'credit' ? 'text-lime-700' : 'text-rose-600'
                  }`}>
                    {tx.type === 'credit' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                  </p>
                  {tx.balance_after !== null && (
                    <p className="text-[9px] text-neutral-400">{t('bank.balPrefix')} ₹{tx.balance_after.toLocaleString('en-IN')}</p>
                  )}
                </div>
              </div>
            )
          })}
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
