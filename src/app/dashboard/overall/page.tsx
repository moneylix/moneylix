'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, ArrowDownRight, Globe, AlertCircle, Clock } from 'lucide-react'
import { useCurrency } from '@/lib/contexts/CurrencyContext'

interface OverallStats {
  grandTotal: { income: number; expense: number; pending: number; netProfit: number }
  breakdown: { id: number; name: string; income: number; expense: number; pending: number; netProfit: number }[]
}

export default function OverallDashboard() {
  const [stats, setStats] = useState<OverallStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { currentCurrency, currencies } = useCurrency()

  const fmt = (amount: number) => {
    const sym = currencies.find(c => c.code === currentCurrency)?.symbol ?? currentCurrency
    return `${sym}${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  useEffect(() => {
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    fetch('/api/overall', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json()).then(setStats).catch(() => setError('Failed to load')).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" /></div>
  if (error || !stats) return <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-xs gap-2"><AlertCircle className="w-6 h-6 text-rose-600" /><p>{error}</p></div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-foreground">Overall Finances</h1>
          <p className="text-[10px] text-muted-foreground">Aggregated across all businesses</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-border/50 bg-secondary/50">
          <Globe className="w-3 h-3 text-lime-700" />
          <span className="text-xs text-muted-foreground">All Businesses</span>
        </div>
      </div>

      {/* Grand Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Income', value: fmt(stats.grandTotal.income), color: 'text-lime-700', accent: 'border-emerald-500/20 bg-emerald-500/10', icon: ArrowUpRight },
          { label: 'Total Expense', value: fmt(stats.grandTotal.expense), color: 'text-rose-600', accent: 'border-rose-500/20 bg-rose-500/10', icon: ArrowDownRight },
          { label: 'Pending', value: (stats.grandTotal.pending < 0 ? '-' : '') + fmt(stats.grandTotal.pending), color: 'text-amber-600', accent: 'border-amber-500/20 bg-amber-500/10', icon: Clock },
          { label: 'Net Profit', value: (stats.grandTotal.netProfit >= 0 ? '+' : '') + fmt(stats.grandTotal.netProfit), color: stats.grandTotal.netProfit >= 0 ? 'text-cyan-700' : 'text-rose-600', accent: 'border-cyan-500/20 bg-cyan-500/10', icon: Globe },
        ].map(({ label, value, color, accent, icon: Icon }) => (
          <div key={label} className={`card ${accent} p-3 flex items-center gap-3 min-w-0`}>
            <div className={`w-8 h-8 rounded-xl bg-background/50 flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground/80 truncate">{label}</p>
              <p className={`text-sm font-bold font-mono truncate ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Breakdown — cards on mobile, table on sm+ */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 bg-secondary/30">
          <p className="text-sm font-semibold text-foreground">Business Breakdown</p>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden divide-y divide-border/30">
          {stats.breakdown.map(b => (
            <div key={b.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-foreground ring-1 ring-border/50 flex-shrink-0">{b.name.charAt(0).toUpperCase()}</div>
                <span className="text-sm font-semibold text-foreground">{b.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-9 text-xs">
                <span className="text-muted-foreground">Income</span>
                <span className="font-mono text-lime-700 font-semibold text-right">{fmt(b.income)}</span>
                <span className="text-muted-foreground">Expense</span>
                <span className="font-mono text-rose-600 font-semibold text-right">{fmt(b.expense)}</span>
                <span className="text-muted-foreground">Pending</span>
                <span className="font-mono text-amber-600 font-semibold text-right">{fmt(b.pending)}</span>
                <span className="text-muted-foreground">Net Profit</span>
                <span className={`font-mono font-bold text-right ${b.netProfit >= 0 ? 'text-cyan-700' : 'text-rose-600'}`}>{(b.netProfit >= 0 ? '+' : '') + fmt(b.netProfit)}</span>
              </div>
            </div>
          ))}
          {stats.breakdown.length === 0 && <p className="px-4 py-8 text-center text-muted-foreground text-sm">No businesses found</p>}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/50 bg-secondary/20">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Business</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Income</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Expense</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Pending</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Net Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {stats.breakdown.map(b => (
                <tr key={b.id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center text-xs font-bold text-foreground ring-1 ring-border/50">{b.name.charAt(0).toUpperCase()}</div>
                      <span className="text-foreground font-medium">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-lime-700 font-semibold">{fmt(b.income)}</td>
                  <td className="px-4 py-3 text-right font-mono text-rose-600 font-semibold">{fmt(b.expense)}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-600 font-semibold">{fmt(b.pending)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`flex items-center justify-end gap-1 font-mono font-bold ${b.netProfit >= 0 ? 'text-cyan-700' : 'text-rose-600'}`}>
                      {b.netProfit >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {fmt(b.netProfit)}
                    </span>
                  </td>
                </tr>
              ))}
              {stats.breakdown.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No businesses found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
