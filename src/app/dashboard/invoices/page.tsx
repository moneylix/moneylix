'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  Plus, X, FileText, Send, CreditCard, Check, Trash2, Search,
  Filter, Eye, Copy, ExternalLink, ChevronLeft, ChevronRight, Download,
} from 'lucide-react'
import { useBusiness } from '@/lib/contexts/BusinessContext'
import { useCurrency } from '@/lib/contexts/CurrencyContext'
import { useTranslation } from '@/lib/i18n'

interface InvoiceItem {
  description: string
  quantity: number
  rate: number
  amount: number
}

interface Invoice {
  id: number
  invoice_number: string
  client_name: string
  client_email: string | null
  client_address: string | null
  items: InvoiceItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount_amount: number
  total: number
  currency: string
  status: string
  due_date: string | null
  paid_date: string | null
  share_token: string
  payment_link: string | null
  notes: string | null
  terms: string | null
  created_at: string
}

function getStatusCfg(t: (key: string) => string): Record<string, { label: string; cls: string }> {
  return {
    draft:     { label: t('invoices.draft'),     cls: 'bg-neutral-100 text-neutral-600' },
    sent:      { label: t('invoices.sent'),      cls: 'bg-blue-100 text-blue-700' },
    viewed:    { label: t('invoices.viewed'),    cls: 'bg-cyan-100 text-cyan-700' },
    paid:      { label: t('invoices.paid'),      cls: 'bg-lime-100 text-lime-700' },
    overdue:   { label: t('invoices.overdue'),   cls: 'bg-rose-100 text-rose-700' },
    cancelled: { label: t('invoices.cancelled'), cls: 'bg-neutral-100 text-neutral-400' },
  }
}

const emptyItem: InvoiceItem = { description: '', quantity: 1, rate: 0, amount: 0 }

export default function InvoicesPage() {
  const { activeBusiness } = useBusiness()
  const { currentCurrency, currencies } = useCurrency()
  const { t } = useTranslation()
  const statusCfg = getStatusCfg(t)

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const limit = 20

  // Form state
  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    client_address: '',
    items: [{ ...emptyItem }] as InvoiceItem[],
    tax_rate: 0,
    discount_amount: 0,
    due_date: '',
    notes: '',
    terms: '',
  })

  useEffect(() => { setIsMounted(true) }, [])

  const fmt = useCallback(
    (n: number) => {
      const sym = currencies.find((c) => c.code === currentCurrency)?.symbol ?? '₹'
      return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    },
    [currencies, currentCurrency]
  )

  const fetchInvoices = useCallback(async () => {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const params = new URLSearchParams()
      params.set('businessId', String(activeBusiness.id))
      params.set('limit', String(limit))
      params.set('offset', String(page * limit))
      if (filter !== 'all') params.set('status', filter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/invoices?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      setInvoices(data.invoices || [])
      setTotal(data.total || 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [activeBusiness, filter, search, page])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const resetForm = () =>
    setForm({
      client_name: '',
      client_email: '',
      client_address: '',
      items: [{ ...emptyItem }],
      tax_rate: 0,
      discount_amount: 0,
      due_date: '',
      notes: '',
      terms: '',
    })

  const updateItem = (idx: number, field: keyof InvoiceItem, value: string | number) => {
    setForm((prev) => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [field]: value }
      items[idx].amount = items[idx].quantity * items[idx].rate
      return { ...prev, items }
    })
  }

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, { ...emptyItem }] }))

  const removeItem = (idx: number) =>
    setForm((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== idx) : prev.items,
    }))

  const subtotal = form.items.reduce((s, it) => s + it.amount, 0)
  const taxAmount = subtotal * (form.tax_rate / 100)
  const grandTotal = subtotal + taxAmount - form.discount_amount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client_name || form.items.some((it) => !it.description || it.rate <= 0)) return
    setSubmitting(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          business_id: activeBusiness?.id,
          client_name: form.client_name,
          client_email: form.client_email || null,
          client_address: form.client_address || null,
          items: form.items,
          subtotal,
          tax_rate: form.tax_rate,
          tax_amount: taxAmount,
          discount_amount: form.discount_amount,
          total: grandTotal,
          currency: currentCurrency,
          due_date: form.due_date || null,
          notes: form.notes || null,
          terms: form.terms || null,
        }),
      })
      setShowModal(false)
      resetForm()
      fetchInvoices()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const sendInvoice = async (id: number) => {
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    await fetch(`/api/invoices/${id}/send`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    fetchInvoices()
  }

  const markPaid = async (id: number) => {
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    await fetch(`/api/invoices/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ status: 'paid' }),
    })
    fetchInvoices()
  }

  const deleteInvoice = async (id: number) => {
    if (!confirm('Delete this draft invoice?')) return
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    await fetch(`/api/invoices/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    fetchInvoices()
  }

  const copyShareLink = (token: string) => {
    const url = `${window.location.origin}/portal/${token}`
    navigator.clipboard.writeText(url)
  }

  const generatePaymentLink = async (id: number) => {
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    await fetch(`/api/invoices/${id}/payment-link`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    fetchInvoices()
  }

  const totalPages = Math.ceil(total / limit)

  const totalDraft = invoices.filter((i) => i.status === 'draft').length
  const totalSent = invoices.filter((i) => ['sent', 'viewed'].includes(i.status)).length
  const totalPaid = invoices.filter((i) => i.status === 'paid').length
  const totalPaidAmt = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const totalOutstanding = invoices
    .filter((i) => ['sent', 'viewed', 'overdue'].includes(i.status))
    .reduce((s, i) => s + i.total, 0)

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-bold text-neutral-900">{t('invoices.title')}</h1>
          <p className="text-[10px] text-neutral-400">{t('invoices.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/invoices/settings"
            className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition font-medium"
          >
            {t('common.settings')}
          </Link>
          <button
            onClick={() => { resetForm(); setShowModal(true) }}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-lime-400 text-neutral-900 hover:bg-lime-300 transition font-bold"
          >
            <Plus className="w-3 h-3" /> {t('invoices.createInvoice')}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-50 text-neutral-700">
          <FileText className="w-3 h-3" />
          <span className="text-[10px] text-neutral-400">{t('invoices.drafts')}:</span>
          <span className="text-xs font-bold font-mono">{totalDraft}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 text-blue-700">
          <Send className="w-3 h-3" />
          <span className="text-[10px] text-neutral-400">{t('invoices.sent')}:</span>
          <span className="text-xs font-bold font-mono">{totalSent}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-lime-50 text-lime-700">
          <Check className="w-3 h-3" />
          <span className="text-[10px] text-neutral-400">{t('invoices.paid')}:</span>
          <span className="text-xs font-bold font-mono">{fmt(totalPaidAmt)}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 text-amber-700">
          <CreditCard className="w-3 h-3" />
          <span className="text-[10px] text-neutral-400">{t('invoices.outstanding')}:</span>
          <span className="text-xs font-bold font-mono">{fmt(totalOutstanding)}</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder={t('invoices.searchPlaceholder')}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-lime-400/40"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(0) }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium capitalize transition ${
                filter === f ? 'bg-lime-100 text-lime-700' : 'bg-white text-neutral-400 hover:text-neutral-900'
              }`}
            >
              {f === 'all' ? t('common.all') : t(`invoices.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-neutral-400 text-xs gap-1">
            <FileText className="w-8 h-8 mb-1 opacity-30" />
            <p>
              {t('invoices.noInvoicesYet')}{' '}
              <button onClick={() => setShowModal(true)} className="text-lime-700 font-semibold">
                {t('invoices.createOne')}
              </button>
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-black/5 bg-neutral-50">
                  <tr>
                    {[t('invoices.invoiceNumber'), t('invoices.client'), t('common.date'), t('invoices.dueDate'), t('common.amount'), t('common.status'), t('common.actions')].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-neutral-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {invoices.map((inv) => {
                    const cfg = statusCfg[inv.status] || statusCfg.draft
                    return (
                      <tr key={inv.id} className="hover:bg-neutral-50 transition">
                        <td className="px-3 py-2">
                          <Link href={`/dashboard/invoices/${inv.id}`} className="font-bold text-neutral-900 hover:text-lime-700">
                            {inv.invoice_number}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-neutral-700">{inv.client_name}</td>
                        <td className="px-3 py-2 text-neutral-500">
                          {new Date(inv.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-3 py-2 text-neutral-500">
                          {inv.due_date
                            ? new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                            : '—'}
                        </td>
                        <td className="px-3 py-2 font-bold font-mono text-neutral-900">{fmt(inv.total)}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <Link href={`/dashboard/invoices/${inv.id}`} title="View">
                              <Eye className="w-3.5 h-3.5 text-neutral-400 hover:text-neutral-900 cursor-pointer" />
                            </Link>
                            <button onClick={() => {
                              const token = localStorage.getItem('moneylix_session_token') ?? ''
                              window.open(`/api/invoices/${inv.id}/pdf?token=${encodeURIComponent(token)}`, '_blank')
                            }} title="Download PDF">
                              <Download className="w-3.5 h-3.5 text-neutral-400 hover:text-violet-600 cursor-pointer" />
                            </button>
                            {inv.status === 'draft' && inv.client_email && (
                              <button onClick={() => sendInvoice(inv.id)} title="Send">
                                <Send className="w-3.5 h-3.5 text-blue-400 hover:text-blue-700" />
                              </button>
                            )}
                            {['sent', 'viewed', 'overdue'].includes(inv.status) && (
                              <button onClick={() => markPaid(inv.id)} title="Mark Paid">
                                <Check className="w-3.5 h-3.5 text-lime-500 hover:text-lime-700" />
                              </button>
                            )}
                            {['sent', 'viewed', 'overdue'].includes(inv.status) && !inv.payment_link && (
                              <button onClick={() => generatePaymentLink(inv.id)} title="Generate Payment Link">
                                <CreditCard className="w-3.5 h-3.5 text-amber-400 hover:text-amber-700" />
                              </button>
                            )}
                            {inv.payment_link && (
                              <a href={inv.payment_link} target="_blank" rel="noopener noreferrer" title="Payment Link">
                                <ExternalLink className="w-3.5 h-3.5 text-cyan-400 hover:text-cyan-700" />
                              </a>
                            )}
                            <button onClick={() => copyShareLink(inv.share_token)} title="Copy Portal Link">
                              <Copy className="w-3.5 h-3.5 text-neutral-400 hover:text-neutral-700" />
                            </button>
                            {inv.status === 'draft' && (
                              <button onClick={() => deleteInvoice(inv.id)} title="Delete">
                                <Trash2 className="w-3.5 h-3.5 text-rose-300 hover:text-rose-600" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-black/5">
                <span className="text-[10px] text-neutral-400">
                  {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
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

      {/* Create Invoice Modal */}
      {isMounted && showModal &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-neutral-900">{t('invoices.createInvoice')}</h2>
                <button onClick={() => setShowModal(false)}>
                  <X className="w-5 h-5 text-neutral-400 hover:text-neutral-900" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Client Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-neutral-500 block mb-1">{t('invoices.clientName')} *</label>
                    <input
                      type="text"
                      value={form.client_name}
                      onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-neutral-500 block mb-1">{t('invoices.clientEmail')}</label>
                    <input
                      type="email"
                      value={form.client_email}
                      onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-neutral-500 block mb-1">{t('invoices.clientAddress')}</label>
                  <textarea
                    value={form.client_address}
                    onChange={(e) => setForm({ ...form, client_address: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40 resize-none"
                  />
                </div>

                {/* Line Items */}
                <div>
                  <label className="text-[10px] font-medium text-neutral-500 block mb-2">{t('invoices.items')}</label>
                  <div className="space-y-2">
                    {form.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder={t('invoices.description')}
                          value={item.description}
                          onChange={(e) => updateItem(idx, 'description', e.target.value)}
                          required
                          className="flex-1 px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40"
                        />
                        <input
                          type="number"
                          placeholder={t('invoices.quantity')}
                          value={item.quantity || ''}
                          onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          min={1}
                          className="w-16 px-2 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40 text-center"
                        />
                        <input
                          type="number"
                          placeholder={t('invoices.rate')}
                          value={item.rate || ''}
                          onChange={(e) => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                          min={0}
                          step={0.01}
                          className="w-24 px-2 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40 text-right"
                        />
                        <span className="text-xs font-mono font-bold w-20 text-right">{fmt(item.amount)}</span>
                        {form.items.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)}>
                            <X className="w-3.5 h-3.5 text-rose-400 hover:text-rose-600" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    className="mt-2 text-[10px] text-lime-700 font-bold hover:text-lime-900"
                  >
                    + {t('invoices.addItem')}
                  </button>
                </div>

                {/* Totals Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-neutral-500 block mb-1">{t('invoices.taxRate')}</label>
                    <input
                      type="number"
                      value={form.tax_rate || ''}
                      onChange={(e) => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })}
                      min={0}
                      max={100}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-neutral-500 block mb-1">{t('invoices.discount')}</label>
                    <input
                      type="number"
                      value={form.discount_amount || ''}
                      onChange={(e) => setForm({ ...form, discount_amount: parseFloat(e.target.value) || 0 })}
                      min={0}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-neutral-500 block mb-1">{t('invoices.dueDate')}</label>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <p className="text-[10px] text-neutral-400">{t('invoices.subtotal')}: {fmt(subtotal)}</p>
                    {taxAmount > 0 && <p className="text-[10px] text-neutral-400">{t('invoices.tax')}: {fmt(taxAmount)}</p>}
                    {form.discount_amount > 0 && (
                      <p className="text-[10px] text-neutral-400">{t('invoices.discount')}: -{fmt(form.discount_amount)}</p>
                    )}
                    <p className="text-xs font-black text-neutral-900">{t('invoices.total')}: {fmt(grandTotal)}</p>
                  </div>
                </div>

                {/* Notes & Terms */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-neutral-500 block mb-1">{t('common.notes')}</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={2}
                      placeholder={t('invoices.notesPlaceholder')}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-neutral-500 block mb-1">{t('invoices.terms')}</label>
                    <textarea
                      value={form.terms}
                      onChange={(e) => setForm({ ...form, terms: e.target.value })}
                      rows={2}
                      placeholder={t('invoices.termsPlaceholder')}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40 resize-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !form.client_name}
                  className="w-full py-2.5 rounded-xl bg-lime-400 text-neutral-900 font-bold text-xs hover:bg-lime-300 transition disabled:opacity-40"
                >
                  {submitting ? t('invoices.creating') : t('invoices.createInvoice')}
                </button>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
