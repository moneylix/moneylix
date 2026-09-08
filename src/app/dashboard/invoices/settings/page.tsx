'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, Building2, Mail, Phone, CreditCard, FileText, Hash } from 'lucide-react'

interface InvoiceSettings {
  business_name: string
  logo_url: string
  address: string
  email: string
  phone: string
  bank_details: string
  default_terms: string
  default_notes: string
  invoice_prefix: string
  next_invoice_number: number
}

export default function InvoiceSettingsPage() {
  const [settings, setSettings] = useState<InvoiceSettings>({
    business_name: '',
    logo_url: '',
    address: '',
    email: '',
    phone: '',
    bank_details: '',
    default_terms: 'Payment is due within 30 days of the invoice date.',
    default_notes: 'Thank you for your business!',
    invoice_prefix: 'INV',
    next_invoice_number: 1,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const res = await fetch('/api/invoices/settings', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (data.settings) {
        setSettings({
          business_name: data.settings.business_name || '',
          logo_url: data.settings.logo_url || '',
          address: data.settings.address || '',
          email: data.settings.email || '',
          phone: data.settings.phone || '',
          bank_details: data.settings.bank_details || '',
          default_terms: data.settings.default_terms || '',
          default_notes: data.settings.default_notes || '',
          invoice_prefix: data.settings.invoice_prefix || 'INV',
          next_invoice_number: data.settings.next_invoice_number || 1,
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      await fetch('/api/invoices/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(settings),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/invoices" className="p-1.5 rounded-lg hover:bg-neutral-100 transition">
          <ArrowLeft className="w-4 h-4 text-neutral-500" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-neutral-900">Invoice Settings</h1>
          <p className="text-[10px] text-neutral-400">Configure branding, defaults, and invoice numbering</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Business Branding */}
        <div className="rounded-2xl bg-white shadow-sm p-5">
          <h2 className="text-xs font-bold text-neutral-900 mb-3 flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" /> Business Branding
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-medium text-neutral-500 block mb-1">Business Name</label>
              <input
                type="text"
                value={settings.business_name}
                onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
                placeholder="Your Business Name"
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-neutral-500 block mb-1">Address</label>
              <textarea
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                rows={3}
                placeholder="Street address, City, State, PIN"
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40 resize-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-medium text-neutral-500 block mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="billing@yourbusiness.com"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-neutral-500 block mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Phone
                </label>
                <input
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-medium text-neutral-500 block mb-1">Logo URL</label>
              <input
                type="url"
                value={settings.logo_url}
                onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
                placeholder="https://yourbusiness.com/logo.png"
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40"
              />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="rounded-2xl bg-white shadow-sm p-5">
          <h2 className="text-xs font-bold text-neutral-900 mb-3 flex items-center gap-2">
            <CreditCard className="w-3.5 h-3.5" /> Bank Details
          </h2>
          <textarea
            value={settings.bank_details}
            onChange={(e) => setSettings({ ...settings, bank_details: e.target.value })}
            rows={4}
            placeholder={"Bank Name: State Bank of India\nAccount Number: 1234567890\nIFSC: SBIN0001234\nBranch: Main Branch"}
            className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40 resize-none"
          />
        </div>

        {/* Defaults */}
        <div className="rounded-2xl bg-white shadow-sm p-5">
          <h2 className="text-xs font-bold text-neutral-900 mb-3 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" /> Default Text
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-medium text-neutral-500 block mb-1">Default Terms</label>
              <textarea
                value={settings.default_terms}
                onChange={(e) => setSettings({ ...settings, default_terms: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40 resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-neutral-500 block mb-1">Default Notes</label>
              <textarea
                value={settings.default_notes}
                onChange={(e) => setSettings({ ...settings, default_notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Invoice Numbering */}
        <div className="rounded-2xl bg-white shadow-sm p-5">
          <h2 className="text-xs font-bold text-neutral-900 mb-3 flex items-center gap-2">
            <Hash className="w-3.5 h-3.5" /> Invoice Numbering
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-neutral-500 block mb-1">Prefix</label>
              <input
                type="text"
                value={settings.invoice_prefix}
                onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value.toUpperCase() })}
                maxLength={10}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-lime-400/40"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-neutral-500 block mb-1">Next Number</label>
              <input
                type="number"
                value={settings.next_invoice_number}
                readOnly
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-100 bg-neutral-50 text-neutral-400"
              />
            </div>
          </div>
          <p className="text-[10px] text-neutral-400 mt-2">
            Next invoice will be: <span className="font-bold">{settings.invoice_prefix}-{String(settings.next_invoice_number).padStart(4, '0')}</span>
          </p>
        </div>

        {/* Save */}
        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-lime-400 text-neutral-900 font-bold text-xs hover:bg-lime-300 transition disabled:opacity-40"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
