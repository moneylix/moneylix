'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Send, Check, CreditCard, Copy, ExternalLink, Trash2,
  FileText, Edit2, X, Ban, Download,
} from 'lucide-react'
import { useCurrency } from '@/lib/contexts/CurrencyContext'

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
  paid_amount: number
  share_token: string
  payment_link: string | null
  notes: string | null
  terms: string | null
  created_at: string
  updated_at: string
}

interface InvoiceSettings {
  business_name: string | null
  logo_url: string | null
  address: string | null
  email: string | null
  phone: string | null
  bank_details: string | null
}

const statusCfg: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-neutral-100 text-neutral-600' },
  sent:      { label: 'Sent',      cls: 'bg-blue-100 text-blue-700' },
  viewed:    { label: 'Viewed',    cls: 'bg-cyan-100 text-cyan-700' },
  paid:      { label: 'Paid',      cls: 'bg-lime-100 text-lime-700' },
  overdue:   { label: 'Overdue',   cls: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-neutral-100 text-neutral-400' },
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { currentCurrency, currencies } = useCurrency()

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [settings, setSettings] = useState<InvoiceSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const fmt = useCallback(
    (n: number, cur?: string) => {
      const code = cur || currentCurrency
      const sym = currencies.find((c) => c.code === code)?.symbol ?? '₹'
      return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    [currencies, currentCurrency]
  )

  const fetchInvoice = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const res = await fetch(`/api/invoices/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        router.push('/dashboard/invoices')
        return
      }
      const data = await res.json()
      setInvoice(data.invoice)
      setSettings(data.settings)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { fetchInvoice() }, [fetchInvoice])

  const doAction = async (action: string) => {
    setActionLoading(true)
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    try {
      switch (action) {
        case 'send':
          await fetch(`/api/invoices/${id}/send`, { method: 'POST', headers })
          break
        case 'paid':
          await fetch(`/api/invoices/${id}`, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'paid' }),
          })
          break
        case 'cancel':
          await fetch(`/api/invoices/${id}`, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' }),
          })
          break
        case 'payment-link':
          await fetch(`/api/invoices/${id}/payment-link`, { method: 'POST', headers })
          break
        case 'delete':
          if (confirm('Delete this draft invoice?')) {
            await fetch(`/api/invoices/${id}`, { method: 'DELETE', headers })
            router.push('/dashboard/invoices')
            return
          }
          break
      }
      fetchInvoice()
    } catch (e) {
      console.error(e)
    } finally {
      setActionLoading(false)
    }
  }

  const copyShareLink = () => {
    if (!invoice) return
    const url = `${window.location.origin}/portal/${invoice.share_token}`
    navigator.clipboard.writeText(url)
  }

  const openPdf = () => {
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    window.open(`/api/invoices/${id}/pdf?token=${encodeURIComponent(token)}`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-neutral-400 gap-2">
        <FileText className="w-10 h-10 opacity-30" />
        <p className="text-sm">Invoice not found</p>
        <Link href="/dashboard/invoices" className="text-xs text-lime-700 font-bold">← Back to Invoices</Link>
      </div>
    )
  }

  const cfg = statusCfg[invoice.status] || statusCfg.draft

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/invoices" className="p-1.5 rounded-lg hover:bg-neutral-100 transition">
            <ArrowLeft className="w-4 h-4 text-neutral-500" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-neutral-900">{invoice.invoice_number}</h1>
            <p className="text-[10px] text-neutral-400">
              Created {new Date(invoice.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {invoice.status === 'draft' && invoice.client_email && (
            <button
              onClick={() => doAction('send')}
              disabled={actionLoading}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition font-bold disabled:opacity-40"
            >
              <Send className="w-3 h-3" /> Send
            </button>
          )}
          {['sent', 'viewed', 'overdue'].includes(invoice.status) && (
            <>
              <button
                onClick={() => doAction('paid')}
                disabled={actionLoading}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-lime-400 text-neutral-900 hover:bg-lime-300 transition font-bold disabled:opacity-40"
              >
                <Check className="w-3 h-3" /> Mark Paid
              </button>
              {!invoice.payment_link && (
                <button
                  onClick={() => doAction('payment-link')}
                  disabled={actionLoading}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-amber-400 text-neutral-900 hover:bg-amber-300 transition font-bold disabled:opacity-40"
                >
                  <CreditCard className="w-3 h-3" /> Payment Link
                </button>
              )}
            </>
          )}
          <button
            onClick={openPdf}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition font-bold"
            title="Download / Print PDF"
          >
            <Download className="w-3 h-3" /> PDF
          </button>
          <button onClick={copyShareLink} className="p-1.5 rounded-lg hover:bg-neutral-100 transition" title="Copy portal link">
            <Copy className="w-3.5 h-3.5 text-neutral-400" />
          </button>
          {invoice.payment_link && (
            <a href={invoice.payment_link} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-neutral-100 transition" title="Payment link">
              <ExternalLink className="w-3.5 h-3.5 text-cyan-500" />
            </a>
          )}
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <button onClick={() => doAction('cancel')} disabled={actionLoading} className="p-1.5 rounded-lg hover:bg-neutral-100 transition" title="Cancel">
              <Ban className="w-3.5 h-3.5 text-neutral-400" />
            </button>
          )}
          {invoice.status === 'draft' && (
            <button onClick={() => doAction('delete')} disabled={actionLoading} className="p-1.5 rounded-lg hover:bg-rose-50 transition" title="Delete">
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            </button>
          )}
        </div>
      </div>

      {/* Invoice Preview Card */}
      <div className="rounded-2xl bg-white shadow-sm border border-neutral-100 p-6">
        {/* Business Branding Header */}
        <div className="flex items-start justify-between mb-8 pb-4 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-black text-neutral-900">{settings?.business_name || 'Your Business'}</h2>
            {settings?.address && <p className="text-xs text-neutral-500 mt-1 whitespace-pre-line">{settings.address}</p>}
            {settings?.email && <p className="text-xs text-neutral-500">{settings.email}</p>}
            {settings?.phone && <p className="text-xs text-neutral-500">{settings.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-neutral-900">{invoice.invoice_number}</p>
            <p className="text-[10px] text-neutral-400 mt-1">
              Date: {new Date(invoice.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            {invoice.due_date && (
              <p className="text-[10px] text-neutral-400">
                Due: {new Date(invoice.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-6">
          <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1">Bill To</p>
          <p className="text-sm font-bold text-neutral-900">{invoice.client_name}</p>
          {invoice.client_email && <p className="text-xs text-neutral-500">{invoice.client_email}</p>}
          {invoice.client_address && (
            <p className="text-xs text-neutral-500 whitespace-pre-line mt-0.5">{invoice.client_address}</p>
          )}
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs mb-6">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="py-2 text-left text-[10px] font-medium text-neutral-400">Description</th>
                <th className="py-2 text-right text-[10px] font-medium text-neutral-400">Qty</th>
                <th className="py-2 text-right text-[10px] font-medium text-neutral-400">Rate</th>
                <th className="py-2 text-right text-[10px] font-medium text-neutral-400">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2 text-neutral-900">{item.description}</td>
                  <td className="py-2 text-right text-neutral-600">{item.quantity}</td>
                  <td className="py-2 text-right text-neutral-600 font-mono">{fmt(item.rate, invoice.currency)}</td>
                  <td className="py-2 text-right font-bold text-neutral-900 font-mono">{fmt(item.amount, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-xs text-neutral-500">
              <span>Subtotal</span>
              <span className="font-mono">{fmt(invoice.subtotal, invoice.currency)}</span>
            </div>
            {invoice.tax_rate > 0 && (
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Tax ({invoice.tax_rate}%)</span>
                <span className="font-mono">{fmt(invoice.tax_amount, invoice.currency)}</span>
              </div>
            )}
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Discount</span>
                <span className="font-mono">-{fmt(invoice.discount_amount, invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-neutral-900 border-t border-neutral-200 pt-1">
              <span>Total</span>
              <span className="font-mono">{fmt(invoice.total, invoice.currency)}</span>
            </div>
            {invoice.status === 'paid' && (
              <div className="flex justify-between text-xs text-lime-700 font-bold">
                <span>Paid</span>
                <span className="font-mono">{fmt(invoice.paid_amount || invoice.total, invoice.currency)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes & Terms */}
        {(invoice.notes || invoice.terms) && (
          <div className="mt-8 pt-4 border-t border-neutral-100 grid grid-cols-1 md:grid-cols-2 gap-4">
            {invoice.notes && (
              <div>
                <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-xs text-neutral-600 whitespace-pre-line">{invoice.notes}</p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1">Terms</p>
                <p className="text-xs text-neutral-600 whitespace-pre-line">{invoice.terms}</p>
              </div>
            )}
          </div>
        )}

        {/* Bank Details */}
        {settings?.bank_details && (
          <div className="mt-6 pt-4 border-t border-neutral-100">
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1">Bank Details</p>
            <p className="text-xs text-neutral-600 whitespace-pre-line">{settings.bank_details}</p>
          </div>
        )}
      </div>
    </div>
  )
}
