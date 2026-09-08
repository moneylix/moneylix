'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Bell, X, AlertTriangle, Clock, TrendingUp, Target,
  Megaphone, Check,
} from 'lucide-react'

interface Notification {
  id: number
  type: string
  title: string
  message: string
  is_read: number
  action_url: string | null
  created_at: string
  business_name: string | null
}

const ICON_MAP: Record<string, typeof Bell> = {
  low_balance: AlertTriangle,
  due_date: Clock,
  unusual_spend: TrendingUp,
  tax_deadline: AlertTriangle,
  budget_alert: Target,
  system: Megaphone,
}

const COLOR_MAP: Record<string, string> = {
  low_balance: 'text-rose-400',
  due_date: 'text-amber-400',
  unusual_spend: 'text-orange-400',
  tax_deadline: 'text-red-400',
  budget_alert: 'text-purple-400',
  system: 'text-cyan-400',
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  if (diffHr < 24) return `${diffHr}h`
  if (diffDay < 7) return `${diffDay}d`
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem('moneylix_session_token')
    if (!token) return
    try {
      const res = await fetch('/api/notifications?limit=10&offset=0', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      // Silent
    }
  }, [])

  // Fetch on mount and poll every 60 seconds
  useEffect(() => {
    fetchNotifications()
    pollRef.current = setInterval(fetchNotifications, 60000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchNotifications])

  // Refresh when dropdown opens
  useEffect(() => {
    if (open) fetchNotifications()
  }, [open, fetchNotifications])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markRead = async (id: number) => {
    const token = localStorage.getItem('moneylix_session_token')
    if (!token) return
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n)))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    const token = localStorage.getItem('moneylix_session_token')
    if (!token) return
    setLoading(true)
    await fetch('/api/notifications/mark-all-read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
    setUnreadCount(0)
    setLoading(false)
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 rounded-full border-2 border-slate-950 flex items-center justify-center">
            <span className="text-[9px] font-bold text-white leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-12 w-96 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <p className="text-xs font-black text-white uppercase tracking-widest">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full font-bold normal-case tracking-normal">
                  {unreadCount} new
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold disabled:opacity-50"
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)}>
                <X className="w-4 h-4 text-slate-500 hover:text-white" />
              </button>
            </div>
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-500">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
              All clear — no notifications
            </div>
          ) : (
            <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
              {notifications.map(n => {
                const Icon = ICON_MAP[n.type] || Bell
                const color = COLOR_MAP[n.type] || 'text-cyan-400'
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition cursor-pointer ${
                      !n.is_read ? 'bg-white/[0.02]' : ''
                    }`}
                    onClick={() => {
                      if (!n.is_read) markRead(n.id)
                    }}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs leading-tight ${n.is_read ? 'text-slate-400' : 'text-white font-semibold'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                        {n.message}
                      </p>
                      <span className="text-[9px] text-slate-600 mt-1 block">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </div>
                    {n.action_url && (
                      <Link
                        href={n.action_url}
                        onClick={e => {
                          e.stopPropagation()
                          if (!n.is_read) markRead(n.id)
                          setOpen(false)
                        }}
                        className="flex-shrink-0 text-[9px] text-emerald-400 font-bold hover:text-emerald-300 mt-1"
                      >
                        View
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-widest"
            >
              View All →
            </Link>
            <Link
              href="/dashboard/notifications/preferences"
              onClick={() => setOpen(false)}
              className="text-[10px] text-slate-500 hover:text-slate-300 font-semibold"
            >
              Settings
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
