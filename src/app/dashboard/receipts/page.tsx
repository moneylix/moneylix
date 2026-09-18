'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Upload, Camera, X, Image as ImageIcon, Check, Link2, Trash2,
  Search, Filter, AlertCircle, FileText, Eye, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useBusiness } from '@/lib/contexts/BusinessContext'
import { useCurrency } from '@/lib/contexts/CurrencyContext'
import { useTranslation } from '@/lib/i18n'

interface Receipt {
  id: number
  file_path: string
  ocr_text: string | null
  ocr_amount: number | null
  ocr_date: string | null
  ocr_vendor: string | null
  transaction_id: number | null
  tx_amount: number | null
  tx_date: string | null
  tx_note: string | null
  status: string
  created_at: string
}

interface SuggestedTx {
  id: number
  amount: number
  date: string
  note: string | null
  type: string
  category_name: string | null
}

function getStatusCfg(t: (key: string) => string): Record<string, { label: string; cls: string }> {
  return {
    processing: { label: t('receipts.processing'),      cls: 'bg-amber-100 text-amber-700' },
    matched:    { label: t('reconciliation.matched'),   cls: 'bg-lime-100 text-lime-700' },
    unmatched:  { label: t('reconciliation.unmatched'), cls: 'bg-rose-100 text-rose-700' },
  }
}

export default function ReceiptsPage() {
  const { t } = useTranslation()
  const statusCfg = getStatusCfg(t)
  const { activeBusiness } = useBusiness()
  const { currentCurrency, currencies } = useCurrency()

  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [isMounted, setIsMounted] = useState(false)
  const [showMatch, setShowMatch] = useState<{ receipt: Receipt; suggestions: SuggestedTx[] } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const limit = 20

  useEffect(() => { setIsMounted(true) }, [])

  const fmt = useCallback(
    (n: number) => {
      const sym = currencies.find((c) => c.code === currentCurrency)?.symbol ?? '₹'
      return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    },
    [currencies, currentCurrency]
  )

  const fetchReceipts = useCallback(async () => {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const params = new URLSearchParams()
      params.set('businessId', String(activeBusiness.id))
      params.set('limit', String(limit))
      params.set('offset', String(page * limit))
      if (filter !== 'all') params.set('status', filter)

      const res = await fetch(`/api/receipts?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      setReceipts(data.receipts || [])
      setTotal(data.total || 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [activeBusiness, filter, page])

  useEffect(() => { fetchReceipts() }, [fetchReceipts])

  const uploadFile = async (file: File) => {
    if (!file || !activeBusiness) return
    setUploading(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const formData = new FormData()
      formData.append('file', file)
      formData.append('businessId', String(activeBusiness.id))

      await fetch('/api/receipts', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      fetchReceipts()
    } catch (e) {
      console.error(e)
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) uploadFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = () => setDragActive(false)

  const deleteReceipt = async (id: number) => {
    if (!confirm(t('receipts.deleteReceiptConfirm'))) return
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    await fetch(`/api/receipts/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    fetchReceipts()
  }

  const openMatchModal = async (receipt: Receipt) => {
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    try {
      const res = await fetch(`/api/receipts/${receipt.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      setShowMatch({
        receipt: data.receipt || receipt,
        suggestions: data.suggestedTransactions || [],
      })
    } catch {
      setShowMatch({ receipt, suggestions: [] })
    }
  }

  const matchToTransaction = async (receiptId: number, txId: number) => {
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    await fetch(`/api/receipts/${receiptId}/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ transaction_id: txId }),
    })
    setShowMatch(null)
    fetchReceipts()
  }

  const totalPages = Math.ceil(total / limit)
  const unmatchedCount = receipts.filter((r) => r.status === 'unmatched').length
  const matchedCount = receipts.filter((r) => r.status === 'matched').length

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-bold text-neutral-900">{t('nav.receipts')}</h1>
          <p className="text-[10px] text-neutral-400">{t('receipts.subtitle')}</p>
        </div>
      </div>

      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragActive
            ? 'border-lime-400 bg-lime-50'
            : 'border-neutral-200 bg-white hover:border-neutral-300'
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-neutral-500">{t('receipts.processingReceipt')}</p>
          </div>
        ) : (
          <>
            <Upload className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
            <p className="text-xs text-neutral-500 mb-2">
              {t('receipts.dragDropPrefix')}{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-lime-700 font-bold hover:text-lime-900"
              >
                {t('receipts.browse')}
              </button>
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg bg-lime-400 text-neutral-900 hover:bg-lime-300 transition font-bold"
              >
                <ImageIcon className="w-3 h-3" /> {t('receipts.uploadImage')}
              </button>
              <button
                onClick={() => {
                  const input = fileInputRef.current
                  if (input) {
                    input.setAttribute('capture', 'environment')
                    input.click()
                    input.removeAttribute('capture')
                  }
                }}
                className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition font-medium"
              >
                <Camera className="w-3 h-3" /> {t('receipts.takePhoto')}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-[10px] text-neutral-400 mt-2">{t('receipts.supportsFormats')}</p>
          </>
        )}
      </div>

      {/* Summary & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-lime-50 text-lime-700">
          <Check className="w-3 h-3" />
          <span className="text-[10px] text-neutral-400">{t('reconciliation.matched')}:</span>
          <span className="text-xs font-bold">{matchedCount}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 text-rose-700">
          <AlertCircle className="w-3 h-3" />
          <span className="text-[10px] text-neutral-400">{t('reconciliation.unmatched')}:</span>
          <span className="text-xs font-bold">{unmatchedCount}</span>
        </div>
        <div className="flex gap-1 ml-auto">
          {['all', 'unmatched', 'matched', 'processing'].map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(0) }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium capitalize transition ${
                filter === f ? 'bg-lime-100 text-lime-700' : 'bg-white text-neutral-400 hover:text-neutral-900'
              }`}
            >
              {f === 'all' ? t('common.all') : f === 'unmatched' ? t('reconciliation.unmatched') : f === 'matched' ? t('reconciliation.matched') : t('receipts.processing')}
            </button>
          ))}
        </div>
      </div>

      {/* Receipts List */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-neutral-400 text-xs gap-1">
            <ImageIcon className="w-8 h-8 mb-1 opacity-30" />
            <p>{t('receipts.noReceiptsYet')}</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-black/5">
              {receipts.map((r) => {
                const cfg = statusCfg[r.status] || statusCfg.unmatched
                return (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition">
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <img
                        src={`/${r.file_path}`}
                        alt="Receipt"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                          ;(e.target as HTMLImageElement).parentElement!.innerHTML = '<svg class="w-4 h-4 text-neutral-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>'
                        }}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {r.ocr_vendor && (
                          <span className="text-xs font-bold text-neutral-900 truncate">{r.ocr_vendor}</span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-neutral-400 mt-0.5">
                        {r.ocr_amount != null && (
                          <span className="font-mono font-bold text-neutral-600">{fmt(r.ocr_amount)}</span>
                        )}
                        {r.ocr_date && (
                          <span>{new Date(r.ocr_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        )}
                        <span>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      </div>
                      {r.status === 'matched' && r.tx_note && (
                        <p className="text-[10px] text-lime-700 mt-0.5 truncate">
                          {t('receipts.linkedTo')} {r.tx_note} ({r.tx_amount != null ? fmt(r.tx_amount) : ''})
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {r.status === 'unmatched' && (
                        <button
                          onClick={() => openMatchModal(r)}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-lime-100 text-lime-700 hover:bg-lime-200 transition font-bold"
                        >
                          <Link2 className="w-3 h-3" /> {t('receipts.match')}
                        </button>
                      )}
                      {r.status === 'matched' && (
                        <button
                          onClick={() => openMatchModal(r)}
                          className="p-1 rounded-lg hover:bg-neutral-100 transition"
                          title={t('receipts.viewMatch')}
                        >
                          <Eye className="w-3.5 h-3.5 text-neutral-400" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteReceipt(r.id)}
                        className="p-1 rounded-lg hover:bg-rose-50 transition"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-300 hover:text-rose-600" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-black/5">
                <span className="text-[10px] text-neutral-400">
                  {page * limit + 1}–{Math.min((page + 1) * limit, total)} {t('receipts.of')} {total}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1 rounded-lg hover:bg-neutral-100 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-1 rounded-lg hover:bg-neutral-100 disabled:opacity-30"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Match Modal */}
      {isMounted && showMatch &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMatch(null)} />
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-neutral-900">{t('receipts.matchReceiptToTransaction')}</h2>
                <button onClick={() => setShowMatch(null)}>
                  <X className="w-5 h-5 text-neutral-400 hover:text-neutral-900" />
                </button>
              </div>

              {/* Receipt Info */}
              <div className="bg-neutral-50 rounded-xl p-3 mb-4">
                <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">{t('receipts.receiptLabel')}</p>
                <div className="flex items-center gap-2">
                  {showMatch.receipt.ocr_vendor && (
                    <span className="text-xs font-bold text-neutral-900">{showMatch.receipt.ocr_vendor}</span>
                  )}
                  {showMatch.receipt.ocr_amount != null && (
                    <span className="text-xs font-mono font-bold text-neutral-700">{fmt(showMatch.receipt.ocr_amount)}</span>
                  )}
                  {showMatch.receipt.ocr_date && (
                    <span className="text-[10px] text-neutral-400">{showMatch.receipt.ocr_date}</span>
                  )}
                </div>
              </div>

              {/* Suggestions */}
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">
                {t('receipts.suggestedTransactions')} ({showMatch.suggestions.length})
              </p>
              {showMatch.suggestions.length === 0 ? (
                <div className="text-center text-xs text-neutral-400 py-6">
                  <AlertCircle className="w-5 h-5 mx-auto mb-1 opacity-40" />
                  {t('reconciliation.noMatchingFound')}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {showMatch.suggestions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-neutral-100 hover:border-lime-300 hover:bg-lime-50/50 transition cursor-pointer"
                      onClick={() => matchToTransaction(showMatch.receipt.id, tx.id)}
                    >
                      <div>
                        <p className="text-xs font-bold text-neutral-900">
                          {tx.note || tx.category_name || t('calendar.transaction')}
                        </p>
                        <p className="text-[10px] text-neutral-400">
                          {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          {tx.category_name && ` · ${tx.category_name}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono font-bold text-neutral-900">{fmt(tx.amount)}</p>
                        <p className="text-[10px] text-lime-600 font-bold">{t('receipts.matchArrow')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
