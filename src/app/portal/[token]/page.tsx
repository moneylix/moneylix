'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { FileText, CheckCircle2, Clock, AlertTriangle, CreditCard, ExternalLink } from 'lucide-react'

interface InvoiceItem {
  description: string
  quantity: number
  rate: number
  amount: number
}

interface PortalInvoice {
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
  payment_link: string | null
  notes: string | null
  terms: string | null
  created_at: string
}

interface BusinessInfo {
  business_name: string | null
  logo_url: string | null
  address: string | null
  email: string | null
  phone: string | null
  bank_details: string | null
}

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; cls: string; bgCls: string }> = {
  draft:     { label: 'Draft',         icon: FileText,       cls: 'text-neutral-600', bgCls: 'bg-neutral-100' },
  sent:      { label: 'Awaiting Payment', icon: Clock,       cls: 'text-blue-700',    bgCls: 'bg-blue-50' },
  viewed:    { label: 'Awaiting Payment', icon: Clock,       cls: 'text-blue-700',    bgCls: 'bg-blue-50' },
  paid:      { label: 'Paid',          icon: CheckCircle2,   cls: 'text-emerald-700', bgCls: 'bg-emerald-50' },
  overdue:   { label: 'Overdue',       icon: AlertTriangle,  cls: 'text-rose-700',    bgCls: 'bg-rose-50' },
  cancelled: { label: 'Cancelled',     icon: FileText,       cls: 'text-neutral-500', bgCls: 'bg-neutral-50' },
}

export default function ClientPortalPage() {
  const { token } = useParams<{ token: string }>()
  const [invoice, setInvoice] = useState<PortalInvoice | null>(null)
  const [business, setBusiness] = useState<BusinessInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/portal/${token}`)
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Invoice not found')
          return
        }
        const data = await res.json()
        setInvoice(data.invoice)
        setBusiness(data.business)
      } catch {
        setError('Failed to load invoice')
      } finally {
        setLoading(false)
      }
    }
    if (token) load()
  }, [token])

  const fmt = (n: number) => {
    const sym = invoice?.currency === 'INR' ? '₹' : invoice?.currency === 'USD' ? '$' : invoice?.currency === 'EUR' ? '€' : invoice?.currency === 'GBP' ? '£' : (invoice?.currency || '₹')
    return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center gap-3">
        <FileText className="w-12 h-12 text-neutral-300" />
        <h1 className="text-lg font-bold text-neutral-700">{error || 'Invoice not found'}</h1>
        <p className="text-sm text-neutral-400">This invoice link may be expired or invalid.</p>
      </div>
    )
  }

  const statusInfo = statusConfig[invoice.status] || statusConfig.sent
  const StatusIcon = statusInfo.icon
  const isPending = ['sent', 'viewed', 'overdue'].includes(invoice.status)
  const daysUntilDue = invoice.due_date
    ? Math.ceil((new Date(invoice.due_date).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-neutral-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {business?.logo_url ? (
              <img src={business.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <FileText className="w-4 h-4 text-emerald-600" />
              </div>
            )}
            <span className="text-sm font-bold text-neutral-900">
              {business?.business_name || 'Invoice'}
            </span>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${statusInfo.bgCls}`}>
            <StatusIcon className={`w-3.5 h-3.5 ${statusInfo.cls}`} />
            <span className={`text-xs font-bold ${statusInfo.cls}`}>{statusInfo.label}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Pay Now CTA (if pending) */}
        {isPending && invoice.payment_link && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-900">Payment Due: {fmt(invoice.total)}</p>
              {daysUntilDue !== null && (
                <p className="text-xs text-emerald-700 mt-0.5">
                  {daysUntilDue > 0
                    ? `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`
                    : daysUntilDue === 0
                    ? 'Due today'
                    : `Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''}`}
                </p>
              )}
            </div>
            <a
              href={invoice.payment_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-bold text-sm rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-200"
            >
              <CreditCard className="w-4 h-4" /> Pay Now
            </a>
          </div>
        )}

        {/* Paid Banner */}
        {invoice.status === 'paid' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <div>
              <p className="text-sm font-bold text-emerald-900">Payment Received</p>
              {invoice.paid_date && (
                <p className="text-xs text-emerald-700">
                  Paid on {new Date(invoice.paid_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Invoice Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 md:p-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 pb-6 border-b border-neutral-100 gap-4">
            <div>
              <h2 className="text-xl font-black text-neutral-900">{business?.business_name || 'Business'}</h2>
              {business?.address && <p className="text-xs text-neutral-500 mt-1 whitespace-pre-line">{business.address}</p>}
              {business?.email && <p className="text-xs text-neutral-500">{business.email}</p>}
              {business?.phone && <p className="text-xs text-neutral-500">{business.phone}</p>}
            </div>
            <div className="md:text-right">
              <p className="text-2xl font-black text-neutral-900">{invoice.invoice_number}</p>
              <p className="text-xs text-neutral-400 mt-1">
                Date: {new Date(invoice.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              {invoice.due_date && (
                <p className={`text-xs mt-0.5 ${daysUntilDue !== null && daysUntilDue < 0 ? 'text-rose-600 font-bold' : 'text-neutral-400'}`}>
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
            {invoice.client_address && <p className="text-xs text-neutral-500 whitespace-pre-line mt-0.5">{invoice.client_address}</p>}
          </div>

          {/* Items */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs mb-6">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="py-2 text-left text-[10px] font-medium text-neutral-400 w-1/2">Description</th>
                  <th className="py-2 text-right text-[10px] font-medium text-neutral-400">Qty</th>
                  <th className="py-2 text-right text-[10px] font-medium text-neutral-400">Rate</th>
                  <th className="py-2 text-right text-[10px] font-medium text-neutral-400">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {invoice.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-3 text-neutral-900">{item.description}</td>
                    <td className="py-3 text-right text-neutral-600">{item.quantity}</td>
                    <td className="py-3 text-right text-neutral-600 font-mono">{fmt(item.rate)}</td>
                    <td className="py-3 text-right font-bold text-neutral-900 font-mono">{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5">
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Subtotal</span>
                <span className="font-mono">{fmt(invoice.subtotal)}</span>
              </div>
              {invoice.tax_rate > 0 && (
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>Tax ({invoice.tax_rate}%)</span>
                  <span className="font-mono">{fmt(invoice.tax_amount)}</span>
                </div>
              )}
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>Discount</span>
                  <span className="font-mono">-{fmt(invoice.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-neutral-900 border-t-2 border-neutral-900 pt-2 mt-2">
                <span>Total</span>
                <span className="font-mono">{fmt(invoice.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms) && (
            <div className="mt-8 pt-6 border-t border-neutral-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              {invoice.notes && (
                <div>
                  <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-xs text-neutral-600 whitespace-pre-line">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1">Terms & Conditions</p>
                  <p className="text-xs text-neutral-600 whitespace-pre-line">{invoice.terms}</p>
                </div>
              )}
            </div>
          )}

          {/* Bank Details */}
          {business?.bank_details && (
            <div className="mt-6 pt-6 border-t border-neutral-100">
              <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1">Bank Details for Payment</p>
              <p className="text-xs text-neutral-600 whitespace-pre-line">{business.bank_details}</p>
            </div>
          )}
        </div>

        {/* Footer Pay Button (sticky on mobile) */}
        {isPending && invoice.payment_link && (
          <div className="mt-6 md:hidden sticky bottom-4">
            <a
              href={invoice.payment_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-emerald-600 text-white font-bold text-sm rounded-2xl hover:bg-emerald-700 transition shadow-xl shadow-emerald-200"
            >
              <CreditCard className="w-4 h-4" /> Pay {fmt(invoice.total)}
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-neutral-400">
            Powered by{' '}
            <a href="https://moneylix.in" className="text-emerald-600 font-bold hover:underline" target="_blank" rel="noopener noreferrer">
              Moneylix
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
