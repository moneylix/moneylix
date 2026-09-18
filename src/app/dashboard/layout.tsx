'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

function useIsNativeApp() {
  const [isNative, setIsNative] = useState(false)
  useEffect(() => {
    const cap = (window as any).Capacitor
    setIsNative(!!(cap?.isNativePlatform?.()))
  }, [])
  return isNative
}
import Link from 'next/link'
import {
  LayoutDashboard, Receipt, Settings, LogOut, X, Building2,
  Bell, Globe, Calculator, ClipboardList, Sparkles, Lock, CreditCard,
  Crown, AlertTriangle, Info, HelpCircle, Plus, Tags, Calendar,
  Target, GitCompareArrows, FileText, Camera, ReceiptText, TrendingUp,
  Users, Banknote, Landmark, Package, Clock, Menu,
} from 'lucide-react'
import { BusinessProvider, useBusiness } from '@/lib/contexts/BusinessContext'
import { CurrencyProvider } from '@/lib/contexts/CurrencyContext'
import { PlanProvider, usePlan, PLAN_LABELS } from '@/lib/contexts/PlanContext'
import { LanguageProvider, useTranslation } from '@/lib/i18n'
import { BusinessSwitcher } from '@/app/components/BusinessSwitcher'
import { ErrorBoundary } from '@/app/components/ErrorBoundary'

// Desktop sidebar nav items
const sidebarItems = [
  { href: '/dashboard',               icon: LayoutDashboard,   label: 'nav.dashboard',       gate: null },
  { href: '/dashboard/transactions',  icon: Receipt,           label: 'nav.transactions',    gate: null },
  { href: '/dashboard/calendar',      icon: Calendar,          label: 'nav.calendar',        gate: null },
  { href: '/dashboard/bank',          icon: Building2,         label: 'nav.bankSync',       gate: 'bankSync' },
  { href: '/dashboard/categories',    icon: Tags,              label: 'nav.categories',      gate: null },
  { href: '/dashboard/overall',       icon: Globe,             label: 'nav.overall',         gate: 'overall' },
  { href: '/dashboard/receivables',   icon: ClipboardList,     label: 'nav.receivables',     gate: 'receivables' },
  { href: '/dashboard/notifications', icon: Bell,              label: 'nav.notifications',   gate: null },
  { href: '/dashboard/budgets',       icon: Target,            label: 'nav.budgets',         gate: null },
  { href: '/dashboard/reconciliation',icon: GitCompareArrows,  label: 'nav.reconciliation',  gate: 'reconciliation' },
  { href: '/dashboard/invoices',      icon: FileText,          label: 'nav.invoices',        gate: 'invoicing' },
  { href: '/dashboard/receipts',      icon: Camera,            label: 'nav.receipts',        gate: 'ocrScanner' },
  { href: '/dashboard/tax',           icon: ReceiptText,       label: 'nav.tax',       gate: 'taxModule' },
  { href: '/dashboard/forecast',      icon: TrendingUp,        label: 'nav.forecast',        gate: 'forecasting' },
  { href: '/dashboard/team',          icon: Users,             label: 'nav.team',            gate: 'teamRoles' },
  { href: '/dashboard/payroll',       icon: Banknote,          label: 'nav.payroll',         gate: 'payroll' },
  { href: '/dashboard/loans',         icon: Landmark,          label: 'nav.loans',     gate: 'loans' },
  { href: '/dashboard/inventory',     icon: Package,           label: 'nav.inventory',       gate: 'inventory' },
  { href: '/dashboard/time',          icon: Clock,             label: 'nav.time',   gate: 'timeTracking' },
  { href: '/dashboard/ai',            icon: Sparkles,          label: 'nav.aiAdvisor',      gate: 'aiAdvisor' },
  { href: '/dashboard/calculator',    icon: Calculator,        label: 'nav.calculator',      gate: null },
  { href: '/dashboard/settings',      icon: Settings,          label: 'nav.settings',        gate: null },
  { href: '/dashboard/pricing',       icon: CreditCard,        label: 'nav.plans',           gate: null },
  { href: '/dashboard/help',          icon: HelpCircle,        label: 'nav.help',            gate: null },
]

// Mobile bottom nav (5 tabs)
const bottomNavItems = [
  { href: '/dashboard',              icon: LayoutDashboard, label: 'nav.dashboard' },
  { href: '/dashboard/transactions', icon: Receipt,         label: 'nav.transactions' },
  { href: '/dashboard/bank',         icon: Building2,       label: 'nav.bankSync' },
  { href: '/dashboard/ai',           icon: Sparkles,        label: 'nav.aiAdvisor' },
  { href: '/dashboard/settings',     icon: Settings,        label: 'nav.settings' },
]

function SidebarContent({ onClose }: { onClose: () => void }) {
  const pathname = usePathname()
  const { plan, features } = usePlan()
  const { t } = useTranslation()
  const label = PLAN_LABELS[plan]

  return (
    <>
      <nav className="px-2 space-y-0.5">
        {sidebarItems.map((item) => {
          const isActive = pathname === item.href
          const isLocked = item.gate && !features[item.gate as keyof typeof features]
          return (
            <Link
              key={item.href}
              href={isLocked ? '/dashboard/pricing' : item.href}
              onClick={onClose}
              className={`flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-neutral-900 text-neutral-50 shadow'
                  : isLocked
                  ? 'text-neutral-300 hover:text-neutral-400'
                  : 'text-neutral-500 hover:bg-black/5 hover:text-neutral-900'
              }`}
            >
              <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className={isLocked ? 'line-through decoration-neutral-300' : ''}>{t(item.label)}</span>
              {isLocked && <Lock className="w-2.5 h-2.5 ml-auto text-neutral-300" />}
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto px-2 pt-4 pb-1">
        <Link href="/dashboard/pricing" className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition hover:opacity-90 ${
          plan === 'premium' ? 'border-amber-500/30 bg-amber-500/10' :
          plan === 'pro'     ? 'border-cyan-500/30 bg-cyan-500/10' :
                               'border-white/10 bg-white/5'
        }`}>
          <div className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] ${label.badge}`}>
            {plan === 'premium' ? '★' : plan === 'pro' ? '◆' : '○'}
          </div>
          <div>
            <p className={`text-[10px] font-bold ${label.color}`}>{label.name} Plan</p>
            <p className="text-[9px] text-slate-500">{plan === 'free' ? 'Tap to upgrade' : label.price}</p>
          </div>
          {plan === 'free' && <span className="ml-auto text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full font-bold">↑ PRO</span>}
        </Link>
      </div>
    </>
  )
}

type NotificationType = { id: string; type: string; message: string; created_at: string }

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationType[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem('moneylix_session_token')
    if (!token) return
    fetch('/api/user/notifications', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setNotifications(d.notifications ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const iconFor = (type: string) => {
    if (type === 'error')   return <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
    if (type === 'warning') return <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />
    return <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)} className="relative p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center">
        <Bell className="w-5 h-5" />
        {notifications.length > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-slate-950 animate-pulse" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-72 sm:w-80 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <p className="text-xs font-black text-white uppercase tracking-widest">Notifications</p>
            <button onClick={() => setOpen(false)}><X className="w-4 h-4 text-slate-500 hover:text-white" /></button>
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-500">All clear — no alerts</div>
          ) : (
            <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
              {notifications.map(n => (
                <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition">
                  {iconFor(n.type)}
                  <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>
                </div>
              ))}
            </div>
          )}
          <div className="px-4 py-2 border-t border-white/5">
            <Link href="/dashboard/notifications" onClick={() => setOpen(false)} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-widest">
              View All →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function ReceivableBadge() {
  const [pending, setPending] = useState<number | null>(null)
  const { activeBusiness } = useBusiness()

  useEffect(() => {
    const token = localStorage.getItem('moneylix_session_token')
    if (!token) return
    const params = new URLSearchParams()
    if (activeBusiness) params.set('businessId', activeBusiness.id.toString())
    fetch(`/api/dashboard/receivables?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const total = (d.receivables ?? [])
          .filter((r: any) => r.status === 'pending')
          .reduce((sum: number, r: any) => sum + Number(r.amount), 0)
        setPending(total)
      })
      .catch(() => {})
  }, [activeBusiness])

  if (!pending || pending === 0) return null

  return (
    <Link href="/dashboard/receivables" className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 rounded-full px-2 py-1">
      <ClipboardList className="w-3 h-3 text-amber-400" />
      <span className="text-[10px] font-black text-amber-400">₹{pending.toLocaleString('en-IN')}</span>
    </Link>
  )
}

function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {bottomNavItems.map((item, i) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          // Center FAB button placeholder
          if (i === 2) return (
            <div key="fab" className="flex flex-col items-center">
              <button
                onClick={() => router.push('/dashboard/transactions?action=add')}
                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 -mt-4 active:scale-95 transition-all"
              >
                <Plus className="w-6 h-6 text-white" />
              </button>
              <span className="text-[9px] text-slate-500 mt-1">Add</span>
            </div>
          )
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 px-3 py-1 min-w-[48px]">
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-emerald-500/20' : ''}`}>
                <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
              </div>
              <span className={`text-[9px] font-bold transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                {t(item.label)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isNativeApp = useIsNativeApp()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [username, setUsername] = useState('')

  useEffect(() => {
    setMounted(true)
    if (!localStorage.getItem('moneylix_auth')) router.push('/')
    const token = localStorage.getItem('moneylix_session_token')
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.username) setUsername(d.username) })
        .catch(() => {})
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key.toLowerCase() === 'a') { e.preventDefault(); router.push('/dashboard/transactions?action=add') }
      if (e.key === '/') {
        e.preventDefault()
        const searchInput = document.getElementById('search-input')
        if (searchInput) searchInput.focus()
        else { router.push('/dashboard/transactions'); setTimeout(() => document.getElementById('search-input')?.focus(), 100) }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('moneylix_auth')
    localStorage.removeItem('moneylix_session_token')
    localStorage.removeItem('moneylix_plan')
    localStorage.removeItem('moneylix_plan_expires')
    localStorage.removeItem('moneylix_plan_days')
    router.push('/')
  }

  if (!mounted) return null

  return (
    <div className="h-screen overflow-hidden bg-background flex text-foreground">
      {sidebarOpen && !isNativeApp && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />}

      <CurrencyProvider>
        <BusinessProvider>

          {/* Sidebar — website only, hidden in native app */}
          {!isNativeApp && (
            <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-52 h-screen flex flex-col border-r border-black/10 bg-white transform transition-all duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}`}>
              <div className="flex-shrink-0 px-3 py-3 flex items-center justify-between border-b border-black/5">
                <Link href="/dashboard" className="flex items-center gap-2 group">
                  <img src="/logos/moneylix-app-icon-dark.svg" alt="Moneylix" className="h-8 w-8 flex-shrink-0 group-hover:scale-105 transition-transform drop-shadow-md" />
                  <div>
                    <h1 className="text-sm font-bold leading-tight text-neutral-900">Moneylix</h1>
                    <p className="text-[10px] text-neutral-400 leading-tight">Finance Dashboard</p>
                  </div>
                </Link>
                <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-neutral-400 hover:text-neutral-900"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 flex flex-col overflow-y-auto sidebar-scroll py-2">
                <div className="px-2 pb-2">
                  <div className="rounded-xl border border-black/10 bg-black/[0.03] p-1">
                    <BusinessSwitcher compact />
                  </div>
                </div>
                <SidebarContent onClose={() => setSidebarOpen(false)} />
              </div>
              <div className="flex-shrink-0 px-2 py-2 border-t border-black/5">
                <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all w-full">
                  <LogOut className="w-3.5 h-3.5" /><span>Logout</span>
                </button>
              </div>
            </aside>
          )}

          {/* Main content */}
          <div className="flex-1 flex flex-col h-screen overflow-hidden">

            {/* Native App Header — only in Capacitor */}
            {isNativeApp && (
              <header className="bg-background/95 backdrop-blur-2xl sticky top-0 z-30 border-b border-white/5"
                style={{ paddingTop: 'max(env(safe-area-inset-top), 50px)' }}>
                <div className="flex items-center justify-between px-4 pb-3 pt-1">
                  <div className="flex items-center gap-2">
                    <img src="/logos/moneylix-app-icon-dark.svg" alt="Moneylix" className="h-7 w-7" />
                    <div className="max-w-[130px]">
                      <BusinessSwitcher />
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <ReceivableBadge />
                    <NotificationBell />
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 p-[2px] shadow-lg flex-shrink-0">
                      <div className="h-full w-full rounded-[10px] bg-slate-950 flex items-center justify-center font-black text-[10px] text-white">
                        {username ? username.slice(0, 2).toUpperCase() : 'AB'}
                      </div>
                    </div>
                  </div>
                </div>
              </header>
            )}

            {/* Website Header — only on web */}
            {!isNativeApp && (
              <header className="bg-background/80 backdrop-blur-2xl sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-10 border-b border-white/5 py-3 lg:py-6"
                style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-colors border border-white/5">
                    <Menu className="w-5 h-5" />
                  </button>
                  <div className="hidden lg:flex flex-col">
                    <p className="text-[10px] text-lime-600 font-black uppercase tracking-[0.2em]">Live Session</p>
                    <p className="text-lg font-black text-neutral-900 tracking-tight">Financial Command Center</p>
                  </div>
                  {/* Mobile: show business name */}
                  <div className="lg:hidden">
                    <p className="text-sm font-bold text-neutral-900">Moneylix</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                  <ReceivableBadge />
                  <NotificationBell />
                  <div className="flex items-center gap-3 pl-2 border-l border-black/10">
                    <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-2xl bg-neutral-900 flex items-center justify-center font-black text-xs text-neutral-50 shadow-lg">
                      {username ? username.slice(0, 2).toUpperCase() : '??'}
                    </div>
                    <div className="hidden xl:block">
                      <p className="text-xs font-black text-neutral-900 capitalize">{username || 'Loading...'}</p>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Moneylix Account</p>
                    </div>
                  </div>
                </div>
              </header>
            )}

            {/* Page content — pb-24 ensures bottom nav never overlaps on mobile */}
            <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 lg:p-6 custom-scrollbar pb-24 lg:pb-6">
              <div className="animate-fadeIn max-w-[1400px] mx-auto">
                <ErrorBoundary>{children}</ErrorBoundary>
              </div>
            </main>
          </div>

          {/* Bottom Nav — ALL mobile views (lg:hidden is on the component itself) */}
          <MobileBottomNav />

        </BusinessProvider>
      </CurrencyProvider>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlanProvider>
      <LanguageProvider>
        <LayoutInner>{children}</LayoutInner>
      </LanguageProvider>
    </PlanProvider>
  )
}
