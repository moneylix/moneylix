'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, isSameDay, isToday, isSameMonth, format,
} from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarDays, Check, RefreshCw } from 'lucide-react'
import { useBusiness } from '@/lib/contexts/BusinessContext'
import { useCurrency } from '@/lib/contexts/CurrencyContext'
import { useTranslation } from '@/lib/i18n'
import Modal from '@/components/ui/Modal'
import { projectOccurrences, type RecurringRuleLike } from '@/lib/utils/recurringOccurrences'

interface Transaction {
  id: number
  type: 'credit' | 'debit'
  amount: number
  category_id: number
  business_id?: number
  date: string
  due_date?: string
  status: string
  note: string | null
  client_name?: string
  category?: { name: string; color: string }
}

// Local-time date key, not UTC — date-fns' month-grid helpers (eachDayOfInterval,
// startOfWeek, etc.) work in local time, and the app's date/due_date/next_run_date
// strings are plain calendar dates. Using d.toISOString() here would round-trip
// through UTC and shift the key a day off in any positive UTC-offset timezone.
const toISODate = (d: Date) => format(d, 'yyyy-MM-dd')

export default function CalendarPage() {
  const { t } = useTranslation()
  const { activeBusiness } = useBusiness()
  const { currentCurrency, currencies } = useCurrency()
  const fmt = useCallback(
    (n: number) => `${currencies.find(c => c.code === currentCurrency)?.symbol ?? ''}${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    [currencies, currentCurrency]
  )

  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [activity, setActivity] = useState<Transaction[]>([])
  const [pending, setPending] = useState<Transaction[]>([])
  const [recurringRules, setRecurringRules] = useState<RecurringRuleLike[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const monthStart = useMemo(() => startOfMonth(monthCursor), [monthCursor])
  const monthEnd = useMemo(() => endOfMonth(monthCursor), [monthCursor])
  const gridDays = useMemo(() => eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(monthEnd),
  }), [monthStart, monthEnd])

  const fetchData = useCallback(async () => {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const [activityRes, pendingRes, recurringRes] = await Promise.all([
        fetch(`/api/transactions?businessId=${activeBusiness.id}&startDate=${toISODate(monthStart)}&endDate=${toISODate(monthEnd)}&limit=200`, { headers: authHeader }),
        fetch(`/api/transactions?businessId=${activeBusiness.id}&type=pending&limit=200`, { headers: authHeader }),
        fetch('/api/recurring', { headers: authHeader }),
      ])
      const activityData = await activityRes.json()
      const pendingData = await pendingRes.json()
      const recurringData = await recurringRes.json()
      setActivity(activityData.transactions || [])
      setPending(pendingData.transactions || [])
      setRecurringRules(recurringData.recurring || [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [activeBusiness, monthStart, monthEnd])

  useEffect(() => { fetchData() }, [fetchData])

  const occurrences = useMemo(() => {
    const gridStart = startOfWeek(monthStart)
    const gridEnd = endOfWeek(monthEnd)
    return recurringRules.flatMap(rule => projectOccurrences(rule, gridStart, gridEnd))
  }, [recurringRules, monthStart, monthEnd])

  const now = useMemo(() => new Date(), [])

  const dayBuckets = useMemo(() => {
    const map = new Map<string, { activity: Transaction[]; due: Transaction[]; recurring: typeof occurrences }>()
    const get = (key: string) => {
      let bucket = map.get(key)
      if (!bucket) { bucket = { activity: [], due: [], recurring: [] }; map.set(key, bucket) }
      return bucket
    }
    for (const t of activity) get(t.date).activity.push(t)
    for (const t of pending) {
      const dueKey = t.due_date || t.date
      get(dueKey).due.push(t)
    }
    for (const occ of occurrences) get(occ.date).recurring.push(occ)
    return map
  }, [activity, pending, occurrences])

  const monthTotals = useMemo(() => {
    let spent = 0
    for (const t of activity) if (t.type === 'debit' && t.status === 'completed') spent += t.amount
    let dueTotal = 0
    let dueCount = 0
    dayBuckets.forEach((bucket) => {
      dueTotal += bucket.due.reduce((s, t) => s + t.amount, 0) + bucket.recurring.reduce((s, o) => s + o.rule.amount, 0)
      dueCount += bucket.due.length + bucket.recurring.length
    })
    return { spent, dueTotal, dueCount }
  }, [activity, dayBuckets])

  const selectedBucket = selectedDay ? dayBuckets.get(toISODate(selectedDay)) : null

  const markPaid = async (t: Transaction) => {
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    await fetch(`/api/transactions/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        type: t.type, amount: t.amount, category_id: t.category_id, business_id: t.business_id,
        date: t.date, status: 'completed', client_name: t.client_name, note: t.note,
        due_date: t.due_date || null,
      }),
    })
    fetchData()
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-neutral-900">{t('nav.calendar')}</h1>
          <p className="text-[10px] text-neutral-400">{t('calendar.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonthCursor(m => addMonths(m, -1))} className="p-1.5 rounded-lg bg-white hover:bg-neutral-100 transition">
            <ChevronLeft className="w-4 h-4 text-neutral-500" />
          </button>
          <button onClick={() => setMonthCursor(startOfMonth(new Date()))} className="px-3 py-1.5 rounded-lg bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition min-w-[110px] text-center">
            {format(monthCursor, 'MMMM yyyy')}
          </button>
          <button onClick={() => setMonthCursor(m => addMonths(m, 1))} className="p-1.5 rounded-lg bg-white hover:bg-neutral-100 transition">
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 text-rose-700">
          <CalendarDays className="w-3 h-3 flex-shrink-0" />
          <span className="text-[10px] text-neutral-400">{t('calendar.spentThisMonth')}</span>
          <span className="text-xs font-bold font-mono">{fmt(monthTotals.spent)}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 text-amber-700">
          <RefreshCw className="w-3 h-3 flex-shrink-0" />
          <span className="text-[10px] text-neutral-400">{t('calendar.dueThisMonth')}</span>
          <span className="text-xs font-bold font-mono">{fmt(monthTotals.dueTotal)}</span>
          <span className="text-[10px] opacity-60">({monthTotals.dueCount} {t('calendar.bills')})</span>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-black/5 bg-neutral-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="px-2 py-2 text-center text-[10px] font-medium text-neutral-400">{d}</div>
          ))}
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-7">
            {gridDays.map(day => {
              const key = toISODate(day)
              const bucket = dayBuckets.get(key)
              const inMonth = isSameMonth(day, monthCursor)
              const net = (bucket?.activity ?? []).reduce((s, t) => s + (t.type === 'credit' ? t.amount : -t.amount), 0)
              const dueAmount = (bucket?.due.reduce((s, t) => s + t.amount, 0) ?? 0) + (bucket?.recurring.reduce((s, o) => s + o.rule.amount, 0) ?? 0)
              const dueItemCount = (bucket?.due.length ?? 0) + (bucket?.recurring.length ?? 0)
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(day)}
                  className={`relative flex flex-col items-start gap-1 min-h-[76px] p-2 border-b border-r border-black/5 text-left transition hover:bg-neutral-50 ${!inMonth ? 'opacity-35' : ''}`}
                >
                  <span className={`text-[11px] font-semibold ${isToday(day) ? 'w-5 h-5 flex items-center justify-center rounded-full bg-lime-400 text-neutral-900' : 'text-neutral-600'}`}>
                    {format(day, 'd')}
                  </span>
                  {net !== 0 && (
                    <span className={`text-[9px] font-mono font-semibold ${net > 0 ? 'text-lime-700' : 'text-rose-600'}`}>
                      {net > 0 ? '+' : ''}{fmt(net)}
                    </span>
                  )}
                  {dueItemCount > 0 && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      {t('tax.due')} {fmt(dueAmount)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Day detail modal */}
      <Modal isOpen={selectedDay !== null} onClose={() => setSelectedDay(null)} title={selectedDay ? format(selectedDay, 'EEEE, d MMMM yyyy') : ''}>
        {selectedBucket && (selectedBucket.activity.length + selectedBucket.due.length + selectedBucket.recurring.length === 0) && (
          <p className="text-xs text-muted-foreground py-4 text-center">{t('calendar.nothingOnThisDay')}</p>
        )}

        {selectedBucket && selectedBucket.activity.length > 0 && (
          <div className="space-y-1 mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('calendar.activity')}</p>
            {selectedBucket.activity.map(tr => (
              <div key={tr.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-accent/40">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{tr.note || tr.category?.name || t('calendar.transaction')}</p>
                  <p className="text-[10px] text-muted-foreground">{tr.category?.name ?? '—'}</p>
                </div>
                <span className={`text-xs font-bold font-mono flex-shrink-0 ${tr.type === 'credit' ? 'text-lime-700' : 'text-rose-600'}`}>
                  {tr.type === 'credit' ? '+' : '-'}{fmt(tr.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        {selectedBucket && (selectedBucket.due.length > 0 || selectedBucket.recurring.length > 0) && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('calendar.dueReminders')}</p>
            {selectedBucket.due.map(tr => (
              <div key={tr.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{tr.client_name || tr.note || t('calendar.billFallback')}</p>
                  <p className="text-[10px] text-amber-700">{tr.status === 'pending' && tr.due_date && new Date(tr.due_date) < now ? t('receivables.overdue') : t('receivables.pending')}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-bold font-mono text-amber-700">{fmt(tr.amount)}</span>
                  <button onClick={() => markPaid(tr)} title={t('calendar.markPaid')} className="p-1.5 rounded-lg bg-lime-400 hover:bg-lime-300 text-neutral-900 transition">
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            {selectedBucket.recurring.map((occ, i) => (
              <div key={`${occ.rule.id}-${i}`} className="flex items-center justify-between px-3 py-2 rounded-xl bg-violet-50">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{occ.rule.note || t('calendar.recurringBill')}</p>
                  <p className="text-[10px] text-violet-700 capitalize">{occ.rule.frequency} · {t('calendar.autoPostsOnDueDate')}</p>
                </div>
                <span className="text-xs font-bold font-mono text-violet-700 flex-shrink-0">
                  {occ.rule.type === 'credit' ? '+' : '-'}{fmt(occ.rule.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
