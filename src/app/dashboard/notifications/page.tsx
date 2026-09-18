'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Bell, BellOff, Check, CheckCheck, Filter, AlertTriangle,
  Clock, TrendingUp, Target, Megaphone, ChevronDown, Settings,
} from 'lucide-react'
import Link from 'next/link'
import { useBusiness } from '@/lib/contexts/BusinessContext'
import { useTranslation } from '@/lib/i18n'

interface Notification {
  id: number
  user_id: number
  business_id: number | null
  type: string
  title: string
  message: string
  is_read: number
  action_url: string | null
  metadata: string | null
  created_at: string
  business_name: string | null
}

function getTypeConfig(t: (key: string) => string): Record<string, { label: string; icon: typeof Bell; cls: string }> {
  return {
    low_balance:   { label: t('notifications.lowBalance'),   icon: AlertTriangle, cls: 'bg-rose-100 text-rose-700' },
    due_date:      { label: t('receivables.dueDate'),        icon: Clock,         cls: 'bg-amber-100 text-amber-700' },
    unusual_spend: { label: t('notifications.unusualSpend'), icon: TrendingUp,    cls: 'bg-orange-100 text-orange-700' },
    tax_deadline:  { label: t('notifications.taxDeadline'),  icon: AlertTriangle, cls: 'bg-red-100 text-red-700' },
    budget_alert:  { label: t('notifications.budgetAlert'),  icon: Target,        cls: 'bg-purple-100 text-purple-700' },
    system:        { label: t('notifications.systemType'),   icon: Megaphone,     cls: 'bg-blue-100 text-blue-700' },
  }
}

function formatRelativeTime(dateStr: string, t: (key: string) => string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return t('notifications.justNow')
  if (diffMin < 60) return `${diffMin}${t('notifications.mAgo')}`
  if (diffHr < 24) return `${diffHr}${t('notifications.hAgo')}`
  if (diffDay < 7) return `${diffDay}${t('notifications.dAgo')}`
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function groupByDate(items: Notification[], t: (key: string) => string): Record<string, Notification[]> {
  const groups: Record<string, Notification[]> = {}
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  for (const item of items) {
    const d = item.created_at.split('T')[0] || item.created_at.split(' ')[0]
    let label = d
    if (d === today) label = t('time.today')
    else if (d === yesterday) label = t('notifications.yesterday')
    else label = new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    if (!groups[label]) groups[label] = []
    groups[label].push(item)
  }
  return groups
}

export default function NotificationsPage() {
  const { t } = useTranslation()
  const TYPE_CONFIG = getTypeConfig(t)
  const { activeBusiness } = useBusiness()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [offset, setOffset] = useState(0)
  const [showTypeDropdown, setShowTypeDropdown] = useState(false)
  const limit = 30

  const fetchNotifications = useCallback(async (reset = false) => {
    const token = localStorage.getItem('moneylix_session_token')
    if (!token) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', limit.toString())
      params.set('offset', reset ? '0' : offset.toString())
      if (filter === 'unread') params.set('unread', 'true')
      if (typeFilter !== 'all') params.set('type', typeFilter)

      const res = await fetch(`/api/notifications?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()

      if (reset) {
        setNotifications(data.notifications || [])
        setOffset(limit)
      } else {
        setNotifications(prev => [...prev, ...(data.notifications || [])])
        setOffset(prev => prev + limit)
      }
      setUnreadCount(data.unreadCount ?? 0)
      setTotal(data.total ?? 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filter, typeFilter, offset])

  useEffect(() => {
    setOffset(0)
    fetchNotifications(true)
  }, [filter, typeFilter])

  const markRead = async (id: number) => {
    const token = localStorage.getItem('moneylix_session_token')
    if (!token) return
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n))
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    const token = localStorage.getItem('moneylix_session_token')
    if (!token) return
    await fetch('/api/notifications/mark-all-read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
    setUnreadCount(0)
  }

  const grouped = groupByDate(notifications, t)

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-bold text-neutral-900">{t('nav.notifications')}</h1>
          <p className="text-[10px] text-neutral-400">
            {unreadCount > 0 ? `${unreadCount} ${t('notifications.unreadSuffix')}` : t('notifications.allCaughtUp')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition font-semibold"
            >
              <CheckCheck className="w-3 h-3" /> {t('notifications.markAllRead')}
            </button>
          )}
          <Link
            href="/dashboard/notifications/preferences"
            className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition font-semibold"
          >
            <Settings className="w-3 h-3" /> {t('notifications.preferences')}
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {(['all', 'unread'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium capitalize transition ${
                filter === f
                  ? 'bg-lime-100 text-lime-700'
                  : 'bg-white text-neutral-400 hover:text-neutral-900'
              }`}
            >
              {f === 'all' ? t('common.all') : t('notifications.unread')}
              {f === 'unread' && unreadCount > 0 && (
                <span className="ml-1 text-[10px] opacity-60">({unreadCount})</span>
              )}
            </button>
          ))}
        </div>

        {/* Type filter dropdown */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowTypeDropdown(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white text-neutral-500 hover:text-neutral-900 transition border border-neutral-200"
          >
            <Filter className="w-3 h-3" />
            {typeFilter === 'all' ? t('notifications.allTypes') : TYPE_CONFIG[typeFilter]?.label || typeFilter}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showTypeDropdown && (
            <div className="absolute right-0 top-9 w-44 bg-white border border-neutral-200 rounded-xl shadow-lg z-30 py-1">
              <button
                onClick={() => { setTypeFilter('all'); setShowTypeDropdown(false) }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-50 ${typeFilter === 'all' ? 'font-bold text-lime-700' : 'text-neutral-600'}`}
              >
                {t('notifications.allTypes')}
              </button>
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => { setTypeFilter(key); setShowTypeDropdown(false) }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-50 flex items-center gap-2 ${typeFilter === key ? 'font-bold text-lime-700' : 'text-neutral-600'}`}
                >
                  <cfg.icon className="w-3 h-3" /> {cfg.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notification List */}
      {loading && notifications.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-neutral-400">
          <BellOff className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-xs font-semibold">{t('notifications.noNotifications')}</p>
          <p className="text-[10px] mt-1">{t('notifications.allCaughtUpExcl')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 px-1">
                {dateLabel}
              </p>
              <div className="space-y-1">
                {items.map(n => {
                  const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system
                  const Icon = cfg.icon
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 p-3 rounded-2xl transition cursor-pointer ${
                        n.is_read ? 'bg-white' : 'bg-lime-50/50 border border-lime-200/50'
                      } hover:bg-neutral-50`}
                      onClick={() => {
                        if (!n.is_read) markRead(n.id)
                      }}
                    >
                      <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${cfg.cls}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-semibold ${n.is_read ? 'text-neutral-600' : 'text-neutral-900'}`}>
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span className="w-1.5 h-1.5 bg-lime-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                          {n.business_name && (
                            <span className="text-[9px] text-neutral-400">
                              {n.business_name}
                            </span>
                          )}
                          <span className="text-[9px] text-neutral-300 ml-auto">
                            {formatRelativeTime(n.created_at, t)}
                          </span>
                        </div>
                      </div>
                      {n.action_url && (
                        <Link
                          href={n.action_url}
                          onClick={e => e.stopPropagation()}
                          className="flex-shrink-0 text-[9px] text-lime-700 font-bold hover:text-lime-600 mt-1"
                        >
                          {t('notifications.viewArrow')}
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Load more */}
          {notifications.length < total && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => fetchNotifications(false)}
                disabled={loading}
                className="text-xs text-lime-700 font-semibold hover:text-lime-600 transition disabled:opacity-50"
              >
                {loading ? t('common.loading') : t('notifications.loadMore')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
