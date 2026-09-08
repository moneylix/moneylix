'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, AlertTriangle,
  CalendarDays, RefreshCw, ArrowDownLeft, ArrowUpRight,
  Repeat, ClipboardList,
} from 'lucide-react'
import { useBusiness } from '@/lib/contexts/BusinessContext'
import { useCurrency } from '@/lib/contexts/CurrencyContext'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts'

interface ForecastEvent {
  type: 'recurring' | 'receivable'
  description: string
  amount: number
  kind: 'credit' | 'debit'
}

interface ForecastDay {
  date: string
  projected_income: number
  projected_expense: number
  projected_balance: number
  confidence: number
  events: ForecastEvent[]
}

interface ForecastSummary {
  projected_end_balance: number
  total_projected_income: number
  total_projected_expense: number
  lowest_balance_date: string
  lowest_balance_amount: number
  starting_balance: number
}

export default function ForecastPage() {
  const { activeBusiness } = useBusiness()
  const { currentCurrency, currencies } = useCurrency()
  const [forecast, setForecast] = useState<ForecastDay[]>([])
  const [summary, setSummary] = useState<ForecastSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState<30 | 60 | 90>(30)

  const fmt = useCallback(
    (n: number) => {
      const sym = currencies.find((c) => c.code === currentCurrency)?.symbol ?? '₹'
      return `${sym}${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    },
    [currencies, currentCurrency],
  )

  const fetchForecast = useCallback(async () => {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const params = new URLSearchParams({ days: String(days) })
      if (activeBusiness) params.set('businessId', String(activeBusiness.id))
      const res = await fetch(`/api/forecast?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setForecast(data.forecast ?? [])
      setSummary(data.summary ?? null)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [activeBusiness, days])

  useEffect(() => {
    fetchForecast()
  }, [fetchForecast])

  // Collect all upcoming known events
  const upcomingEvents = forecast
    .flatMap((d) => d.events.map((ev) => ({ ...ev, date: d.date })))
    .slice(0, 15)

  // Chart data — only show every Nth label to avoid clutter
  const chartData = forecast.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    Balance: d.projected_balance,
    Income: d.projected_income,
    Expense: d.projected_expense,
    UpperBand: d.projected_balance * (1 + (1 - d.confidence) * 0.3),
    LowerBand: d.projected_balance * (1 - (1 - d.confidence) * 0.3),
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold text-neutral-900">Cash Flow Forecast</h1>
          <p className="text-[10px] text-neutral-400">
            Projected balance based on history, recurring transactions &amp; receivables
          </p>
        </div>
        <div className="flex items-center gap-2">
          {([30, 60, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                days === d
                  ? 'bg-lime-400 text-neutral-900'
                  : 'bg-white text-neutral-400 hover:text-neutral-900'
              }`}
            >
              {d} days
            </button>
          ))}
          <button
            onClick={fetchForecast}
            className="p-1.5 rounded-xl bg-white text-neutral-400 hover:text-neutral-900 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <SummaryCard
            icon={Wallet}
            label="Starting Balance"
            value={fmt(summary.starting_balance)}
            cls="text-blue-700 bg-blue-50"
          />
          <SummaryCard
            icon={TrendingUp}
            label="Projected End"
            value={(summary.projected_end_balance >= 0 ? '' : '-') + fmt(summary.projected_end_balance)}
            cls={summary.projected_end_balance >= 0 ? 'text-lime-700 bg-lime-50' : 'text-rose-700 bg-rose-50'}
          />
          <SummaryCard
            icon={ArrowDownLeft}
            label="Total Income"
            value={fmt(summary.total_projected_income)}
            cls="text-emerald-700 bg-emerald-50"
          />
          <SummaryCard
            icon={ArrowUpRight}
            label="Total Expense"
            value={fmt(summary.total_projected_expense)}
            cls="text-rose-700 bg-rose-50"
          />
          <SummaryCard
            icon={AlertTriangle}
            label="Lowest Balance"
            value={
              (summary.lowest_balance_amount < 0 ? '-' : '') +
              fmt(summary.lowest_balance_amount)
            }
            sub={new Date(summary.lowest_balance_date).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })}
            cls={summary.lowest_balance_amount < 0 ? 'text-rose-700 bg-rose-50' : 'text-amber-700 bg-amber-50'}
          />
        </div>
      )}

      {/* Chart */}
      <div className="bg-white shadow-sm rounded-2xl p-4">
        <p className="text-xs font-bold text-neutral-900 mb-3">Projected Balance</p>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-neutral-400 text-xs">
            No data to forecast. Add some transactions first.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#84cc16" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#84cc16" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#a3a3a3' }}
                interval={Math.floor(chartData.length / 8)}
              />
              <YAxis tick={{ fontSize: 10, fill: '#a3a3a3' }} width={60} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: 12,
                  fontSize: 11,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Area
                type="monotone"
                dataKey="UpperBand"
                stroke="none"
                fill="url(#bandGrad)"
                name="Confidence Band"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="LowerBand"
                stroke="none"
                fill="transparent"
                name=""
                dot={false}
                legendType="none"
              />
              <Area
                type="monotone"
                dataKey="Balance"
                stroke="#84cc16"
                fill="url(#balGrad)"
                strokeWidth={2}
                name="Projected Balance"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Upcoming Known Events */}
      <div className="bg-white shadow-sm rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-black/5">
          <p className="text-xs font-bold text-neutral-900">Upcoming Known Events</p>
          <p className="text-[10px] text-neutral-400">Recurring transactions &amp; pending receivables within the forecast</p>
        </div>
        {upcomingEvents.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-neutral-400 text-xs">
            No upcoming events found
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {upcomingEvents.map((ev, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    ev.type === 'recurring' ? 'bg-violet-50' : 'bg-amber-50'
                  }`}
                >
                  {ev.type === 'recurring' ? (
                    <Repeat className="w-3.5 h-3.5 text-violet-500" />
                  ) : (
                    <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-neutral-900 truncate">{ev.description}</p>
                  <p className="text-[10px] text-neutral-400">
                    {new Date(ev.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <p
                  className={`text-xs font-bold font-mono ${
                    ev.kind === 'credit' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {ev.kind === 'credit' ? '+' : '-'}
                  {fmt(ev.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── small card component ───────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  cls,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  cls: string
}) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-3 rounded-xl ${cls}`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <div>
        <p className="text-[10px] opacity-70">{label}</p>
        <p className="text-sm font-bold font-mono leading-tight">{value}</p>
        {sub && <p className="text-[9px] opacity-60">{sub}</p>}
      </div>
    </div>
  )
}
