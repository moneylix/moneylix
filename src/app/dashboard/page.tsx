'use client'

import { useEffect, useState, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'
import { AlertCircle, ArrowRight, TrendingUp, TrendingDown, Wallet, Target, Search, Crown, Building2, ArrowDownLeft, ArrowUpRight, RefreshCw, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useBusiness } from '@/lib/contexts/BusinessContext'
import { useCurrency } from '@/lib/contexts/CurrencyContext'
import { usePlan, PLAN_LABELS } from '@/lib/contexts/PlanContext'
import { useTranslation } from '@/lib/i18n'
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area,
} from 'recharts'
import type { DashboardSummary, CategorySpend, DailyCashflow, Transaction } from '@/types'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils/format'
import { useCountUp } from '@/lib/hooks/useCountUp'

const CARD_HOVER = 'transition-all duration-300 hover:-translate-y-1 hover:shadow-xl'

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const points = data.map((v, i) => ({ i, v }))
  return (
    <div className="h-8 w-16 sm:w-20 flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#spark-${color.replace('#', '')})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function AnimatedValue({ value, prefix = '', reducedMotion }: { value: number; prefix?: string; reducedMotion: boolean }) {
  const animated = useCountUp(value, reducedMotion, 0.1)
  return <>{prefix}{animated.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</>
}

interface BankTx {
  id: number
  type: 'credit' | 'debit'
  amount: number
  currency: string
  date: string
  narration: string
  ai_category_suggestion: string | null
  is_categorised: number
}

export default function DashboardPage() {
  const { activeBusiness, loading: businessLoading } = useBusiness()
  const { plan, daysLeft, can } = usePlan()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [categorySpend, setCategorySpend] = useState<CategorySpend[]>([])
  const [dailyCashflow, setDailyCashflow] = useState<DailyCashflow[]>([])
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [bankTxs, setBankTxs] = useState<BankTx[]>([])
  const [bankLoading, setBankLoading] = useState(false)
  const { currentCurrency, currencies, loading: currencyLoading } = useCurrency()
  const { t } = useTranslation()
  const [range, setRange] = useState<7 | 30>(7)
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null)
  const reducedMotion = !!useReducedMotion()

  const fetchData = useCallback(async () => {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const bId = activeBusiness.id
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const [summaryRes, chartsRes, transactionsRes] = await Promise.all([
        fetch(`/api/dashboard?businessId=${bId}`, { headers: authHeaders }),
        fetch(`/api/charts?businessId=${bId}&range=${range}`, { headers: authHeaders }),
        fetch(`/api/transactions?limit=6&sortBy=date&sortOrder=desc&businessId=${bId}`, { headers: authHeaders }),
      ])
      const summaryData = await summaryRes.json()
      const chartsData = await chartsRes.json()
      const transactionsData = await transactionsRes.json()
      setSummary(summaryData)
      setCategorySpend(chartsData.categorySpend || [])
      setDailyCashflow(chartsData.dailyCashflow || [])
      setRecentTransactions(transactionsData.transactions || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [activeBusiness, range])

  const fetchBankActivity = useCallback(async () => {
    if (!can('bankSync')) return
    setBankLoading(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      if (!token) return
      const res = await fetch('/api/bank/transactions?limit=5', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setBankTxs(data.transactions || [])
    } catch {
      // Silent — bank sync section just won't show
    } finally {
      setBankLoading(false)
    }
  }, [can])

  useEffect(() => { fetchData(); fetchBankActivity() }, [fetchData, fetchBankActivity])

  const fmt = useCallback((amount: number) => {
    const sym = currencies.find(c => c.code === currentCurrency)?.symbol ?? currentCurrency
    return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }, [currentCurrency, currencies])

  if (loading || businessLoading || currencyLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" /></div>
  }
  if (!activeBusiness) {
    return <div className="flex flex-col items-center justify-center h-64 text-neutral-400 gap-4">
      <div className="p-4 rounded-full bg-neutral-100"><AlertCircle className="w-10 h-10" /></div>
      <p className="font-semibold">No business found. Let&apos;s set one up!</p>
      <Link href="/onboarding" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-6 py-3 rounded-2xl transition">
        Create Your Business
      </Link>
    </div>
  }

  const monthCredit = summary?.monthCredit || 0
  const monthDebit  = summary?.monthDebit  || 0
  const totalBalance = summary?.totalBalance || 0
  const savingsRate  = monthCredit > 0 ? Math.round(((monthCredit - monthDebit) / monthCredit) * 100) : 0
  const totalCatSpend = categorySpend.reduce((s, c) => s + c.amount, 0)
  const currencySymbol = currencies.find(c => c.code === currentCurrency)?.symbol ?? currentCurrency

  // Sparklines derived from the same dailyCashflow already fetched for the Cash Flow chart —
  // no extra requests. Total Balance is walked backwards from today's real balance so the
  // series ends exactly on the true current figure.
  const incomeSpark = dailyCashflow.map(d => d.credit)
  const expenseSpark = dailyCashflow.map(d => d.debit)
  const savingsSpark = dailyCashflow.map(d => d.credit > 0 ? ((d.credit - d.debit) / d.credit) * 100 : 0)
  const balanceSpark: number[] = []
  {
    let running = totalBalance
    for (let i = dailyCashflow.length - 1; i >= 0; i--) {
      balanceSpark[i] = running
      running -= (dailyCashflow[i].credit - dailyCashflow[i].debit)
    }
  }

  const formatChange = (pct: number | null) =>
    pct === null ? { label: '—', positive: null } : { label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, positive: pct >= 0 }

  const summaryCards = [
    { title: t('dashboard.totalBalance'),   raw: totalBalance, change: formatChange(summary?.totalBalanceChangePct ?? null),  sub: 'vs last month',  icon: Wallet,       iconWrap: 'bg-neutral-900 text-neutral-50', glow: 'hover:shadow-neutral-400/20', sparkline: balanceSpark,  sparkColor: '#525252' },
    { title: t('dashboard.monthlyIncome'),  raw: monthCredit,   change: formatChange(summary?.monthIncomeChangePct ?? null),  sub: 'this month',     icon: TrendingUp,   iconWrap: 'bg-lime-100 text-lime-700',       glow: 'hover:shadow-lime-400/30',    sparkline: incomeSpark,   sparkColor: '#84CC16' },
    { title: t('dashboard.monthlyExpense'), raw: monthDebit,    change: formatChange(summary?.monthExpenseChangePct ?? null), sub: 'this month',     icon: TrendingDown, iconWrap: 'bg-rose-100 text-rose-600',       glow: 'hover:shadow-rose-400/20',    sparkline: expenseSpark,  sparkColor: '#F43F5E' },
    { title: t('dashboard.savingsRate'),    raw: Math.max(0, savingsRate), suffix: '%', change: formatChange(summary?.savingsRateChangePct ?? null), sub: 'of income', icon: Target, iconWrap: 'bg-cyan-100 text-cyan-700', glow: 'hover:shadow-cyan-400/20', sparkline: savingsSpark, sparkColor: '#0891B2' },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">

      {/* Plan expiry banner */}
      {daysLeft !== null && daysLeft <= 7 && plan !== 'free' && (
        <div className={cn(
          "flex items-center justify-between gap-4 rounded-2xl px-5 py-3 text-sm font-semibold",
          daysLeft <= 0
            ? "bg-rose-500/10 border border-rose-500/20 text-rose-300"
            : "bg-amber-500/10 border border-amber-500/20 text-amber-300"
        )}>
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 flex-shrink-0" />
            {daysLeft <= 0
              ? `Your ${PLAN_LABELS[plan].name} plan has expired.`
              : `Your ${PLAN_LABELS[plan].name} plan expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`
            }
          </div>
          <Link href="/dashboard/pricing" className="underline underline-offset-2 hover:opacity-80 whitespace-nowrap">
            Renew Now
          </Link>
        </div>
      )}

      {/* Header Panel */}
      <header className="flex flex-col gap-6 rounded-[32px] bg-neutral-900 p-6 md:flex-row md:items-center md:justify-between shadow-2xl">
        <div>
          <p className="text-sm text-lime-400 font-bold tracking-widest uppercase">Welcome back</p>
          <h2 className="text-3xl font-extrabold text-neutral-50 mt-1">{activeBusiness.name}</h2>
          <p className="mt-2 text-sm text-neutral-400 font-medium">Your financial command center is ready.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-lime-400 transition-colors" />
            <input
              placeholder="Quick search..."
              className="rounded-2xl border border-neutral-700 bg-neutral-800 pl-11 pr-4 py-3 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-lime-400/50 w-full md:w-64 transition-all"
            />
          </div>
          <Button variant="outline" className="rounded-2xl !border-neutral-700 !text-neutral-50 hover:!bg-neutral-800">Export</Button>
          <Link href="/dashboard/transactions?action=add">
            <Button className="rounded-2xl px-6 gap-2"><PlusIcon className="w-4 h-4" /> Add Transaction</Button>
          </Link>
        </div>
      </header>

      {/* Summary Row */}
      <section className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.title} className={cn("group rounded-2xl bg-white p-3 sm:p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between min-h-[110px]", card.glow)}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 mr-2">
                <p className="text-[9px] sm:text-xs font-bold text-neutral-400 uppercase tracking-widest truncate">{card.title}</p>
                <h3 className="mt-2 text-sm sm:text-2xl md:text-3xl font-black text-neutral-900 font-mono tabular-nums truncate">
                  {'suffix' in card ? (
                    <><AnimatedValue value={card.raw} reducedMotion={reducedMotion} />{card.suffix}</>
                  ) : (
                    <AnimatedValue value={card.raw} prefix={currencySymbol} reducedMotion={reducedMotion} />
                  )}
                </h3>
              </div>
              <div className={cn("flex h-8 w-8 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110", card.iconWrap)}>
                <card.icon className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 min-w-0">
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-black",
                  card.change.positive === null ? "bg-neutral-100 text-neutral-400" :
                  card.change.positive ? "bg-lime-100 text-lime-700" : "bg-rose-100 text-rose-600"
                )}>
                  {card.change.label}
                </span>
                <span className="text-[9px] sm:text-[10px] uppercase font-bold text-neutral-400 tracking-wider truncate">
                  {card.sub}
                </span>
              </div>
              <Sparkline data={card.sparkline} color={card.sparkColor} />
            </div>
          </div>
        ))}
      </section>

      {/* Main Analytics Section */}
      <section className="grid gap-6 grid-cols-1 xl:grid-cols-3">
        {/* Cash Flow Chart */}
        <div className={cn("xl:col-span-2 rounded-[32px] bg-white p-8 shadow-sm flex flex-col", CARD_HOVER)}>
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-neutral-900 tracking-tight">Cash Flow Overview</h3>
              <p className="text-sm text-neutral-400 font-medium">Monthly performance and growth trend</p>
            </div>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value === '30' ? 30 : 7)}
              className="rounded-2xl border border-black/10 bg-neutral-50 px-4 py-2 text-xs font-bold text-neutral-500 outline-none transition-all focus:ring-2 focus:ring-primary/20"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>

          <div className="h-[300px] w-full">
            {dailyCashflow.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyCashflow} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(90 10% 85%)" />
                  <XAxis dataKey="date" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} interval={range === 30 ? 3 : 0} tickFormatter={(v) => { const d = new Date(v + 'T00:00:00'); return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) }} />
                  <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 12 }}
                    contentStyle={{ backgroundColor: '#171717', border: 'none', borderRadius: '16px', color: '#fff' }}
                  />
                  <Bar dataKey="credit" name="Income" fill="url(#colorIncome)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="debit" name="Expense" fill="url(#colorExpense)" radius={[8, 8, 0, 0]} />
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#84CC16" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#84CC16" stopOpacity={0.3} />
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#F43F5E" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-400 font-medium">Insufficient data for chart</div>
            )}
          </div>
        </div>

        {/* Categories Split */}
        <div className={cn("rounded-[32px] bg-white p-8 shadow-sm flex flex-col items-center", CARD_HOVER)}>
          <div className="w-full mb-8">
            <h3 className="text-2xl font-black text-neutral-900 tracking-tight text-center">{t('dashboard.spendingSplit')}</h3>
            <p className="text-sm text-neutral-400 font-medium text-center">Top expense categories</p>
          </div>

          <div className="relative flex items-center justify-center h-56 w-56 mb-8 mt-4">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={categorySpend} dataKey="amount" cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={2} stroke="none"
                   onMouseEnter={(_, index) => setHoveredSlice(index)}
                   onMouseLeave={() => setHoveredSlice(null)}
                 >
                    {categorySpend.map((e, index) => (
                      <Cell
                        key={index}
                        fill={e.categoryColor}
                        className="outline-none transition-opacity duration-200 cursor-pointer"
                        opacity={hoveredSlice === null || hoveredSlice === index ? 1 : 0.35}
                      />
                    ))}
                 </Pie>
                 <Tooltip contentStyle={{ backgroundColor: '#171717', border: 'none', borderRadius: '16px', color: '#fff' }} />
               </PieChart>
             </ResponsiveContainer>
             <div className="absolute flex flex-col items-center justify-center text-center">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Total Spent</p>
                <h4 className="text-2xl font-black text-neutral-900 mt-1">{fmt(totalCatSpend)}</h4>
             </div>
          </div>

          <div className="w-full space-y-3">
            {categorySpend.slice(0, 4).map((cat, index) => (
              <div
                key={cat.categoryName}
                onMouseEnter={() => setHoveredSlice(index)}
                onMouseLeave={() => setHoveredSlice(null)}
                className={cn("flex items-center justify-between rounded-2xl px-4 py-3 group transition-colors", hoveredSlice === index ? "bg-secondary" : "bg-muted hover:bg-secondary")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.categoryColor }} />
                  <span className="text-sm font-bold text-neutral-500 group-hover:text-neutral-900 transition-colors">{cat.categoryName}</span>
                </div>
                <span className="text-sm font-black text-neutral-900 font-mono">{totalCatSpend > 0 ? Math.round((cat.amount / totalCatSpend) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Activity Section */}
      <section className={cn("rounded-[32px] bg-white p-8 shadow-sm", CARD_HOVER)}>
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-2xl font-black text-neutral-900 tracking-tight">{t('dashboard.recentTransactions')}</h3>
            <p className="text-sm text-neutral-400 font-medium font-mono uppercase tracking-widest">Live Activity Log</p>
          </div>
          <Link href="/dashboard/transactions">
             <Button variant="ghost" className="rounded-2xl px-6 gap-2 !text-lime-700 hover:!bg-lime-50">
                View All <ArrowRight className="w-4 h-4" />
             </Button>
          </Link>
        </div>

        <div className="space-y-4">
          {recentTransactions.length === 0 ? (
            <div className="text-center py-20 text-neutral-400 font-medium">No activity recorded yet for this business.</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="overflow-x-auto hidden lg:block">
                <table className="w-full min-w-[720px] border-separate border-spacing-y-4">
                  <thead>
                    <tr className="text-left text-[11px] font-black text-neutral-400 uppercase tracking-[0.2em] px-4">
                      <th className="px-6 py-2">Entity</th>
                      <th className="px-6 py-2">Timestamp</th>
                      <th className="px-6 py-2">Category</th>
                      <th className="px-6 py-2 text-right">Amount</th>
                      <th className="px-6 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="space-y-4">
                    {recentTransactions.map((tx) => (
                      <tr key={tx.id} className="rounded-2xl bg-muted group hover:bg-secondary transition-all duration-300">
                        <td className="rounded-l-3xl px-6 py-5">
                          <div className="font-bold text-neutral-900 group-hover:text-lime-700 transition-colors">{tx.note || 'Internal Transfer'}</div>
                          {tx.tags && <div className="text-[10px] text-neutral-400 mt-1">#{tx.tags}</div>}
                        </td>
                        <td className="px-6 py-5 text-sm text-neutral-400 font-medium">
                          {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-5">
                           <span className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tx.category?.color || '#94A3B8' }} />
                              <span className="text-sm font-bold text-neutral-600">{tx.category?.name || 'Unsorted'}</span>
                           </span>
                        </td>
                        <td className={cn("px-6 py-5 text-right font-black font-mono text-base tabular-nums", tx.type === 'credit' ? 'text-lime-700' : 'text-rose-600')}>
                          {tx.type === 'credit' ? '+' : '-'}{fmt(tx.amount)}
                        </td>
                        <td className="rounded-r-3xl px-6 py-5 text-center">
                          <Badge variant={tx.type as any} className="font-black text-[10px] shadow-sm">
                            {tx.method || 'CASH'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile List View */}
              <div className="block lg:hidden space-y-1.5 px-1">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="py-2 px-2.5 bg-muted rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tx.type === 'credit' ? 'bg-lime-500' : 'bg-rose-500'}`} />
                      <div className="flex-shrink-0 text-center w-8">
                        <div className="text-[10px] font-black text-neutral-900 font-mono leading-tight">{new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit' })}</div>
                        <div className="text-[8px] text-neutral-400 font-bold uppercase leading-tight">{new Date(tx.date).toLocaleDateString('en-GB', { month: 'short' })}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-neutral-900 truncate">{tx.note || 'Internal Transfer'}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tx.category?.color || '#94A3B8' }} />
                          <span className="text-[9px] text-neutral-400 truncate">{tx.category?.name || 'Unsorted'}</span>
                          <span className="text-[8px] text-neutral-400 uppercase">· {tx.method || 'cash'}</span>
                        </div>
                      </div>
                    </div>
                    <div className={cn("font-black font-mono text-xs tabular-nums flex-shrink-0", tx.type === 'credit' ? 'text-lime-700' : 'text-rose-600')}>
                      {tx.type === 'credit' ? '+' : '-'}{fmt(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Bank Activity Section (Pro/Premium only) */}
      {can('bankSync') && bankTxs.length > 0 && (
        <section className={cn("rounded-[32px] bg-white p-8 shadow-sm", CARD_HOVER)}>
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-lime-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-lime-700" />
              </div>
              <div>
                <h3 className="text-xl font-black text-neutral-900 tracking-tight">Bank Activity</h3>
                <p className="text-xs text-neutral-400 font-medium">Latest transactions from your connected bank</p>
              </div>
            </div>
            <Link href="/dashboard/bank">
              <Button variant="ghost" className="rounded-2xl px-6 gap-2 !text-lime-700 hover:!bg-lime-50">
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="space-y-1.5">
            {bankTxs.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-muted hover:bg-secondary transition"
              >
                {/* Icon */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  tx.type === 'credit' ? 'bg-lime-100' : 'bg-rose-100'
                }`}>
                  {tx.type === 'credit'
                    ? <ArrowDownLeft className="w-4 h-4 text-lime-700" />
                    : <ArrowUpRight className="w-4 h-4 text-rose-600" />
                  }
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-neutral-900 truncate">
                    {tx.narration || 'Bank Transaction'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-neutral-400">
                      {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    {tx.ai_category_suggestion && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        tx.is_categorised
                          ? 'bg-lime-100 text-lime-700'
                          : 'bg-violet-100 text-violet-700'
                      }`}>
                        {!tx.is_categorised && '✨ '}{tx.ai_category_suggestion}
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <p className={`text-sm font-black flex-shrink-0 ${
                  tx.type === 'credit' ? 'text-lime-700' : 'text-rose-600'
                }`}>
                  {tx.type === 'credit' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function PlusIcon(props: any) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
    </svg>
  )
}
