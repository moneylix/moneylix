'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download, Upload, Info, Tags, ClipboardList, Calculator, CreditCard, HelpCircle, LogOut, Trash2, AlertTriangle, User, RefreshCw } from 'lucide-react'
import { CurrencySelector } from '@/app/components/CurrencySelector'
import { BankSyncCard } from '@/app/components/BankSyncCard'
import { useBusiness } from '@/lib/contexts/BusinessContext'
import { useRouter } from 'next/navigation'
import { useTranslation, LANGUAGES } from '@/lib/i18n'

const quickLinks = [
  { href: '/dashboard/profile',     icon: User,          label: 'Profile',     desc: 'Edit name, email & password',       color: 'text-sky-400',    bg: 'bg-sky-500/10'    },
  { href: '/dashboard/recurring',   icon: RefreshCw,     label: 'Recurring',   desc: 'Schedule repeat transactions',      color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { href: '/dashboard/categories',  icon: Tags,          label: 'Categories',  desc: 'Manage expense & income categories', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { href: '/dashboard/receivables', icon: ClipboardList, label: 'Receivables', desc: 'Track pending client payments',        color: 'text-amber-400',  bg: 'bg-amber-500/10'  },
  { href: '/dashboard/calculator',  icon: Calculator,    label: 'Calculator',  desc: 'Financial calculator with history',   color: 'text-cyan-400',   bg: 'bg-cyan-500/10'   },
  { href: '/dashboard/pricing',     icon: CreditCard,    label: 'Plans',       desc: 'Upgrade your Moneylix plan',          color: 'text-emerald-400',bg: 'bg-emerald-500/10'},
  { href: '/dashboard/help',        icon: HelpCircle,    label: 'Help',        desc: 'FAQs and support center',             color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
]

export default function SettingsPage() {
  const { activeBusiness } = useBusiness()
  const router = useRouter()
  const { language, setLanguage, t } = useTranslation()
  const [toast, setToast] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('moneylix_auth')
    localStorage.removeItem('moneylix_session_token')
    localStorage.removeItem('moneylix_plan')
    localStorage.removeItem('moneylix_plan_expires')
    localStorage.removeItem('moneylix_plan_days')
    router.push('/')
  }

  const showT = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      showT('Please enter your password')
      return
    }
    setDeleting(true)
    try {
      const token = localStorage.getItem('moneylix_session_token')
      const res = await fetch('/api/user/delete-account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ password: deletePassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        showT(data.error || 'Failed to delete account')
        setDeleting(false)
        return
      }
      // Clear all local storage and redirect
      localStorage.clear()
      router.push('/')
    } catch (err) {
      console.error('Delete account error:', err)
      showT('Something went wrong')
      setDeleting(false)
    }
  }

  const handleExport = async (format: 'csv' | 'json') => {
    const params = new URLSearchParams()
    if (activeBusiness) params.set('businessId', activeBusiness.id.toString())
    const res = await fetch(`/api/export?format=${format}&${params}`)
    const blob = format === 'json' ? new Blob([JSON.stringify(await res.json(), null, 2)], { type: 'application/json' }) : await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `moneylix_${activeBusiness?.name || 'export'}.${format}`; a.click(); URL.revokeObjectURL(url)
    showT(`Exported as ${format.toUpperCase()}`)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true)
    try {
      // 1. Fetch categories for mapping
      const catsRes = await fetch('/api/categories')
      const categories = await catsRes.json() as any[]
      
      const text = await file.text()
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
      
      const transactionsToCreate: any[] = []
      
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
        const row: any = {}
        headers.forEach((h, idx) => { row[h] = vals[idx] })

        if (!row.date || !row.amount) continue

        // Map category name to ID
        const categoryName = row.category || 'Other'
        const catMatch = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase())
        const category_id = catMatch ? catMatch.id : (categories.find(c => c.name === 'Other')?.id || categories[0]?.id || 1)

        transactionsToCreate.push({
          type: (row.type?.toLowerCase() === 'credit' ? 'credit' : 'debit'),
          amount: parseFloat(row.amount.replace(/[^0-9.-]/g, '')) || 0,
          category_id,
          business_id: activeBusiness?.id,
          currency: row.currency || 'INR',
          date: row.date,
          status: 'completed',
          reminder_days: 0,
          note: row.note || '',
          method: row.method || 'cash',
          tags: row.tags || ''
        })
      }

      if (transactionsToCreate.length > 0) {
        const res = await fetch('/api/transactions/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions: transactionsToCreate })
        })
        if (!res.ok) throw new Error('Bulk insert failed')
        showT(`Imported ${transactionsToCreate.length} transactions`)
      } else {
        showT('No valid transactions found')
      }
    } catch (err) { 
      console.error(err)
      showT('Import failed') 
    } finally { 
      setImporting(false); 
      e.target.value = '' 
    }
  }

  const sections = [
    {
      icon: <Download className="w-3.5 h-3.5 text-emerald-400" />, title: 'Export Data', desc: 'Download your data',
      content: (
        <div className="flex gap-2 mt-2">
          {(['csv', 'json'] as const).map(fmt => (
            <button key={fmt} onClick={() => handleExport(fmt)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition">
              <Download className="w-3 h-3" /> {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      )
    },
    {
      icon: <Upload className="w-3.5 h-3.5 text-blue-400" />, title: 'Import CSV', desc: 'Import transactions from file',
      content: (
        <div className="mt-2">
          <div className="rounded-xl border border-dashed border-white/10 bg-slate-800/30 p-3">
            <input type="file" accept=".csv" onChange={handleImport} disabled={importing} className="block w-full text-xs text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-emerald-500/20 file:text-emerald-300 file:cursor-pointer" />
            {importing && <div className="mt-2 flex items-center gap-2 text-slate-400 text-xs"><div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />Importing...</div>}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Format: Date, Type, Amount, Category, Note, Method, Tags</p>
        </div>
      )
    },
    {
      icon: <Info className="w-3.5 h-3.5 text-violet-400" />, title: 'About Moneylix', desc: 'v1.0.0 — Next.js + SQLite + Tailwind',
      content: (
        <p className="mt-2 text-[10px] text-slate-500">
          Keyboard shortcuts: <span className="text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded font-mono">A</span> add transaction,{' '}
          <span className="text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded font-mono">/</span> search
        </p>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-bold text-white">Settings</h1>
        <p className="text-[10px] text-slate-400">Manage preferences & data</p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        {quickLinks.map(({ href, icon: Icon, label, desc, color, bg }) => (
          <Link key={href} href={href} className="rounded-2xl bg-white shadow-sm p-4 flex flex-col gap-2 active:scale-95 transition-all">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs font-bold text-white">{label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Bank Sync */}
      <BankSyncCard />

      {/* Currency */}
      <div className="rounded-2xl bg-white shadow-sm p-3">
        <p className="text-xs font-semibold text-white mb-2">Currency</p>
        <CurrencySelector />
      </div>


      {/* Language */}
      <div className="rounded-2xl bg-white shadow-sm p-3">
        <p className="text-xs font-semibold text-white mb-2">{t('settings.language')}</p>
        <div className="flex gap-2 flex-wrap">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                language === lang.code
                  ? 'bg-lime-400 text-neutral-900 font-bold shadow-sm'
                  : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
              }`}
            >
              <span>{lang.nativeName}</span>
              <span className="text-[10px] opacity-60">({lang.name})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Data sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {sections.map(({ icon, title, desc, content }) => (
          <div key={title} className="rounded-2xl bg-white shadow-sm p-3">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-6 h-6 rounded-lg bg-neutral-100 flex items-center justify-center">{icon}</div>
              <p className="text-xs font-semibold text-white">{title}</p>
            </div>
            <p className="text-[10px] text-slate-400 ml-8">{desc}</p>
            {content}
          </div>
        ))}
      </div>

      {/* Logout — mobile only */}
      <button onClick={handleLogout} className="lg:hidden w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-sm font-bold active:scale-95 transition-all">
        <LogOut className="w-4 h-4" /> Logout
      </button>

      {/* Delete Account — Danger Zone */}
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center">
            <Trash2 className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-rose-300">Delete Account</p>
            <p className="text-[10px] text-slate-400">Permanently delete your account and all data</p>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
          This will permanently delete your account, all businesses, transactions, categories, and subscription data. This action cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 font-semibold hover:bg-rose-500/20 active:scale-95 transition-all"
        >
          <Trash2 className="w-3 h-3" /> Delete My Account
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0d1321] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Account?</h3>
                <p className="text-[10px] text-slate-400">This cannot be undone</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              All your data including businesses, transactions, receivables, and subscription will be permanently erased. Enter your password to confirm.
            </p>
            <input
              type="password"
              placeholder="Enter your password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeletePassword('') }}
                className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-slate-300 hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || !deletePassword}
                className="flex-1 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/20 text-sm font-bold text-rose-300 hover:bg-rose-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 border border-white/10 text-white px-4 py-2 rounded-full shadow-2xl z-50 text-xs">{toast}</div>}
    </div>
  )
}
