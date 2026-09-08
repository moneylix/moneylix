'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Cookie, X } from 'lucide-react'

/**
 * CookieBanner — small bottom banner that appears once until dismissed.
 * Stores dismissal in localStorage so it never shows again.
 * Only shows on web (not native Capacitor apps).
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Don't show on native apps
    const cap = (window as any).Capacitor
    if (cap?.isNativePlatform?.()) return

    // Check if already dismissed
    const dismissed = localStorage.getItem('moneylix_cookie_consent')
    if (!dismissed) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('moneylix_cookie_consent', 'accepted')
    setVisible(false)
  }

  const handleDismiss = () => {
    localStorage.setItem('moneylix_cookie_consent', 'dismissed')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-4 animate-in slide-in-from-bottom duration-300">
      <div className="max-w-2xl mx-auto rounded-2xl border border-white/10 bg-[#0d1321]/95 backdrop-blur-xl shadow-2xl px-4 py-3 sm:px-5 sm:py-4 flex items-center gap-3 sm:gap-4">
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <Cookie className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
            We use essential cookies to keep you logged in. No tracking or ads.{' '}
            <Link href="/cookie-policy" className="text-emerald-400 hover:underline font-medium">
              Learn more
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleAccept}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/30 active:scale-95 transition-all"
          >
            Got it
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-white/5 transition text-slate-500 hover:text-slate-300"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
